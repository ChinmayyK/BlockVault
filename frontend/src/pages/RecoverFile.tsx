import React, { useState } from 'react';
import { ShieldCheck, Key, File as FileIcon, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fileService } from '@/api/services';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function RecoverFile() {
  const [fileId, setFileId] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [step, setStep] = useState<'verify' | 'reset'>('verify');
  const [isLoading, setIsLoading] = useState(false);
  
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  
  const navigate = useNavigate();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileId || !recoveryKey) {
      toast.error('File ID and Recovery Key are required.');
      return;
    }
    
    try {
      setIsLoading(true);
      await fileService.recoverFile(fileId, recoveryKey);
      toast.success('Recovery key verified successfully.');
      setStep('reset');
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Invalid recovery key or file not found.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassphrase || newPassphrase !== confirmPassphrase) {
      toast.error('Passphrases do not match.');
      return;
    }
    if (newPassphrase.length < 8) {
      toast.error('Passphrase must be at least 8 characters.');
      return;
    }
    
    try {
      setIsLoading(true);
      await fileService.resetPassphrase(fileId, recoveryKey, newPassphrase);
      toast.success('Passphrase reset successfully! You can now download the file.');
      navigate('/dashboard');
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to reset passphrase.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in pb-20">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Recover File Access
          </h1>
          <p className="text-white/60 mt-1">
            Restore access to an encrypted file using your recovery key.
          </p>
        </div>
      </div>

      <div className="bg-black/40 border border-white/5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-purple/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 border border-white/10 flex items-center justify-center mb-6 shadow-lg backdrop-blur-md">
            <ShieldCheck className="h-8 w-8 text-accent-blue" />
          </div>

          <p className="text-center text-white/70 max-w-lg mb-8">
            If you lost your passphrase, you can use the 16-character recovery key provided during upload to set a new passphrase.
          </p>

          <div className="w-full max-w-md">
            {step === 'verify' && (
              <form onSubmit={handleVerify} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <FileIcon className="h-4 w-4 text-accent-blue" />
                    File ID
                  </label>
                  <Input
                    placeholder="e.g. 64c92a9b..."
                    value={fileId}
                    onChange={(e) => setFileId(e.target.value)}
                    className="bg-white/5 border-white/10 text-white font-mono"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <Key className="h-4 w-4 text-accent-purple" />
                    Recovery Key
                  </label>
                  <Input
                    placeholder="e.g. ZXA9-72BC-44D1-AF92"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    className="bg-white/5 border-white/10 text-white font-mono uppercase"
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading || !fileId || !recoveryKey} 
                  variant="default" 
                  className="w-full mt-4 h-12 gap-2 text-base font-medium shadow-[0_0_20px_hsl(var(--accent-blue))] hover:shadow-[0_0_25px_hsl(var(--accent-blue))]"
                >
                  {isLoading ? 'Verifying...' : 'Recover File'}
                  {!isLoading && <ShieldCheck className="h-5 w-5" />}
                </Button>
              </form>
            )}

            {step === 'reset' && (
              <form onSubmit={handleReset} className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl mb-6 flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-green-200">
                    Recovery key verified! You can now set a new passphrase for this file.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-accent-blue" />
                    New Passphrase
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter new passphrase"
                    value={newPassphrase}
                    onChange={(e) => setNewPassphrase(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-accent-blue" />
                    Confirm Passphrase
                  </label>
                  <Input
                    type="password"
                    placeholder="Re-enter new passphrase"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading || !newPassphrase || !confirmPassphrase} 
                  variant="default" 
                  className="w-full mt-4 h-12 gap-2 text-base font-medium shadow-[0_0_20px_hsl(var(--accent-blue))] hover:shadow-[0_0_25px_hsl(var(--accent-blue))]"
                >
                  {isLoading ? 'Resetting...' : 'Reset Passphrase'}
                  {!isLoading && <Lock className="h-5 w-5" />}
                </Button>
              </form>
            )}
            
            <div className="mt-8 flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-200/80 leading-relaxed">
                Recovery keys cannot be regenerated. Store them safely. If you lose both the passphrase and recovery key, the file is irrecoverable due to end-to-end encryption mechanics.
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
