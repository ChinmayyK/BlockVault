import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LegalModalFrame } from '@/components/legal/modals/LegalModalFrame';
import { useNavigate } from 'react-router-dom';

interface PassphraseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (passphrase: string) => void;
  title?: string;
  subtitle?: string;
  isProcessing?: boolean;
  processingLabel?: string;
}

export function PassphraseModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Enter Passphrase",
  subtitle = "Decrypt this file to continue",
  isProcessing = false,
  processingLabel = "Decrypting..."
}: PassphraseModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (passphrase.trim()) {
      onConfirm(passphrase);
    }
  };

  const footer = (
    <div className="w-full flex items-center justify-between mt-2 flex-row-reverse">
      <Button
        onClick={handleConfirm}
        disabled={!passphrase.trim() || isProcessing}
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-2 h-10 shadow-sm"
      >
        {isProcessing ? processingLabel : "Continue →"}
      </Button>
      <Button
        variant="ghost"
        onClick={onClose}
        disabled={isProcessing}
        className="text-muted-foreground hover:text-foreground font-medium px-4 py-2 h-10"
      >
        Cancel
      </Button>
    </div>
  );

  return (
    <LegalModalFrame
      icon={<Lock className="h-5 w-5 text-foreground" />}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      widthClassName="max-w-[440px]"
      contentClassName="p-6 space-y-5"
      overlayClassName="bg-black/40 backdrop-blur-md"
      footer={footer}
      headerAccent="blue"
    >
      <div className="space-y-4">
        <div className="relative flex items-center">
          <input
            type={showPassphrase ? "text" : "password"}
            placeholder="Enter passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleConfirm()}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm transition-shadow pr-10"
            autoFocus
            disabled={isProcessing}
          />
          <button
            type="button"
            className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors p-1"
            onClick={() => setShowPassphrase(!showPassphrase)}
            disabled={isProcessing}
          >
            {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        
        <div className="flex items-center justify-between text-[13px]">
          <p className="text-muted-foreground">
            Decryption happens locally in your browser
          </p>
          <button 
            className="text-primary hover:underline font-medium ml-2"
            onClick={() => {
              onClose();
              navigate('/missing-passphrase');
            }}
            disabled={isProcessing}
          >
            Forgot passphrase?
          </button>
        </div>
      </div>
    </LegalModalFrame>
  );
}
