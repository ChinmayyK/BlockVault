import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Lock, CheckCircle, AlertCircle, Eye, EyeOff, Shield, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFiles } from '@/contexts/FileContext';
import { useVault } from '@/contexts/VaultContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { validatePassphrase } from '@/utils/passphrase';
import { RecoveryKeyModal } from '../security/RecoveryKeyModal';
import { LegalModalFrame } from '@/components/legal/modals/LegalModalFrame';

interface FileUploadProps {
  onClose: () => void;
  inline?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onClose, inline = false }) => {
  const { uploadFile } = useFiles();
  const { isVaultUnlocked } = useVault();
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [folder, setFolder] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState<string>('Encrypting your file...');
  const [errorMessage, setErrorMessage] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const passphraseRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file && passphraseRef.current && uploadStatus === 'idle') {
      passphraseRef.current.focus();
    }
  }, [file, uploadStatus]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const droppedFile = acceptedFiles[0];
      if (droppedFile.size > 100 * 1024 * 1024) {
        setErrorMessage('File size must be less than 100MB');
        return;
      }
      setFile(droppedFile);
      setErrorMessage('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if ((!file && !fileUrl) || (!passphrase && !isVaultUnlocked)) {
      setErrorMessage('Please select a file and enter a passphrase');
      return;
    }
    
    // Only validate custom passphrase if we aren't using the vault key
    if (!isVaultUnlocked) {
      const passphraseError = validatePassphrase(passphrase);
      if (passphraseError) {
        setErrorMessage(passphraseError);
        return;
      }
    }

    try {
      setUploadStatus('uploading');
      setUploadProgress(0);
      setUploadMessage('Deriving encryption keys...');
      
      const response = await uploadFile(
        file as any, 
        isVaultUnlocked ? undefined : passphrase,
        (progress, msg) => {
          setUploadProgress(progress);
          if (msg) setUploadMessage(msg);
        },
        undefined, 
        folder || undefined
      );
      
      setUploadProgress(100);
      setUploadStatus('success');
      
      if (response && response.recovery_key) {
        // Show recovery key modal after a short delay for smooth UX
        setTimeout(() => {
          setRecoveryKey(response.recovery_key);
        }, 500);
      } else {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error: any) {
      setUploadStatus('error');
      setErrorMessage(error.message || 'Upload failed');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext || '')) return '🖼️';
    if (['mp4', 'mov', 'webm'].includes(ext || '')) return '🎥';
    if (['pdf'].includes(ext || '')) return '📄';
    if (['zip', 'rar', 'tar'].includes(ext || '')) return '📦';
    return '📁';
  };

  // ---------------------------------------------------------------------------
  // View States rendering
  // ---------------------------------------------------------------------------

  const renderContent = () => {
    // STATE 3: Encrypting & Uploading
    if (uploadStatus === 'uploading' || uploadStatus === 'success') {
      return (
        <motion.div
          key="uploading"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-12 px-6 text-center"
        >
          {uploadStatus === 'uploading' ? (
            <>
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin"></div>
                <div className="absolute inset-0 rounded-full border-l-2 border-r-2 border-blue-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-indigo-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">{uploadMessage}</h3>
              <p className="text-sm text-zinc-400 max-w-xs mb-8">This happens locally in your browser for maximum security.</p>
              
              <div className="w-full max-w-[280px]">
                <Progress value={uploadProgress} className="h-2 mb-2 bg-zinc-800" indicatorClassName="bg-indigo-500 transition-all duration-300 ease-out" />
                <p className="text-xs text-zinc-500 text-right font-medium">{Math.round(uploadProgress)}%</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Securely Encrypted & Uploaded</h3>
              <p className="text-sm text-zinc-400 max-w-xs">Your file is now safely stored in your vault.</p>
            </>
          )}
        </motion.div>
      );
    }

    // STATE 2: File Selected (Input details)
    if (file || fileUrl) {
      return (
        <motion.div
          key="selected"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-6 w-full"
        >
          {/* File Preview Card */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-15 transition duration-500"></div>
            <div className="relative flex items-center p-4 rounded-xl bg-zinc-900 border border-zinc-700/50">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-zinc-800 text-2xl flex-shrink-0 border border-zinc-700/50 shadow-sm">
                 {file ? getFileIcon(file.name) : '🔗'}
              </div>
              <div className="flex-1 min-w-0 ml-4">
                <p className="text-sm font-medium text-white truncate" title={file ? file.name : fileUrl}>
                  {file ? file.name : fileUrl}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {file ? formatFileSize(file.size) : 'External URL'}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setFileUrl('');
                  setUploadStatus('idle');
                }}
                className="ml-4 p-2 rounded-lg hover:bg-zinc-800 hover:text-red-400 transition-colors flex-shrink-0 text-zinc-400 focus:outline-none"
                title="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Configuration Inputs */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="passphrase" className="text-sm font-medium text-zinc-200">
                Security
              </Label>
              
              {isVaultUnlocked ? (
                <div className="relative flex items-center p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                  <Shield className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-emerald-300">Secured with Vault Key</p>
                    <p className="text-xs text-emerald-500/80 mt-0.5">Your master vault key will be used to seamlessly encrypt this file.</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-emerald-500/60 ml-auto shrink-0" />
                </div>
              ) : (
                <>
                  <Label htmlFor="passphrase" className="text-sm font-medium text-zinc-200 hidden">
                    Passphrase <span className="text-red-400">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      ref={passphraseRef}
                      id="passphrase"
                      type={showPassphrase ? 'text' : 'password'}
                      placeholder="Create a strong passphrase"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (file || fileUrl) && passphrase) {
                          e.preventDefault();
                          handleUpload();
                        }
                      }}
                      required
                      className="bg-zinc-900/50 border-zinc-800 text-sm pr-10 focus-visible:ring-indigo-500 h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
                    >
                      {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  
                  {/* Security Messaging */}
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <Shield className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <p className="text-[11px] text-zinc-500 font-medium tracking-wide">
                      Encryption happens locally in your browser
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="folder" className="text-sm font-medium text-zinc-200">
                Folder (Optional)
              </Label>
              <Input
                id="folder"
                type="text"
                placeholder="Organize in a folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (file || fileUrl) && (isVaultUnlocked || passphrase)) {
                    e.preventDefault();
                    handleUpload();
                  }
                }}
                className="bg-zinc-900/50 border-zinc-800 text-sm focus-visible:ring-indigo-500 h-11"
              />
            </div>
          </div>
        </motion.div>
      );
    }

    // STATE 1: Upload Area (Initial)
    return (
      <motion.div
        key="initial"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-6 w-full"
      >
        {/* Drag & Drop Area */}
        <div
          {...getRootProps()}
          className={`relative rounded-2xl border-2 border-dashed p-10 transition-all duration-300 ease-in-out cursor-pointer group ${
            isDragActive 
              ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-[1.02]' 
              : 'border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.05)]'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 mb-4 ${
              isDragActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-zinc-800/80 text-zinc-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-400'
            }`}>
              <Upload className={`w-6 h-6 ${isDragActive ? 'animate-bounce' : ''}`} />
            </div>
            <p className="text-base font-semibold text-zinc-200 mb-1">
              Drag & drop your file
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              or click to browse
            </p>

            <div className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-zinc-900/80 border border-zinc-800/80">
              <Lock className="w-3 h-3 text-indigo-400" />
              <p className="text-[11px] font-medium text-zinc-400 tracking-wide uppercase">
                Files are encrypted before upload
              </p>
            </div>
          </div>
        </div>

        {/* URL Input Alternative */}
        <div className="flex flex-col gap-2 mt-2">
          <Label htmlFor="file-url" className="text-sm font-medium text-zinc-400">
            or paste file URL
          </Label>
          <Input
            id="file-url"
            type="url"
            placeholder="https://"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            className="bg-zinc-900/30 border-zinc-800/80 text-sm focus-visible:ring-indigo-500 h-11"
          />
        </div>
      </motion.div>
    );
  };

  // ---------------------------------------------------------------------------
  // Action Footer
  // ---------------------------------------------------------------------------
  
  const footer = (
    <div className="flex w-full items-center gap-3">
      {uploadStatus !== 'uploading' && uploadStatus !== 'success' && (
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={false}
          className="flex-1 text-zinc-400 hover:text-white hover:bg-zinc-800 h-12 rounded-xl"
        >
          Cancel
        </Button>
      )}
      <Button
        onClick={handleUpload}
        disabled={(!file && !fileUrl) || (!passphrase && !isVaultUnlocked) || uploadStatus === 'uploading' || uploadStatus === 'success'}
        className={`flex-1 gap-2 h-12 rounded-xl text-sm font-semibold transition-all duration-300 ${
          uploadStatus === 'uploading' || uploadStatus === 'success' 
            ? 'hidden' 
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] shadow-lg'
        }`}
      >
        <Lock className="w-4 h-4" />
        Secure & Upload &rarr;
      </Button>
    </div>
  );

  return (
    <>
      <LegalModalFrame
        icon={<Lock className="h-5 w-5" />}
        title="Upload Secure File"
        subtitle="Encrypt your file before storing or sharing"
        onClose={onClose}
        footer={uploadStatus === 'uploading' || uploadStatus === 'success' ? undefined : footer}
        headerAccent="blue"
        widthClassName="max-w-[480px]"
        inline={inline}
      >
        <div className="flex flex-col gap-4 pt-2 pb-1 overflow-hidden min-h-[360px] relative">
          
          {/* Error Banner */}
          <AnimatePresence>
            {errorMessage && uploadStatus !== 'uploading' && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-400 leading-snug">{errorMessage}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>

        </div>
      </LegalModalFrame>
      
      {recoveryKey && (
        <RecoveryKeyModal 
          recoveryKey={recoveryKey} 
          onClose={() => {
            setRecoveryKey(null);
            onClose();
          }} 
        />
      )}
    </>
  );
};
