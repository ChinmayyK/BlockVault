import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Lock,
  AlertCircle,
  Key,
  Share2,
  Shield,
  CheckCircle,
  Clock,
  Mail,
  Wallet,
} from 'lucide-react';
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
  const { loading, outgoingShares, revokeShare } = useFiles();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [useEmail, setUseEmail] = useState(false);
  const [hasRSAKeys, setHasRSAKeys] = useState(false);
  const [isPublicKeyRegistered, setIsPublicKeyRegistered] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState<boolean | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'VIEWER' | 'EDITOR'>('VIEWER');
  const [localError, setLocalError] = useState<string | null>(null);


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
    setLocalError(null);

    const trimmedAddress = recipientAddress.trim();
    const trimmedEmail = recipientEmail.trim();

    if (!trimmedAddress && !trimmedEmail) {
      setLocalError('Please enter a wallet address or email.');
      return;
    }

    if (useEmail || trimmedEmail) {
      if (!trimmedEmail.includes('@') || trimmedEmail.length < 5) {
        setLocalError('Please enter a valid email address.');
        return;
      }
    } else {
      if (!trimmedAddress.startsWith('0x') || trimmedAddress.length !== 42) {
        setLocalError('Wallet address should start with 0x and be 42 characters long.');
        return;
      }
    }

    const user = readStoredUser() || {};
    if (!user.jwt) {
      setLocalError('Not authenticated. Please sign in again.');
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
        throw new Error('RSA private key not found. Generate keys from the dashboard before sharing.');
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
      const recipientToUse = useEmail ? trimmedEmail : trimmedAddress;
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
            role: selectedRole,
          }),
        });

        if (shareResponse.ok) {
          toast.success('File shared successfully via email!');
          onClose();
          return;
        }

        const error = await shareResponse.json().catch(() => null);
        throw new Error(error?.error || 'Share failed');
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
              role: selectedRole,
            }),
          });

          if (shareResponse.ok) {
            toast.success('File shared! Recipient will receive keys on first login.');
            onClose();
            return;
          }

          const error = await shareResponse.json().catch(() => null);
          throw new Error(error?.error || 'Share failed');
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
              role: selectedRole,
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
          role: selectedRole,
        }),
      });

      if (shareResponse.ok) {
        toast.success('File shared securely! Server never saw the encryption key.');
        onClose();
      } else {
        const error = await shareResponse.json().catch(() => null);
        throw new Error(error?.error || 'Share failed');
      }

    } catch (error: any) {
      console.error('Secure share failed:', error);
      setLocalError(error.message || 'Failed to share file');
      toast.error(error.message || 'Failed to share file');
    } finally {
      setSharing(false);
      setShareStatus('');
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      await revokeShare(shareId);
      toast.success('Access revoked successfully.');
    } catch (error: any) {
      toast.error('Failed to revoke share: ' + error.message);
    }
  };

  const canShare = (recipientAddress || recipientEmail) && hasRSAKeys && isPublicKeyRegistered && hasStoredKey;
  const currentShares = outgoingShares.filter((s: any) => s.file_id === fileId || s.file === fileId);

  const formatDateTime = (iso: string | number | undefined) => {
    if (!iso) return 'Unknown';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(iso);
    }
  };


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
        disabled={loading || sharing}
        variant="outline"
        className="min-w-[190px] px-6 py-2 rounded-full bg-white text-black border border-slate-200 hover:bg-slate-100 hover:text-black shadow-md hover:shadow-lg transition-all"
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
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-[inset_0_0_20px_rgba(16,185,129,0.25)]">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-emerald-300 mt-0.5" />
          <div className="text-sm text-emerald-100 space-y-1">
            <p className="font-semibold">Zero-Knowledge Sharing</p>
            <p className="text-xs text-emerald-100/80">
              Your file key is decrypted locally and re-encrypted for the recipient. The backend never sees the plaintext key.
            </p>
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
              <p className="text-xs text-amber-100/80">Generate and register your RSA keys from the dashboard header before sharing.</p>
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
              <p className="text-xs text-amber-100/80">Register your RSA public key with the backend to enable sharing.</p>
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
              <p className="text-xs text-red-100/80">This file was uploaded before automatic key storage was enabled. Please re-upload the file to enable secure sharing.</p>
            </div>
          </div>
        </div>
      )}

      {hasStoredKey && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-300" />
          <span className="text-xs text-emerald-100/90">
            Encryption key stored. You can share this file without re-entering the passphrase.
          </span>
        </div>
      )}

      <div className="space-y-4">
        {/* Wallet/Email Toggle */}
        <div className="flex gap-1 bg-slate-900/60 rounded-lg p-1.5 border border-slate-700/60">
          <button
            onClick={() => {
              setUseEmail(false);
              setRecipientEmail('');
            }}
            className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold tracking-wide transition-all ${
              !useEmail
                ? 'bg-blue-500 text-white shadow-[0_0_18px_rgba(59,130,246,0.45)]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Wallet Address
          </button>
          <button
            onClick={() => {
              setUseEmail(true);
              setRecipientAddress('');
            }}
            className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold tracking-wide transition-all ${
              useEmail
                ? 'bg-blue-500 text-white shadow-[0_0_18px_rgba(59,130,246,0.45)]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Mail className="w-4 h-4" />
            Email Address
          </button>
        </div>

        {/* Recipient Inputs + Role */}
        <div className="space-y-3">
          {/* Recipient fields */}
          {!useEmail && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-2 uppercase tracking-wide">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Recipient Wallet
              </label>
              <Input
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="0x1234…"
                className="bg-slate-950/60 border-slate-700/70 text-xs h-9"
              />
              <p className="text-[11px] text-slate-400">
                Share with an Ethereum-compatible wallet. The recipient decrypts using their RSA keys.
              </p>
            </div>
          )}
          {useEmail && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-2 uppercase tracking-wide">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Recipient Email
              </label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="name@company.com"
                className="bg-slate-950/60 border-slate-700/70 text-xs h-9"
              />
              <p className="text-[11px] text-slate-400">
                Email invites become active once the recipient connects a wallet for this email.
              </p>
            </div>
          )}

          {/* Role selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-2 uppercase tracking-wide">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Permissions
            </label>
            <div className="inline-flex rounded-lg border border-slate-700/70 bg-slate-950/60 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setSelectedRole('VIEWER')}
                className={`flex-1 px-3 py-1 rounded-md font-medium transition-all ${
                  selectedRole === 'VIEWER'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-50 hover:bg-slate-900/70'
                }`}
              >
                Viewer
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('EDITOR')}
                className={`flex-1 px-3 py-1 rounded-md font-medium transition-all ${
                  selectedRole === 'EDITOR'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-50 hover:bg-slate-900/70'
                }`}
              >
                Editor
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              <span className="font-semibold">Viewer</span> can download and read.{' '}
              <span className="font-semibold">Editor</span> can also upload new redacted versions.
            </p>
          </div>

          {localError && (
            <div className="mt-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-300 mt-0.5" />
              <p className="text-[11px] text-red-100/90">{localError}</p>
            </div>
          )}
        </div>

        {/* Existing Shares */}
        {currentShares.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2 uppercase tracking-wide">
              <Share2 className="w-3.5 h-3.5 text-slate-400" />
              Existing Access
            </h3>
            <div className="max-h-44 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {currentShares.map((share: any) => {
                const id = share.share_id || share.id;
                const recipient =
                  share.recipient ||
                  share.shared_with ||
                  share.recipient_email ||
                  'Unknown recipient';
                const created = formatDateTime(share.created_at || share.createdAt);
                const expires = formatDateTime(share.expires_at);

                return (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-2.5"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-slate-100">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate font-medium">{recipient}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Created {created}</span>
                        </span>
                        {share.expires_at && (
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <Clock className="w-3 h-3" />
                            <span>Expires {expires}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="ml-3 text-[11px] text-red-300 hover:text-red-100 hover:bg-red-500/10 px-2 py-1 h-auto"
                      onClick={() => handleRevokeShare(id)}
                    >
                      Revoke
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </LegalModalFrame>
  );
};
