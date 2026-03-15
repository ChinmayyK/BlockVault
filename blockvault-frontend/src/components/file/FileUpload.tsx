import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Link2, Lock, Folder, CheckCircle, AlertCircle } from 'lucide-react';
import { useFiles } from '@/contexts/FileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { GlowingSeparator } from '@/components/ui/glowing-separator';
import { validatePassphrase } from '@/utils/passphrase';
import { RecoveryKeyModal } from '../security/RecoveryKeyModal';
import { LegalModalFrame } from '@/components/legal/modals/LegalModalFrame';

interface FileUploadProps {
  onClose: () => void;
  inline?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onClose, inline = false }) => {
  const { uploadFile } = useFiles();
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [folder, setFolder] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

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
    if (!file || !passphrase) {
      setErrorMessage('Please select a file and enter a passphrase');
      return;
    }
    const passphraseError = validatePassphrase(passphrase);
    if (passphraseError) {
      setErrorMessage(passphraseError);
      return;
    }

    try {
      setUploadStatus('uploading');
      setUploadProgress(0);
      
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 200);

      const response = await uploadFile(file as any, passphrase, undefined, folder || undefined);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('success');
      
      if (response && response.recovery_key) {
        setRecoveryKey(response.recovery_key);
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
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext || '')) return '🖼️';
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(ext || '')) return '🎥';
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext || '')) return '🎵';
    if (['pdf'].includes(ext || '')) return '📄';
    if (['txt', 'md', 'doc', 'docx', 'rtf'].includes(ext || '')) return '📝';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return '📦';
    return '📁';
  };

  const footer = (
    <div className="flex w-full items-center gap-3">
      <Button
        variant="modal-secondary"
        onClick={onClose}
        disabled={uploadStatus === 'uploading'}
        className="flex-1"
      >
        Cancel
      </Button>
      <Button
        onClick={handleUpload}
        disabled={!file || !passphrase || uploadStatus === 'uploading'}
        variant="modal-primary"
        className="flex-1 gap-2 shadow-[0_0_20px_hsl(var(--accent-blue-glow))]"
      >
        {uploadStatus === 'uploading' ? (
          <>
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Uploading... {Math.round(uploadProgress)}%
          </>
        ) : uploadStatus === 'success' ? (
          <>
            <CheckCircle className="h-4 w-4" />
            Uploaded
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload & Encrypt
          </>
        )}
      </Button>
    </div>
  );

  return (
    <>
      <LegalModalFrame
        icon={<Upload className="h-5 w-5" />}
        title="Upload Secure File"
        subtitle="Upload your file with end-to-end encryption and blockchain verification"
        onClose={onClose}
        footer={footer}
        headerAccent="blue"
        widthClassName="max-w-2xl"
        inline={inline}
      >
        <div className="space-y-6">

          {/* Error Message */}
          {errorMessage && uploadStatus !== 'uploading' && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <p className="text-sm text-red-400">{errorMessage}</p>
            </div>
          )}

          {/* Success Message */}
          {uploadStatus === 'success' && (
            <div className="mb-4 p-3 rounded-lg bg-white/10 border border-white/50 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-white" />
              <p className="text-sm text-white">File uploaded successfully!</p>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            {...(file ? {} : getRootProps())}
            className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-all ${
              isDragActive 
                ? 'border-primary bg-primary/10 shadow-[0_0_28px_hsl(var(--primary))]' 
                : file 
                ? 'border-border bg-muted/30 cursor-default'
                : 'border-border hover:border-primary/60 hover:bg-muted/50 cursor-pointer'
            }`}
          >
            {!file && <input {...getInputProps()} />}
            {!file ? (
              <>
                <div className="flex flex-col items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isDragActive ? 'bg-primary border-primary shadow-[0_0_24px_hsl(var(--primary))]' : 'bg-muted border border-border'}`}>
                    <Upload className={`h-8 w-8 ${isDragActive ? 'text-primary-foreground' : 'text-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-lg font-medium mb-1 text-white">
                      {isDragActive ? 'Drop file here...' : 'Drag & Drop or click to upload'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PDF, DOCX, Images, Videos • Max 100MB
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-4xl flex-shrink-0">{getFileIcon(file.name)}</div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate text-foreground" title={file.name}>{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                  {uploadStatus === 'uploading' && (
                    <Progress value={uploadProgress} className="mt-2 h-2" />
                  )}
                </div>
                {uploadStatus !== 'uploading' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setUploadProgress(0);
                      setUploadStatus('idle');
                    }}
                    className="p-1 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors flex-shrink-0 text-muted-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* OR Separator */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1"><GlowingSeparator /></div>
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1"><GlowingSeparator /></div>
          </div>

          {/* Import from URL */}
          <div className="space-y-2 mb-6">
            <Label htmlFor="file-url" className="text-sm font-medium text-white">
              Import file from URL
            </Label>
            <div className="relative">
              <Input
                id="file-url"
                type="url"
                placeholder="Add file URL here"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="pr-10 bg-muted border-border text-foreground placeholder:text-muted-foreground/40"
              />
              <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            </div>
          </div>

          {/* Encryption Settings */}
          {file && uploadStatus !== 'success' && (
            <div className="space-y-4 mb-6 p-4 rounded-lg bg-muted/30 border border-border">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Lock className="h-4 w-4" />
                Encryption Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="passphrase" className="text-sm text-foreground">
                    Passphrase <span className="text-red-500 font-bold">*</span>
                  </Label>
                  <Input
                    id="passphrase"
                    type="password"
                    placeholder="Enter encryption passphrase"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    required
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="folder" className="text-sm text-foreground">
                    Folder (Optional)
                  </Label>
                  <Input
                    id="folder"
                    type="text"
                    placeholder="Organize in folder"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>
            </div>
          )}

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
