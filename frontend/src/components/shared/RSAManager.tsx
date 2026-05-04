import React, { useState, useEffect, useCallback } from 'react';
import { Key, Shield, AlertCircle, CheckCircle, Download, Trash2 } from 'lucide-react';
import { rsaKeyManager } from '@/lib/crypto/rsa';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { getApiBase as resolveApiBase } from '@/lib/getApiBase';
import { readStoredUser } from '@/utils/authStorage';
import { LegalModalFrame } from '@/components/legal/modals/LegalModalFrame';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface RSAManagerProps {
  onClose: () => void;
}

export const RSAManager: React.FC<RSAManagerProps> = ({ onClose }) => {
  const [hasKeys, setHasKeys] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const API_BASE = resolveApiBase();

  const checkRegistrationStatus = useCallback(async () => {
    try {
      const user = readStoredUser() || {};
      if (!user.jwt) return;

      const response = await fetch(`${API_BASE}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${user.jwt}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsRegistered(data.has_public_key);
      }
    } catch (error) {
      console.error('Failed to check registration status:', error);
    }
  }, []);

  const checkKeyStatus = useCallback(async () => {
    const hasLocalKeys = rsaKeyManager.hasKeyPair();
    setHasKeys(hasLocalKeys);
    
    if (hasLocalKeys) {
      const keyPair = rsaKeyManager.getKeyPair();
      setPublicKey(keyPair?.publicKey || null);
      
      // Check if public key is registered on server
      await checkRegistrationStatus();
    }
  }, [checkRegistrationStatus]);

  useEffect(() => {
    checkKeyStatus();
  }, [checkKeyStatus]);

  const generateKeys = async () => {
    try {
      setLoading(true);
      const keyPair = rsaKeyManager.generateKeyPair();
      setHasKeys(true);
      setPublicKey(keyPair.publicKey);
      
      // Automatically register the public key with the backend
      const user = readStoredUser() || {};
      if (user.jwt) {
        try {
          const response = await fetch(`${API_BASE}/users/public_key`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${user.jwt}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              public_key_pem: keyPair.publicKey,
            }),
          });

          if (response.ok) {
            setIsRegistered(true);
            toast.success('RSA keys generated and registered successfully!');
          } else {
            setIsRegistered(false);
            const error = await response.text();
            console.error('Failed to auto-register public key:', error);
            toast('⚠️ Keys generated but registration failed. Please click "Register Public Key" button.', {
              icon: '⚠️',
              duration: 6000,
            });
          }
        } catch (regError) {
          setIsRegistered(false);
          console.error('Auto-registration error:', regError);
          toast('⚠️ Keys generated but registration failed. Please click "Register Public Key" button.', {
            icon: '⚠️',
            duration: 6000,
          });
        }
      } else {
        setIsRegistered(false);
        toast.success('RSA key pair generated successfully');
      }
    } catch (error) {
      toast.error('Failed to generate RSA keys');
    } finally {
      setLoading(false);
    }
  };

  const registerPublicKey = async () => {
    if (!publicKey) return;

    try {
      setLoading(true);
      const user = readStoredUser() || {};
      if (!user.jwt) {
        toast.error('Please login first');
        return;
      }

      const response = await fetch(`${API_BASE}/users/public_key`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_key_pem: publicKey,
        }),
      });

      if (response.ok) {
        setIsRegistered(true);
        toast.success('Public key registered successfully');
      } else {
        const errorText = await response.text();
        let errorMsg = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error || errorText;
          
          // Check for auth errors
          if (errorJson.code === 401 || errorMsg.includes('invalid subject') || errorMsg.includes('token expired')) {
            toast.error('Your session has expired. Please log out and log back in.', {
              duration: 5000,
            });
            return;
          }
        } catch (e) {
          // Not JSON, use raw text
        }
        toast.error(`Failed to register public key: ${errorMsg}`);
      }
    } catch (error) {
      toast.error('Failed to register public key');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = () => {
    rsaKeyManager.clearKeyPair();
    setHasKeys(false);
    setPublicKey(null);
    setIsRegistered(false);
    setIsConfirmOpen(false);
    toast.success('RSA keys deleted');
  };

  const deleteKeys = () => {
    setIsConfirmOpen(true);
  };

  const downloadKeys = () => {
    const keyPair = rsaKeyManager.getKeyPair();
    if (!keyPair) return;

    const data = {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blockvault-rsa-keys.json';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('RSA keys downloaded');
  };

  const footer = (
    <>
      <Button variant="modal-ghost" onClick={onClose} disabled={loading}>
        Close
      </Button>
      {hasKeys && (
        <Button
          onClick={registerPublicKey}
          disabled={loading}
          variant="modal-primary"
          className="min-w-[190px] shadow-[0_0_20px_hsl(var(--accent-blue-glow))] flex gap-2 items-center justify-center"
        >
          <Shield className="w-4 h-4 mr-1" />
          {isRegistered ? 'Re-Register Public Key' : 'Register Public Key'}
        </Button>
      )}
      {!hasKeys && (
        <Button
          onClick={generateKeys}
          disabled={loading}
          variant="modal-primary"
          className="min-w-[190px] shadow-[0_0_20px_hsl(var(--accent-blue-glow))] flex gap-2 items-center justify-center"
        >
          <Key className="w-4 h-4 mr-1" />
          Generate RSA Keys
        </Button>
      )}
    </>
  );

  return (
    <LegalModalFrame
      icon={<Key className="h-5 w-5" />}
      title="RSA Key Management"
      subtitle="Generate, register, and export your RSA keys for secure sharing."
      onClose={onClose}
      widthClassName="max-w-2xl"
      contentClassName="space-y-6"
      footer={footer}
      headerAccent="blue"
    >
      {/* Status */}
      <div className="flex items-center space-x-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        {hasKeys ? (
          <CheckCircle className="w-5 h-5 text-blue-300" />
        ) : (
          <AlertCircle className="w-5 h-5 text-yellow-400" />
        )}
        <div>
          <p className="text-sm font-medium text-white">
            {hasKeys ? 'RSA Keys Generated' : 'No RSA Keys Found'}
          </p>
          <p className="text-xs text-slate-400">
            {hasKeys
              ? (isRegistered ? 'Public key registered on server' : 'Public key not registered')
              : 'Generate RSA keys to enable secure file sharing and signature workflows.'}
          </p>
        </div>
      </div>

      {/* Key Generation */}
      {!hasKeys && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
          <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Generate RSA Keys</h3>
          <p className="text-sm text-slate-400 mb-4">
            RSA keys are required for secure file sharing. Your private key stays on your device, while your public
            key is registered with the backend so collaborators can encrypt for you.
          </p>
          <p className="text-xs text-slate-500">
            You can regenerate keys later, but existing shares may need to be re-issued with your new public key.
          </p>
        </div>
      )}

      {/* Key Management */}
      {hasKeys && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h4 className="font-medium text-white mb-2">Public Key (truncated)</h4>
            <div className="bg-slate-950/60 p-3 rounded border border-slate-800 font-mono text-xs text-slate-300 break-all">
              {publicKey?.substring(0, 260)}{publicKey && publicKey.length > 260 ? '…' : ''}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={registerPublicKey}
              disabled={loading}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 flex gap-2 items-center justify-center"
            >
              <Shield className="w-4 h-4 mr-1" />
              {isRegistered ? 'Re-Register Public Key' : 'Register Public Key'}
            </Button>

            <Button
              onClick={downloadKeys}
              variant="outline"
              className="flex gap-2 items-center justify-center"
            >
              <Download className="w-4 h-4 mr-1" />
              Download Keys
            </Button>

            <Button
              onClick={deleteKeys}
              variant="modal-danger"
              className="flex gap-2 items-center justify-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Keys
            </Button>
          </div>

          {isRegistered && (
            <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-blue-300" />
                <span className="text-sm text-blue-100">
                  Public key is registered and ready for encrypted file sharing and signature requests.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security Notice */}
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-300 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-100">
            <p className="font-medium mb-1">Security Notice</p>
            <p className="text-xs sm:text-sm">
              Your private key is stored locally and never sent to the server. Keep your private key secure and never
              share it with anyone. If you suspect compromise, delete keys here, regenerate a new pair, and re-register
              your public key.
            </p>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Delete RSA Keys"
        message="Are you sure you want to delete your RSA keys? This will prevent you from sharing files."
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isDanger={true}
        confirmText="Delete"
      />
    </LegalModalFrame>
  );
};
