/**
 * Tests for the core cryptographic primitives used by BlockVault.
 *
 * These tests validate the Web Crypto API operations used in the
 * crypto worker: PBKDF2 key derivation, AES-GCM encrypt/decrypt,
 * and key wrapping/unwrapping roundtrips.
 */
import { describe, it, expect, beforeAll } from "vitest";

// ---------------------------------------------------------------------------
// Re-implement the worker's crypto helpers for testability
// (The worker file uses `self.onmessage` which can't be imported directly)
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 5 * 1024 * 1024;
const MAGIC_HEADER = new Uint8Array([0x42, 0x56, 0x31, 0x00]);

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g)!;
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

async function deriveKeyWithPBKDF2(
  passphrase: string,
  salt: BufferSource
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function wrapKey(
  fileKeyBytes: Uint8Array,
  passphrase: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKeyWithPBKDF2(passphrase, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKeyBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    kek,
    fileKeyBytes
  );
  const combined = concatBytes(salt, iv, new Uint8Array(wrappedKeyBuffer));
  const binStr = Array.from(combined)
    .map((b) => String.fromCharCode(b))
    .join("");
  return btoa(binStr);
}

async function unwrapKey(
  wrappedBase64: string,
  passphrase: string
): Promise<Uint8Array> {
  const binStr = atob(wrappedBase64);
  const combined = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    combined[i] = binStr.charCodeAt(i);
  }
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const wrappedKey = combined.slice(28);
  const kek = await deriveKeyWithPBKDF2(passphrase, salt);
  const fileKeyBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    kek,
    wrappedKey
  );
  return new Uint8Array(fileKeyBuffer);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Crypto Primitives", () => {
  describe("concatBytes", () => {
    it("concatenates empty arrays", () => {
      const result = concatBytes(new Uint8Array(0), new Uint8Array(0));
      expect(result.length).toBe(0);
    });

    it("concatenates multiple arrays correctly", () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([4, 5]);
      const c = new Uint8Array([6]);
      const result = concatBytes(a, b, c);
      expect(Array.from(result)).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe("bytesToHex / hexToBytes", () => {
    it("roundtrips correctly", () => {
      const original = new Uint8Array([0, 127, 255, 16, 1]);
      const hex = bytesToHex(original);
      const recovered = hexToBytes(hex);
      expect(Array.from(recovered)).toEqual(Array.from(original));
    });

    it("produces lowercase hex", () => {
      const bytes = new Uint8Array([0xab, 0xcd, 0xef]);
      expect(bytesToHex(bytes)).toBe("abcdef");
    });
  });

  describe("PBKDF2 Key Derivation", () => {
    it("derives a key from passphrase and salt", async () => {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKeyWithPBKDF2("test-passphrase", salt);
      expect(key).toBeDefined();
      expect(key.type).toBe("secret");
    });

    it("derives same key for same passphrase+salt", async () => {
      const salt = new Uint8Array(16).fill(42);
      const key1 = await deriveKeyWithPBKDF2("same-pass", salt);
      const key2 = await deriveKeyWithPBKDF2("same-pass", salt);

      // Export raw key bytes to compare
      // Note: keys are non-extractable, so we test by encrypting/decrypting
      const iv = new Uint8Array(12).fill(0);
      const data = new Uint8Array([1, 2, 3, 4]);
      const enc = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key1,
        data
      );
      const dec = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key2,
        enc
      );
      expect(Array.from(new Uint8Array(dec))).toEqual([1, 2, 3, 4]);
    });

    it("derives different key for different passphrase", async () => {
      const salt = new Uint8Array(16).fill(42);
      const key1 = await deriveKeyWithPBKDF2("pass-a", salt);
      const key2 = await deriveKeyWithPBKDF2("pass-b", salt);

      const iv = new Uint8Array(12).fill(0);
      const data = new Uint8Array([1, 2, 3, 4]);
      const enc = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key1,
        data
      );

      await expect(
        crypto.subtle.decrypt({ name: "AES-GCM", iv }, key2, enc)
      ).rejects.toThrow();
    });
  });

  describe("Key Wrapping Roundtrip", () => {
    it("wrap/unwrap returns the original key bytes", async () => {
      const fileKey = crypto.getRandomValues(new Uint8Array(32));
      const passphrase = "my-secure-passphrase";

      const wrapped = await wrapKey(fileKey, passphrase);
      expect(typeof wrapped).toBe("string");
      expect(wrapped.length).toBeGreaterThan(0);

      const unwrapped = await unwrapKey(wrapped, passphrase);
      expect(Array.from(unwrapped)).toEqual(Array.from(fileKey));
    });

    it("unwrap fails with wrong passphrase", async () => {
      const fileKey = crypto.getRandomValues(new Uint8Array(32));
      const wrapped = await wrapKey(fileKey, "correct-pass");

      await expect(unwrapKey(wrapped, "wrong-pass")).rejects.toThrow();
    });

    it("handles edge case: empty passphrase", async () => {
      const fileKey = crypto.getRandomValues(new Uint8Array(32));
      const wrapped = await wrapKey(fileKey, "");
      const unwrapped = await unwrapKey(wrapped, "");
      expect(Array.from(unwrapped)).toEqual(Array.from(fileKey));
    });

    it("produces different wrapped output each time (random salt/iv)", async () => {
      const fileKey = new Uint8Array(32).fill(99);
      const pass = "same-pass";
      const w1 = await wrapKey(fileKey, pass);
      const w2 = await wrapKey(fileKey, pass);
      // Both should unwrap to the same key
      expect(Array.from(await unwrapKey(w1, pass))).toEqual(
        Array.from(await unwrapKey(w2, pass))
      );
      // But the wrapped representations should differ (random salt)
      expect(w1).not.toBe(w2);
    });
  });

  describe("AES-GCM Encrypt/Decrypt", () => {
    it("encrypts and decrypts small data", async () => {
      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode("Hello BlockVault!");

      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        plaintext
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
      );

      expect(new TextDecoder().decode(decrypted)).toBe("Hello BlockVault!");
    });

    it("encrypt with AAD and decrypt with same AAD succeeds", async () => {
      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const aad = new TextEncoder().encode("file-id-123");
      const plaintext = new TextEncoder().encode("secret data");

      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: aad },
        key,
        plaintext
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: aad },
        key,
        ciphertext
      );

      expect(new TextDecoder().decode(decrypted)).toBe("secret data");
    });

    it("decrypt with wrong AAD fails", async () => {
      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const aad = new TextEncoder().encode("correct-aad");
      const wrongAad = new TextEncoder().encode("wrong-aad");
      const plaintext = new TextEncoder().encode("secret");

      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: aad },
        key,
        plaintext
      );

      await expect(
        crypto.subtle.decrypt(
          { name: "AES-GCM", iv, additionalData: wrongAad },
          key,
          ciphertext
        )
      ).rejects.toThrow();
    });
  });

  describe("MAGIC_HEADER", () => {
    it("is BV1\\0", () => {
      expect(MAGIC_HEADER[0]).toBe(0x42); // 'B'
      expect(MAGIC_HEADER[1]).toBe(0x56); // 'V'
      expect(MAGIC_HEADER[2]).toBe(0x31); // '1'
      expect(MAGIC_HEADER[3]).toBe(0x00); // '\0'
    });
  });

  describe("Full Encrypt/Decrypt Pipeline", () => {
    it("encrypts with chunked format and decrypts back", async () => {
      const fileKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      const fileKeyBytes = new Uint8Array(
        await crypto.subtle.exportKey("raw", fileKey)
      );

      // Simulate encrypting a small "file"
      const plaintext = new TextEncoder().encode(
        "This is a test document for BlockVault versioning."
      );
      const aadBytes = new TextEncoder().encode("test-aad");

      // Encrypt
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: aadBytes },
        fileKey,
        plaintext
      );

      // Build chunked format: MAGIC + IV + LEN + CIPHERTEXT
      const lenBuffer = new ArrayBuffer(4);
      new DataView(lenBuffer).setUint32(0, encrypted.byteLength, false);
      const blob = concatBytes(
        MAGIC_HEADER,
        iv,
        new Uint8Array(lenBuffer),
        new Uint8Array(encrypted)
      );

      // Decrypt (parse chunked format)
      expect(blob[0]).toBe(0x42);
      expect(blob[1]).toBe(0x56);

      let offset = 4; // skip magic
      const decIv = blob.slice(offset, offset + 12);
      offset += 12;
      const chunkLen = new DataView(blob.buffer).getUint32(offset, false);
      offset += 4;
      const chunkData = blob.slice(offset, offset + chunkLen);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decIv, additionalData: aadBytes },
        fileKey,
        chunkData
      );

      expect(new TextDecoder().decode(decrypted)).toBe(
        "This is a test document for BlockVault versioning."
      );
    });

    it("key wrap roundtrip works end-to-end", async () => {
      // 1. Generate a file key
      const fileKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      const fileKeyBytes = new Uint8Array(
        await crypto.subtle.exportKey("raw", fileKey)
      );

      // 2. Wrap with passphrase
      const passphrase = "my-strong-passphrase-123!";
      const wrapped = await wrapKey(fileKeyBytes, passphrase);

      // 3. Unwrap
      const recoveredBytes = await unwrapKey(wrapped, passphrase);

      // 4. Import recovered key and verify it works
      const recoveredKey = await crypto.subtle.importKey(
        "raw",
        recoveredBytes,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      // 5. Encrypt with original, decrypt with recovered
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode("roundtrip test");
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        fileKey,
        plaintext
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        recoveredKey,
        ciphertext
      );

      expect(new TextDecoder().decode(decrypted)).toBe("roundtrip test");
    });
  });
});
