/// <reference lib="webworker" />

// ---------------------------------------------------------------------------
// BlockVault Crypto Worker
// ---------------------------------------------------------------------------
// Handles heavy cryptographic operations securely off the main UI thread.
// Implements chunked AES-GCM encryption to prevent out-of-memory crashes
// on large files, and PBKDF2 for secure key wrapping.

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
const MAGIC_HEADER = new Uint8Array([0x42, 0x56, 0x31, 0x00]); // "BV1\0"

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

// Generate a random string for recovery key
function generateRecoveryKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomValues = new Uint32Array(16);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 16; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return `${result.slice(0, 4)}-${result.slice(4, 8)}-${result.slice(8, 12)}-${result.slice(12, 16)}`;
}

// Derive a KEK (Key Encryption Key) using PBKDF2
async function deriveKeyWithPBKDF2(passphrase: string, salt: BufferSource): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 250000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Wrap a file key with a given passphrase
async function wrapKey(fileKeyBytes: Uint8Array, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKeyWithPBKDF2(passphrase, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const wrappedKeyBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    kek,
    fileKeyBytes as BufferSource
  );
  
  // Format: Base64( salt + iv + wrappedKey )
  const combined = concatBytes(salt, iv, new Uint8Array(wrappedKeyBuffer));
  // Standard btoa needs strings
  const binStr = Array.from(combined).map(b => String.fromCharCode(b)).join('');
  return btoa(binStr);
}

// Unwrap a file key
async function unwrapKey(wrappedBase64: string, passphrase: string): Promise<Uint8Array> {
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
    { name: 'AES-GCM', iv },
    kek,
    wrappedKey as BufferSource
  );
  return new Uint8Array(fileKeyBuffer);
}

// ---------------------------------------------------------------------------
// Main Worker Handlers
// ---------------------------------------------------------------------------

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, jobId } = e.data;

  try {
    if (type === 'ENCRYPT_FILE') {
      const { file, passphrase, aad } = payload;
      
      // 1. Generate 256-bit Random File Key
      const fileKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const fileKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', fileKey));
      
      // 2. Generate Recovery Key
      const recoveryKey = generateRecoveryKey();

      // 3. Wrap Keys
      self.postMessage({ type: 'PROGRESS', jobId, progress: 5, message: 'Deriving keys...' });
      const passphraseWrapped = await wrapKey(fileKeyBytes, passphrase);
      const recoveryWrapped = await wrapKey(fileKeyBytes, recoveryKey);
      
      self.postMessage({ type: 'PROGRESS', jobId, progress: 15, message: 'Processing chunks...' });
      
      // 4. Encrypt File in Chunks
      const totalSize = file.size;
      const chunksData: BlobPart[] = [MAGIC_HEADER];
      const aadBytes = aad ? new TextEncoder().encode(aad) : new Uint8Array();
      
      let offset = 0;
      while (offset < totalSize) {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const arrayBuffer = await slice.arrayBuffer();
        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedChunk = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv, additionalData: aadBytes },
          fileKey,
          arrayBuffer as BufferSource
        );
        
        // Structure: [ IV (12) + Length (4) + Ciphertext+Tag ]
        const lenBuffer = new ArrayBuffer(4);
        new DataView(lenBuffer).setUint32(0, encryptedChunk.byteLength, false); // Big endian
        
        chunksData.push(iv, new Uint8Array(lenBuffer), new Uint8Array(encryptedChunk));
        
        offset += CHUNK_SIZE;
        const percent = 15 + Math.round((offset / totalSize) * 80);
        self.postMessage({ type: 'PROGRESS', jobId, progress: Math.min(percent, 95) });
      }
      
      const encryptedBlob = new Blob(chunksData, { type: 'application/octet-stream' });
      
      self.postMessage({
        type: 'SUCCESS',
        jobId,
        result: {
          encryptedBlob,
          wrappedKeys: {
            passphrase: passphraseWrapped,
            recovery: recoveryWrapped
          },
          recoveryKey
        }
      });
      
    } else if (type === 'DECRYPT_FILE') {
      const { encryptedBlob, wrappedKey, passphrase, aad } = payload;
      
      // 1. Unwrap the File Key
      self.postMessage({ type: 'PROGRESS', jobId, progress: 10, message: 'Unwrapping key...' });
      const fileKeyBytes = await unwrapKey(wrappedKey, passphrase);
      const fileKey = await crypto.subtle.importKey(
        'raw', fileKeyBytes, { name: 'AES-GCM' }, false, ['decrypt']
      );
      
      const buffer = await encryptedBlob.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      
      // Check magic header to see if it's the new chunked format
      const hasMagic = buffer.byteLength > 4 && 
                       uint8[0] === MAGIC_HEADER[0] && 
                       uint8[1] === MAGIC_HEADER[1] &&
                       uint8[2] === MAGIC_HEADER[2] && 
                       uint8[3] === MAGIC_HEADER[3];
                       
      let decryptedChunks: Uint8Array[] = [];
      const aadBytes = aad ? new TextEncoder().encode(aad) : new Uint8Array();
                       
      if (hasMagic) {
         // Chunked Decryption
         let offset = 4; // Skip magic
         const totalDecSize = buffer.byteLength;
         
         while (offset < totalDecSize) {
           const iv = uint8.slice(offset, offset + 12);
           offset += 12;
           const chunkLen = new DataView(buffer).getUint32(offset, false);
           offset += 4;
           const chunkData = uint8.slice(offset, offset + chunkLen);
           offset += chunkLen;
           
           const decrypted = await crypto.subtle.decrypt(
             { name: 'AES-GCM', iv, additionalData: aadBytes },
             fileKey,
             chunkData as BufferSource
           );
           decryptedChunks.push(new Uint8Array(decrypted));
           
           self.postMessage({ 
             type: 'PROGRESS', 
             jobId, 
             progress: 10 + Math.round((offset / totalDecSize) * 80) 
           });
         }
      } else {
         // Legacy Decryption (Single Block)
         // Assuming standard format: [ IV (12) + Ciphertext+Tag ]
         const iv = uint8.slice(0, 12);
         const data = uint8.slice(12);
         self.postMessage({ type: 'PROGRESS', jobId, progress: 40 });
         
         const decrypted = await crypto.subtle.decrypt(
           { name: 'AES-GCM', iv, additionalData: aadBytes },
           fileKey,
           data as BufferSource
         );
         decryptedChunks.push(new Uint8Array(decrypted));
      }
      
      const fileBlob = new Blob(decryptedChunks as BlobPart[]);
      self.postMessage({
        type: 'SUCCESS',
        jobId,
        result: { decryptedBlob: fileBlob }
      });
      
    } else if (type === 'WRAP_VAULT_KEY') {
      const { passphrase } = payload;
      
      // 1. Generate new 256-bit Vault Key
      const vaultKeyRaw = crypto.getRandomValues(new Uint8Array(32));
      const vaultKeyHex = Array.from(vaultKeyRaw).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // 2. Wrap Vault Key with Master Passphrase
      const wrappedVaultKeyB64 = await wrapKey(vaultKeyRaw, passphrase);
      
      self.postMessage({
        type: 'SUCCESS',
        jobId,
        result: { vaultKey: vaultKeyHex, wrappedVaultKey: wrappedVaultKeyB64 }
      });
      
    } else if (type === 'UNWRAP_VAULT_KEY') {
      const { wrappedVaultKey, passphrase } = payload;
      
      // Unwrap Vault Key
      const vaultKeyRaw = await unwrapKey(wrappedVaultKey, passphrase);
      const vaultKeyHex = Array.from(new Uint8Array(vaultKeyRaw)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      self.postMessage({
        type: 'SUCCESS',
        jobId,
        result: { vaultKey: vaultKeyHex }
      });
      
    } else if (type === 'WRAP_WORKSPACE_KEY') {
      const { vaultKey, workspaceKey } = payload;
      
      // If no workspaceKey provided, generate a new one
      let wsKeyRaw: Uint8Array;
      let wsKeyHex: string;
      if (workspaceKey) {
        // Assume hex input
        wsKeyRaw = new Uint8Array(workspaceKey.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
        wsKeyHex = workspaceKey;
      } else {
        wsKeyRaw = crypto.getRandomValues(new Uint8Array(32));
        wsKeyHex = Array.from(wsKeyRaw).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      
      // Wrap Workspace Key with Vault Key
      const wrappedWorkspaceKeyB64 = await wrapKey(wsKeyRaw, vaultKey);
      
      self.postMessage({
        type: 'SUCCESS',
        jobId,
        result: { workspaceKey: wsKeyHex, wrappedWorkspaceKey: wrappedWorkspaceKeyB64 }
      });

    } else if (type === 'UNWRAP_WORKSPACE_KEY') {
      const { wrappedWorkspaceKey, vaultKey } = payload;
      
      // Unwrap Workspace Key
      const wsKeyRaw = await unwrapKey(wrappedWorkspaceKey, vaultKey);
      const wsKeyHex = Array.from(new Uint8Array(wsKeyRaw)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      self.postMessage({
        type: 'SUCCESS',
        jobId,
        result: { workspaceKey: wsKeyHex }
      });
    }
  } catch (err: any) {
    self.postMessage({
      type: 'ERROR',
      jobId,
      error: err.message || 'Unknown cryptographic error in worker'
    });
  }
};
