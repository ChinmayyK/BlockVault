import React, { useState } from 'react';
import { Download, Copy, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface RecoveryKeyModalProps {
  recoveryKey: string;
  onClose: () => void;
}

export const RecoveryKeyModal: React.FC<RecoveryKeyModalProps> = ({ recoveryKey, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    toast.success('Recovery key copied to clipboard');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    const content = `BlockVault Recovery Key\n\n${recoveryKey}\n\nStore this securely.\nIf you lose both your passphrase and this recovery key, your file cannot be recovered.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blockvault-recovery-key.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Recovery key downloaded');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-black border border-white/10 shadow-2xl rounded-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="p-8">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-16 h-16 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center mb-4 shadow-[0_0_24px_hsl(var(--accent-blue-glow))]">
              <ShieldCheck className="h-8 w-8 text-accent-blue" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Your Recovery Key</h2>
            <p className="text-sm text-white/70">
              This uniquely identifies your file's encryption wrapper.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 text-center">
            <p className="text-3xl font-mono text-white tracking-widest break-all">
              {recoveryKey}
            </p>
          </div>

          <div className="flex gap-4 justify-center mb-8">
            <Button
              variant="modal-secondary"
              onClick={handleCopy}
              className="flex-1 flex gap-2 items-center justify-center"
            >
              {copied ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="modal-secondary"
              onClick={handleDownload}
              className="flex-1 flex gap-2 items-center justify-center"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-8 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200 leading-relaxed">
              <p className="font-semibold mb-1 text-amber-500">Important Security Warning</p>
              If you lose both your passphrase and this recovery key, your file cannot be recovered. Recovery keys cannot be regenerated. Store them safely.
            </div>
          </div>

          <Button
            variant="modal-primary"
            onClick={onClose}
            className="w-full shadow-[0_0_20px_hsl(var(--accent-blue-glow))]"
          >
            I saved this key
          </Button>
        </div>
      </div>
    </div>
  );
};
