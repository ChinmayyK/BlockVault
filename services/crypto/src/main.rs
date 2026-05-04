use std::env;
use std::sync::Arc;

use aes_gcm::aead::{Aead, Payload};
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use anyhow::{anyhow, Result};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use log::{error, info, warn};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use zeroize::{Zeroize, ZeroizeOnDrop};

// ---------------------------------------------------------------------------
// Wire format constants
// ---------------------------------------------------------------------------

/// New Argon2id-based format.
const MAGIC_V2: &[u8; 8] = b"BVENC002";
/// Legacy PBKDF2-based format (read-only support for decryption).
const MAGIC_V1: &[u8; 8] = b"BVENC001";

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12; // AES-GCM standard nonce

// Argon2id parameters
const ARGON2_M_COST: u32 = 65_536; // 64 MB
const ARGON2_T_COST: u32 = 3;      // iterations
const ARGON2_P_COST: u32 = 4;      // parallelism

// Legacy PBKDF2 parameter (for decrypting V1 files only)
const PBKDF2_ITERS: u32 = 120_000;

// ---------------------------------------------------------------------------
// JSON protocol
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug)]
struct Request {
    operation: String,
    passphrase: String,
    #[serde(default)]
    aad: Option<String>,
    data: String, // base64-encoded
}

#[derive(Serialize)]
struct Response {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    output: Option<String>, // base64-encoded
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

// ---------------------------------------------------------------------------
// Sensitive buffer wrapper
// ---------------------------------------------------------------------------

#[derive(Zeroize, ZeroizeOnDrop)]
struct SensitiveBuf(Vec<u8>);

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

fn derive_key_argon2(passphrase: &str, salt: &[u8]) -> Result<Key<Aes256Gcm>> {
    let params = Params::new(ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST, Some(32))
        .map_err(|e| anyhow!("argon2 params error: {e}"))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key_buf = [0u8; 32];
    argon2
        .hash_password_into(passphrase.as_bytes(), salt, &mut key_buf)
        .map_err(|e| anyhow!("argon2 hash error: {e}"))?;
    let key = *Key::<Aes256Gcm>::from_slice(&key_buf);
    key_buf.zeroize();
    Ok(key)
}

/// Legacy PBKDF2 derivation — only used for decrypting V1-format blobs.
fn derive_key_pbkdf2(passphrase: &str, salt: &[u8]) -> Key<Aes256Gcm> {
    use sha2::Sha256;
    let key_material =
        pbkdf2::pbkdf2_hmac_array::<Sha256, 32>(passphrase.as_bytes(), salt, PBKDF2_ITERS);
    *Key::<Aes256Gcm>::from_slice(&key_material)
}

// ---------------------------------------------------------------------------
// Encrypt / Decrypt
// ---------------------------------------------------------------------------

fn encrypt(plaintext: &[u8], passphrase: &str, aad: Option<&str>) -> Result<Vec<u8>> {
    let mut salt = [0u8; SALT_LEN];
    rand::thread_rng().fill_bytes(&mut salt);

    let key = derive_key_argon2(passphrase, &salt)?;
    let cipher = Aes256Gcm::new(&key);

    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let aad_bytes = aad.unwrap_or("").as_bytes();
    let ciphertext = cipher
        .encrypt(nonce, Payload { msg: plaintext, aad: aad_bytes })
        .map_err(|e| anyhow!("encryption failed: {e}"))?;

    let mut out = Vec::with_capacity(8 + SALT_LEN + NONCE_LEN + ciphertext.len());
    out.extend_from_slice(MAGIC_V2);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

fn decrypt(blob: &[u8], passphrase: &str, aad: Option<&str>) -> Result<Vec<u8>> {
    let header_len = 8 + SALT_LEN + NONCE_LEN;
    if blob.len() < header_len {
        return Err(anyhow!("data too short or corrupt"));
    }

    let (magic, rest) = blob.split_at(8);
    let (salt, rest) = rest.split_at(SALT_LEN);
    let (nonce_bytes, ciphertext) = rest.split_at(NONCE_LEN);

    // Derive key with the appropriate KDF based on format version.
    let key = if magic == MAGIC_V2 {
        derive_key_argon2(passphrase, salt)?
    } else if magic == MAGIC_V1 {
        derive_key_pbkdf2(passphrase, salt)
    } else {
        return Err(anyhow!("invalid magic header"));
    };

    let cipher = Aes256Gcm::new(&key);
    let nonce = Nonce::from_slice(nonce_bytes);
    let aad_bytes = aad.unwrap_or("").as_bytes();

    let plaintext = cipher
        .decrypt(nonce, Payload { msg: ciphertext, aad: aad_bytes })
        .map_err(|e| anyhow!("decryption failed: {e}"))?;

    Ok(plaintext)
}

// ---------------------------------------------------------------------------
// TCP handler
// ---------------------------------------------------------------------------

async fn handle_connection(mut stream: tokio::net::TcpStream, addr: std::net::SocketAddr) {
    // Protocol: 4-byte big-endian length prefix + JSON payload.
    // Read length prefix
    let len = match stream.read_u32().await {
        Ok(n) => n as usize,
        Err(e) => {
            warn!("[{addr}] failed to read length: {e}");
            return;
        }
    };

    // Sanity cap: 256 MB
    if len > 256 * 1024 * 1024 {
        warn!("[{addr}] request too large: {len} bytes");
        let _ = write_response(&mut stream, Response {
            success: false,
            output: None,
            error: Some("request too large".into()),
        }).await;
        return;
    }

    let mut buf = vec![0u8; len];
    if let Err(e) = stream.read_exact(&mut buf).await {
        warn!("[{addr}] failed to read payload: {e}");
        return;
    }

    let mut req: Request = match serde_json::from_slice(&buf) {
        Ok(r) => r,
        Err(e) => {
            let _ = write_response(&mut stream, Response {
                success: false,
                output: None,
                error: Some(format!("invalid JSON: {e}")),
            }).await;
            return;
        }
    };

    // Decode base64 data
    let data = match B64.decode(&req.data) {
        Ok(d) => SensitiveBuf(d),
        Err(e) => {
            req.passphrase.zeroize();
            let _ = write_response(&mut stream, Response {
                success: false,
                output: None,
                error: Some(format!("invalid base64 data: {e}")),
            }).await;
            return;
        }
    };

    let result = match req.operation.as_str() {
        "encrypt" => encrypt(&data.0, &req.passphrase, req.aad.as_deref()),
        "decrypt" => decrypt(&data.0, &req.passphrase, req.aad.as_deref()),
        other => Err(anyhow!("unknown operation: {other}")),
    };

    // Zeroize passphrase immediately after use
    req.passphrase.zeroize();
    drop(data); // triggers ZeroizeOnDrop

    let resp = match result {
        Ok(output_bytes) => Response {
            success: true,
            output: Some(B64.encode(&output_bytes)),
            error: None,
        },
        Err(e) => Response {
            success: false,
            output: None,
            error: Some(e.to_string()),
        },
    };

    if let Err(e) = write_response(&mut stream, resp).await {
        warn!("[{addr}] failed to write response: {e}");
    }
}

async fn write_response(
    stream: &mut tokio::net::TcpStream,
    resp: Response,
) -> Result<()> {
    let json = serde_json::to_vec(&resp)?;
    stream.write_u32(json.len() as u32).await?;
    stream.write_all(&json).await?;
    stream.flush().await?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let addr = env::var("CRYPTO_LISTEN_ADDR").unwrap_or_else(|_| "127.0.0.1:9876".into());
    let listener = TcpListener::bind(&addr).await?;
    info!("blockvault_crypto daemon listening on {addr}");

    loop {
        let (stream, peer) = listener.accept().await?;
        tokio::spawn(async move {
            handle_connection(stream, peer).await;
        });
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_v2() {
        let plaintext = b"Test secret data \xe2\x98\x83";
        let pass = "example-passphrase";
        let aad = Some("meta");

        let encrypted = encrypt(plaintext, pass, aad).unwrap();
        assert_eq!(&encrypted[..8], MAGIC_V2);

        let decrypted = decrypt(&encrypted, pass, aad).unwrap();
        assert_eq!(&decrypted, plaintext);
    }

    #[test]
    fn wrong_passphrase_fails() {
        let encrypted = encrypt(b"secret", "correct", None).unwrap();
        let result = decrypt(&encrypted, "wrong", None);
        assert!(result.is_err());
    }

    #[test]
    fn bad_magic_fails() {
        let result = decrypt(b"BADMAGIC0000000000000000000000000000000", "pass", None);
        assert!(result.is_err());
    }

    #[test]
    fn too_short_fails() {
        let result = decrypt(b"short", "pass", None);
        assert!(result.is_err());
    }
}
