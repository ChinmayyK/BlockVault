"""
Key recovery and wrapping module for BlockVault.

Provides functions to generate file keys, wrap/unwrap them via distinct methods
(passphrase, recovery key, wallet), and encrypt/decrypt file payloads using AES-256-GCM.
"""
import base64
import os
import secrets
from typing import Dict, Tuple

import argon2
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from ecies import encrypt as ecies_encrypt, decrypt as ecies_decrypt

# ---------------------------------------------------------------------------
# Argon2 Configuration
# ---------------------------------------------------------------------------
# Tuned for moderate security vs performance on a web backend.
# production config could increase iterations and memory cost.
_ARGON2_HASHER = argon2.PasswordHasher(
    time_cost=2,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=16
)


# ---------------------------------------------------------------------------
# File Key Operations
# ---------------------------------------------------------------------------

def generate_file_key() -> bytes:
    """Generate a random 32-byte AES-256 key for file encryption."""
    return os.urandom(32)

def generate_recovery_key() -> str:
    """Generate a random base32 encoded recovery key for user display."""
    # 16 bytes = 128 bits of entropy.
    raw = os.urandom(16)
    b32 = base64.b32encode(raw).decode('ascii').strip('=')
    # Format e.g. ZXA9-72BC-44D1-AF92
    return f"{b32[:4]}-{b32[4:8]}-{b32[8:12]}-{b32[12:16]}"


# ---------------------------------------------------------------------------
# Authenticated Encryption with AES-GCM
# ---------------------------------------------------------------------------

def encrypt_with_aes_gcm(key: bytes, plaintext: bytes, aad: bytes = b"") -> bytes:
    """Encrypt payload using AES-256-GCM directly in Python."""
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext, aad)
    return nonce + ciphertext

def decrypt_with_aes_gcm(key: bytes, ciphertext_with_nonce: bytes, aad: bytes = b"") -> bytes:
    """Decrypt payload using AES-256-GCM. Expects prepended 12-byte nonce."""
    nonce = ciphertext_with_nonce[:12]
    ciphertext = ciphertext_with_nonce[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, aad)


# ---------------------------------------------------------------------------
# Passphrase Wrapping
# ---------------------------------------------------------------------------

def _derive_argon2_key(secret: str, salt: bytes) -> bytes:
    """Internal helper to derive a 32-byte key from a secret and salt."""
    return argon2.low_level.hash_secret_raw(
        secret=secret.encode("utf-8"),
        salt=salt,
        time_cost=_ARGON2_HASHER.time_cost,
        memory_cost=_ARGON2_HASHER.memory_cost,
        parallelism=_ARGON2_HASHER.parallelism,
        hash_len=_ARGON2_HASHER.hash_len,
        type=argon2.low_level.Type.ID,
    )

def wrap_file_key_with_passphrase(file_key: bytes, passphrase: str) -> Tuple[str, str]:
    """Wrap a file key using a key derived from a passphrase via Argon2.
    
    Returns:
        (argon2_salt_b64, wrapped_key_b64)
    """
    salt = os.urandom(16)
    derived_key = _derive_argon2_key(passphrase, salt)
    wrapped = encrypt_with_aes_gcm(derived_key, file_key)
    
    return base64.b64encode(salt).decode("ascii"), base64.b64encode(wrapped).decode("ascii")

def unwrap_file_key_with_passphrase(wrapped_key_b64: str, passphrase: str, salt_b64: str) -> bytes:
    """Unwrap a file key using a passphrase."""
    try:
        salt = base64.b64decode(salt_b64)
        wrapped_key = base64.b64decode(wrapped_key_b64)
    except Exception as e:
        raise ValueError(f"Invalid base64 encoding for salt or wrapped key: {e}")
        
    derived_key = _derive_argon2_key(passphrase, salt)
    
    try:
        return decrypt_with_aes_gcm(derived_key, wrapped_key)
    except Exception as e:
        raise ValueError("Decryption failed. Incorrect passphrase or corrupted data.") from e


# ---------------------------------------------------------------------------
# Recovery Key Wrapping
# ---------------------------------------------------------------------------

def wrap_file_key_with_recovery_key(file_key: bytes, recovery_key: str) -> Tuple[str, str]:
    """Wrap a file key using a key derived from the recovery key via Argon2.
    
    Returns:
        (recovery_salt_b64, wrapped_recovery_key_b64)
    """
    # Simply reuse the Argon2 helper but with the recovery key as the secret.
    return wrap_file_key_with_passphrase(file_key, recovery_key)

def unwrap_file_key_with_recovery_key(wrapped_key_b64: str, recovery_key: str, salt_b64: str) -> bytes:
    """Unwrap a file key using the recovery key."""
    # Wrapping mechanism is identical to the passphrase wrapper.
    try:
        return unwrap_file_key_with_passphrase(wrapped_key_b64, recovery_key, salt_b64)
    except ValueError:
        raise ValueError("Decryption failed. Incorrect recovery key.")


# ---------------------------------------------------------------------------
# Wallet Wrapping
# ---------------------------------------------------------------------------

def wrap_file_key_with_wallet(file_key: bytes, pubkey_hex: str) -> str:
    """Wrap the file using ECIES to the user's Ethereum public key.
    
    Returns the ECIES ciphertext encoded as base64.
    """
    # Clean pubkey format
    if pubkey_hex.startswith('0x'):
        pubkey_hex = pubkey_hex[2:]
        
    wrapped = ecies_encrypt(pubkey_hex, file_key)
    return base64.b64encode(wrapped).decode("ascii")

def unwrap_file_key_with_wallet(wrapped_key_b64: str, private_key_hex: str) -> bytes:
    """Unwrap the file key using the user's Ethereum private key via ECIES."""
    if private_key_hex.startswith('0x'):
        private_key_hex = private_key_hex[2:]
        
    try:
        wrapped_key = base64.b64decode(wrapped_key_b64)
        return ecies_decrypt(private_key_hex, wrapped_key)
    except Exception as e:
        raise ValueError("ECIES decryption failed. Incorrect private key.") from e
