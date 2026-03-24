import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Download, FileText, AlertCircle, CheckCircle, Lock, Loader2, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiBase } from '@/lib/getApiBase';

/**
 * HKDF-SHA256 key derivation using Web Crypto API.
 * Mirrors the Python `wrap_file_key_with_hkdf` logic.
 */
async function deriveHKDFKey(secret: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      info: new TextEncoder().encode('blockvault-magic-link-v1'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt'],
  );
}

/**
 * AES-256-GCM decryption (nonce prepended to ciphertext).
 */
async function aesGcmDecrypt(key: CryptoKey, data: Uint8Array, aad: Uint8Array = new Uint8Array()): Promise<Uint8Array> {
  const nonce = data.slice(0, 12);
  const ciphertext = data.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: aad as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return new Uint8Array(decrypted);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

type AccessState = 'loading' | 'ready' | 'decrypting' | 'done' | 'error';
type ErrorType = 'expired' | 'invalid' | 'decryption' | 'general';

const SecureAccessPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<AccessState>('loading');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [errorType, setErrorType] = useState<ErrorType>('general');
  
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [shareData, setShareData] = useState<any>(null);

  const API_BASE = getApiBase();

  // Extract recipient_secret from URL fragment
  const getRecipientSecret = useCallback((): string | null => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return null;
    return hash.substring(1); // Remove the '#'
  }, []);

  // Step 1: Fetch share metadata
  useEffect(() => {
    if (!token) {
      setErrorType('invalid');
      setErrorMsg('Invalid access link. Please request a new one.');
      setState('error');
      return;
    }

    const secret = getRecipientSecret();
    if (!secret || secret.length < 32) {
      setErrorType('invalid');
      setErrorMsg('Invalid or missing decryption key in the link.');
      setState('error');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/access/${token}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const errCode = body.error || '';
          
          if (errCode === 'link_expired') {
            setErrorType('expired');
            setErrorMsg('Link expired — request a new access link');
          } else if (errCode === 'access_limit_reached' || errCode === 'revoked') {
            setErrorType('invalid');
            setErrorMsg('Invalid or revoked link');
          } else if (errCode === 'rate_limited') {
            setErrorType('general');
            setErrorMsg(body.message || 'Rate limit exceeded. Please try again later.');
          } else {
            setErrorType('general');
            setErrorMsg(body.message || `Access denied (${res.status})`);
          }
          throw new Error('handled');
        }
        
        const data = await res.json();
        setShareData(data);
        setFileName(data.file_name || 'Encrypted File');
        setFileSize(data.file_size || 0);
        setState('ready');
      } catch (err: any) {
        if (err.message !== 'handled') {
          setErrorType('general');
          setErrorMsg('Failed to load file details. The server may be unreachable.');
        }
        setState('error');
      }
    })();
  }, [token, API_BASE, getRecipientSecret]);

  // Step 2: Decrypt and download
  const handleDownload = async () => {
    if (!shareData) return;

    setState('decrypting');
    try {
      const secretHex = getRecipientSecret();
      if (!secretHex) throw new Error('Missing decryption key');

      let decryptedFile: Uint8Array;

      if (shareData.is_v2) {
        // E2EE Phase 1 (Chunked Web Worker Decryption)
        if (!shareData.presigned_url) throw new Error('No download URL available');
        const fileRes = await fetch(shareData.presigned_url);
        if (!fileRes.ok) throw new Error('Failed to download encrypted file');
        
        const blob = await fileRes.blob();
        const { decryptFileWithWorker } = await import('@/utils/cryptoWorker');
        const decryptResult = await decryptFileWithWorker(
          blob,
          shareData.recipient_encrypted_file_key,
          secretHex, // In V2, the fragment IS the PBKDF2 unwrapping passphrase
          shareData.aad
        );
        const arrayBuffer = await decryptResult.decryptedBlob.arrayBuffer();
        decryptedFile = new Uint8Array(arrayBuffer);
        
      } else {
        // Legacy Component (HKDF + Memory AES-GCM)
        const secret = hexToBytes(secretHex);

        // 1. Unwrap the HKDF-wrapped file key
        const wrappedRaw = base64ToBytes(shareData.recipient_encrypted_file_key);
        const salt = wrappedRaw.slice(0, 16);
        const encryptedKey = wrappedRaw.slice(16);

        const hkdfKey = await deriveHKDFKey(secret, salt);
        const fileKeyBytes = await aesGcmDecrypt(hkdfKey, encryptedKey);

        // 2. Fetch the encrypted file
        let encryptedFile: Uint8Array;
        if (shareData.presigned_url) {
          const fileRes = await fetch(shareData.presigned_url);
          if (!fileRes.ok) throw new Error('Failed to download encrypted file');
          encryptedFile = new Uint8Array(await fileRes.arrayBuffer());
        } else {
          throw new Error('No download URL available');
        }

        // 3. Decrypt the file with the file key
        const fileKey = await crypto.subtle.importKey(
          'raw',
          fileKeyBytes,
          { name: 'AES-GCM' },
          false,
          ['decrypt'],
        );
        
        const aad = new TextEncoder().encode(shareData.aad || '');
        const dec = await aesGcmDecrypt(fileKey, encryptedFile, aad);
        decryptedFile = new Uint8Array(dec as any);
      }

      // 4. Trigger download
      const blob = new Blob([decryptedFile as any]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Show success briefly, keep it there
      setState('done');
    } catch (err: any) {
      console.error('Decryption failed:', err);
      setErrorType('decryption');
      setErrorMsg('Unable to decrypt file securely. The link may have been tampered with or corrupted.');
      setState('error');
    }
  };

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-12 px-6 text-center"
          >
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full border-t-2 border-b-2 border-blue-500 animate-spin"></div>
              <div className="absolute inset-0 rounded-full border-l-2 border-r-2 border-indigo-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="w-5 h-5 text-zinc-400" />
              </div>
            </div>
            <h2 className="text-lg font-medium text-zinc-100 mb-2">Verifying secure access...</h2>
            <p className="text-sm text-zinc-400 max-w-xs">Checking permissions and preparing your file.</p>
          </motion.div>
        );

      case 'error':
        let ErrorIcon = AlertCircle;
        if (errorType === 'expired') ErrorIcon = AlertCircle;
        if (errorType === 'decryption') ErrorIcon = Key;
        
        return (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-12 px-6 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
              <ErrorIcon className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-medium text-zinc-100 mb-2">
              {errorType === 'expired' ? 'Link Expired' : 
               errorType === 'invalid' ? 'Access Denied' : 
               errorType === 'decryption' ? 'Decryption Failed' : 'Security Error'}
            </h2>
            <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">{errorMsg}</p>
          </motion.div>
        );

      case 'ready':
      case 'decrypting':
        const isDecrypting = state === 'decrypting';
        return (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="p-8"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">
                {isDecrypting ? 'Decrypting file securely...' : 'Secure File Ready'}
              </h2>
              <p className="text-sm text-zinc-400">
                {isDecrypting ? 'All decryption happens locally in your browser' : 'Your file has been found and is ready for local decryption'}
              </p>
            </div>

            {/* File Card */}
            <div className="relative group max-w-sm mx-auto mb-8">
              <div className={`absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-500 ${isDecrypting ? 'animate-pulse opacity-50' : ''}`}></div>
              <div className="relative flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-700/50">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate" title={fileName}>{fileName}</p>
                  <p className="text-xs text-zinc-500 mt-1">{formatFileSize(fileSize)}</p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="max-w-sm mx-auto mb-8">
              <button
                onClick={handleDownload}
                disabled={isDecrypting}
                className="relative w-full overflow-hidden rounded-xl bg-white text-zinc-900 shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-200 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2 py-3.5 px-4 text-sm font-semibold">
                  {isDecrypting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
                      Decrypting locally...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Decrypt & Download
                    </>
                  )}
                </div>
              </button>
            </div>

            {/* Security Indicators */}
            <div className="flex flex-col gap-3 max-w-sm mx-auto pt-6 border-t border-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-3 h-3 text-emerald-400" />
                </div>
                <p className="text-xs text-zinc-400 font-medium">End-to-end encrypted</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-3 h-3 text-blue-400" />
                </div>
                <p className="text-xs text-zinc-400 font-medium">Verified integrity</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-3 h-3 text-indigo-400" />
                </div>
                <p className="text-xs text-zinc-400 font-medium">Decrypted locally (Zero-Knowledge)</p>
              </div>
            </div>
          </motion.div>
        );

      case 'done':
        return (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-16 px-6 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-100 mb-2">Secure Download Complete</h2>
            <p className="text-sm text-zinc-400 max-w-xs leading-relaxed mb-6">
              The file was decrypted successfully and saved to your device.
            </p>
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <FileText className="w-4 h-4 text-zinc-400" />
              <p className="text-xs font-medium text-zinc-300 truncate max-w-[200px]" title={fileName}>{fileName}</p>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#060609] flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-indigo-500/30">
      
      {/* Dynamic Background subtle glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-xl mx-auto z-10">
        
        {/* Top Minimal Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 shadow-sm">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span className="text-[11px] font-medium text-zinc-300 tracking-wide uppercase">Opened via secure link</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/60 backdrop-blur-xl shadow-2xl overflow-hidden min-h-[400px] flex flex-col relative">
          
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
          
        </div>

        {/* Footer */}
        <div className="mt-8 text-center flex flex-col items-center gap-2">
          <p className="text-xs text-zinc-600 font-medium tracking-wide">
            Powered by BlockVault
          </p>
          <div className="flex gap-4">
            <a href="https://blockvault.io/security" className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">Security Architecture</a>
            <a href="https://blockvault.io/privacy" className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">Privacy Policy</a>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SecureAccessPage;
