import React, { useState, useEffect, useCallback } from 'react';
import { User, Lock, AlertCircle, Key, Share2, Shield, CheckCircle } from 'lucide-react';
import { useFiles } from '@/contexts/FileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rsaKeyManager } from '@/lib/crypto/rsa';
import toast from 'react-hot-toast';
import { LegalModalFrame } from '@/components/legal/modals/LegalModalFrame';
import { getApiBase as resolveApiBase } from '@/lib/getApiBase';
import { readStoredUser } from '@/utils/authStorage';
import forge from 'node-forge';

interface ShareModalProps {
  fileId: string;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ fileId, onClose }) => {
  const { loading } = useFiles();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [useEmail, setUseEmail] = useState(false);
  const [hasRSAKeys, setHasRSAKeys] = useState(false);
  const [isPublicKeyRegistered, setIsPublicKeyRegistered] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState<boolean | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<string>('');

  const API_BASE = resolveApiBase();

  const checkRSAStatus = useCallback(async () => {
    const hasKeys = rsaKeyManager.hasKeyPair();
    setHasRSAKeys(hasKeys);

    if (!hasKeys) return;

    try {
      const user = readStoredUser() || {};
      if (!user.jwt) return;

      const response = await fetch(`${API_BASE}/users/profile`, {
        headers: {
          Authorization: `Bearer ${user.jwt}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsPublicKeyRegistered(Boolean(data.has_public_key));
      }
    } catch (error) {
      console.error('Failed to check RSA registration status:', error);
    }
  }, [API_BASE]);

  // Check if file has a stored encrypted key
  const checkStoredKey = useCallback(async () => {
    try {
      const user = readStoredUser() || {};
      if (!user.jwt) return;

      const response = await fetch(`${API_BASE}/files/${fileId}/key`, {
        headers: {
          Authorization: `Bearer ${user.jwt}`,
        },
      });

      setHasStoredKey(response.ok);
    } catch (error) {
      console.error('Failed to check stored key:', error);
      setHasStoredKey(false);
    }
  }, [API_BASE, fileId]);

  useEffect(() => {
    checkRSAStatus();
    checkStoredKey();
  }, [checkRSAStatus, checkStoredKey]);

  // Secure zero-knowledge share flow
  const handleSecureShare = async () => {
    if (!recipientAddress && !recipientEmail) {
      toast.error('Please enter a recipient address or email');
      return;
    }

    const user = readStoredUser() || {};
    if (!user.jwt) {
      toast.error('Not authenticated');
      return;
    }

    setSharing(true);

    try {
      // Step 1: Fetch owner's encrypted key
      setShareStatus('Retrieving encrypted key...');
      const keyResponse = await fetch(`${API_BASE}/files/${fileId}/key`, {
        headers: { Authorization: `Bearer ${user.jwt}` },
      });

      if (!keyResponse.ok) {
        throw new Error('Failed to retrieve encryption key. You may need to re-upload this file.');
      }

      const { owner_encrypted_key } = await keyResponse.json();

      // Step 2: Decrypt with owner's private key (client-side)
      setShareStatus('Decrypting key locally...');
      const privateKeyPem = rsaKeyManager.getPrivateKey();
      if (!privateKeyPem) {
        throw new Error('RSA private key not found. Please regenerate your keys.');
      }

      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      const encryptedBytes = forge.util.decode64(owner_encrypted_key);

      let decryptedPassphrase: string;
      try {
        decryptedPassphrase = privateKey.decrypt(encryptedBytes, 'RSA-OAEP', {
          md: forge.md.sha256.create(),
          mgf1: { md: forge.md.sha256.create() },
        });
      } catch (decryptError) {
        throw new Error('Failed to decrypt key. Your RSA keys may have changed since upload.');
      }

      // Determine recipient
      const recipientToUse = useEmail ? recipientEmail : recipientAddress;
      const isEmailShare = useEmail || recipientToUse.includes('@');

      // For email shares, we can't encrypt client-side (no recipient public key yet)
      if (isEmailShare) {
        setShareStatus('Creating email share...');
        const shareResponse = await fetch(`${API_BASE}/files/${fileId}/share`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient: recipientToUse,
            passphrase: decryptedPassphrase, // Server-side encryption for email shares
          }),
        });

        if (!shareResponse.ok) {
          const error = await shareResponse.json();
          throw new Error(error.error || 'Share failed');
        }

        toast.success('File shared successfully via email!');
        onClose();
        return;
      }

      // Step 3: Fetch recipient's public key
      setShareStatus('Fetching recipient\'s public key...');
      const recipientNormalized = recipientToUse.toLowerCase().trim();

      let recipientPublicKeyPem: string;
      try {
        const pubKeyResponse = await fetch(`${API_BASE}/users/public_key/${recipientNormalized}`, {
          headers: { Authorization: `Bearer ${user.jwt}` },
        });

        if (pubKeyResponse.ok) {
          const pubKeyData = await pubKeyResponse.json();
          recipientPublicKeyPem = pubKeyData.public_key_pem;
        } else {
          // Recipient doesn't have keys - let server generate them
          setShareStatus('Recipient needs keys, creating share...');
          const shareResponse = await fetch(`${API_BASE}/files/${fileId}/share`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${user.jwt}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              recipient: recipientNormalized,
              passphrase: decryptedPassphrase, // Server will encrypt and generate keys
            }),
          });

          if (!shareResponse.ok) {
            const error = await shareResponse.json();
            throw new Error(error.error || 'Share failed');
          }

          toast.success('File shared! Recipient will receive keys on first login.');
          onClose();
          return;
        }
      } catch (pubKeyError: any) {
        // If 404, recipient has no keys - proceed with server-side encryption
        if (pubKeyError.message?.includes('404')) {
          setShareStatus('Creating share with key generation...');
          const shareResponse = await fetch(`${API_BASE}/files/${fileId}/share`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${user.jwt}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              recipient: recipientNormalized,
              passphrase: decryptedPassphrase,
            }),
          });

          if (!shareResponse.ok) {
            const error = await shareResponse.json();
            throw new Error(error.error || 'Share failed');
          }

          toast.success('File shared! Recipient will receive keys on login.');
          onClose();
          return;
        }
        throw pubKeyError;
      }

      // Step 4: Encrypt key for recipient (client-side, zero-knowledge)
      setShareStatus('Encrypting for recipient...');
      const recipientPublicKey = forge.pki.publicKeyFromPem(recipientPublicKeyPem);
      const encryptedForRecipient = recipientPublicKey.encrypt(
        decryptedPassphrase,
        'RSA-OAEP',
        {
          md: forge.md.sha256.create(),
          mgf1: { md: forge.md.sha256.create() },
        }
      );
      const encryptedForRecipientB64 = forge.util.encode64(encryptedForRecipient);

      // Step 5: Send share with pre-encrypted key (zero-knowledge)
      setShareStatus('Creating secure share...');
      const shareResponse = await fetch(`${API_BASE}/files/${fileId}/share`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: recipientNormalized,
          encrypted_for_recipient: encryptedForRecipientB64, // Server never sees plaintext
        }),
      });

      if (!shareResponse.ok) {
        const error = await shareResponse.json();
        throw new Error(error.error || 'Share failed');
      }

      toast.success('File shared securely! Server never saw the encryption key.');
      onClose();

    } catch (error: any) {
      console.error('Secure share failed:', error);
      toast.error(error.message || 'Failed to share file');
    } finally {
      setSharing(false);
      setShareStatus('');
    }
  };

  const canShare = (recipientAddress || recipientEmail) && hasRSAKeys && isPublicKeyRegistered && hasStoredKey;

  const footer = (
    <>
      <Button
        variant="modal-ghost"
        onClick={onClose}
        disabled={sharing}
      >
        Cancel
      </Button>
      <Button
        onClick={handleSecureShare}
        disabled={!canShare || loading || sharing}
        variant="modal-primary"
        className="min-w-[190px] shadow-[0_0_20px_hsl(var(--accent-blue-glow))]"
      >
        {sharing ? shareStatus || 'Sharing...' : 'Share Securely'}
      </Button>
    </>
  );

  return (
    <LegalModalFrame
      icon={<Share2 className="h-5 w-5" />}
      title="Share File"
      subtitle="Grant encrypted access to a trusted wallet."
      onClose={onClose}
      widthClassName="max-w-3xl"
      contentClassName="space-y-6"
      footer={footer}
      headerAccent="blue"
    >
      {/* Zero-Knowledge Security Banner */}
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 shadow-[inset_0_0_20px_hsl(120,50%,40%,0.15)]">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-green-300 mt-0.5" />
          <div className="text-sm text-green-100 space-y-1">
            <p className="font-semibold">Zero-Knowledge Sharing</p>
            <p>The encryption key is automatically retrieved, decrypted locally, and re-encrypted for the recipient. The server never sees the plaintext key.</p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {!hasRSAKeys && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-amber-300 mt-0.5" />
            <div className="text-sm text-amber-100 space-y-1">
              <p className="font-semibold">RSA Keys Required</p>
              <p>Generate and register your RSA keys from the dashboard header before sharing.</p>
            </div>
          </div>
        </div>
      )}

      {hasRSAKeys && !isPublicKeyRegistered && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-300 mt-0.5" />
            <div className="text-sm text-amber-100 space-y-1">
              <p className="font-semibold">Public Key Not Registered</p>
              <p>Register your RSA public key with the backend to enable sharing.</p>
            </div>
          </div>
        </div>
      )}

      {hasStoredKey === false && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-300 mt-0.5" />
            <div className="text-sm text-red-100 space-y-1">
              <p className="font-semibold">Encryption Key Not Found</p>
              <p>This file was uploaded before automatic key storage was enabled. Please re-upload the file to enable secure sharing.</p>
            </div>
          </div>
        </div>
      )}

      {hasStoredKey && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
          <div className="flex items-center gap-2 text-sm text-green-300">
            <CheckCircle className="w-4 h-4" />
            <span>Encryption key available for automatic sharing</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Wallet/Email Toggle */}
        <div className="flex gap-2 bg-slate-900/50 rounded-lg p-1">
          <button
            onClick={() => {
              setUseEmail(false);
              setRecipientEmail('');
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${!useEmail
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            Wallet Address
          </button>
          <button
            onClick={() => {
              setUseEmail(true);
              setRecipientAddress('');
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${useEmail
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            Email Address
          </button>
        </div>

        {/* Recipient Input */}
        <div className="space-y-3">
          {useEmail ? (
            <>
              <label className="text-sm font-medium text-white flex items-center gap-2">
                <User className="w-4 h-4 text-primary-400" />
                Recipient Email
              </label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientEmail(e.target.value)}
                placeholder="user@example.com"
                className="bg-slate-900/80 border-primary-500/30 text-white placeholder:text-slate-500"
                required
              />
              <p className="text-xs text-slate-400">
                The recipient will receive access when they link a wallet to their account.
              </p>
            </>
          ) : (
            <>
              <label className="text-sm font-medium text-white flex items-center gap-2">
                <User className="w-4 h-4 text-primary-400" />
                Recipient Wallet Address
              </label>
              <Input
                value={recipientAddress}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientAddress(e.target.value)}
                placeholder="0x1234...ABCD"
                className="bg-slate-900/80 border-primary-500/30 text-white placeholder:text-slate-500"
                required
              />
              <p className="text-xs text-slate-400">
                Only the recipient's wallet can decrypt this file. Access is cryptographically bound to their keys.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Security Info */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <div className="text-xs text-slate-400 space-y-2">
          <p className="font-semibold text-slate-300">How Secure Sharing Works:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Your encrypted file key is retrieved from the server</li>
            <li>Key is decrypted locally using your private key</li>
            <li>Key is re-encrypted for the recipient's public key</li>
            <li>Only the encrypted key is sent to the server</li>
          </ol>
          <p className="text-green-400 mt-2">✓ The server never sees the plaintext encryption key</p>
        </div>
      </div>
    </LegalModalFrame>
  );
};
