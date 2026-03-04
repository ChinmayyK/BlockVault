import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File, Link2, Lock, Folder, CheckCircle, AlertCircle } from 'lucide-react';
import { useFiles } from '@/contexts/FileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { GlowingSeparator } from '@/components/ui/glowing-separator';

interface FileUploadProps {
  onClose: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onClose }) => {
  const { uploadFile } = useFiles();
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [folder, setFolder] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.size > 100 * 1024 * 1024) {
        setErrorMessage('File size must be less than 100MB');
        return;
      }
      setFile(droppedFile);
      setErrorMessage('');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 100 * 1024 * 1024) {
        setErrorMessage('File size must be less than 100MB');
        return;
      }
      setFile(selectedFile);
      setErrorMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file || !passphrase) {
      setErrorMessage('Please select a file and enter a passphrase');
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

      await uploadFile(file as any, passphrase, undefined, folder || undefined);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('success');
      
      setTimeout(() => {
        onClose();
      }, 1500);
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

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-black border border-white/10 shadow-2xl rounded-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2 text-white">
                Upload Secure File
              </h2>
              <p className="text-sm text-white/60">
                Upload your file with end-to-end encryption and blockchain verification
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

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
            className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-all ${
              dragActive 
                ? 'border-accent-blue bg-accent-blue/10 shadow-[0_0_28px_hsl(var(--accent-blue-glow))]' 
                : file 
                ? 'border-white/50 bg-white/5'
                : 'border-white/20 hover:border-accent-blue/60 hover:bg-accent-blue/5'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            {!file ? (
              <>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-[0_0_24px_hsl(var(--accent-blue-glow))]">
                    <Upload className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-medium mb-1 text-white">
                      Drag & Drop or{' '}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="text-accent-blue hover:underline"
                      >
                        Choose file
                      </button>
                      {' '}to upload
                    </p>
                    <p className="text-sm text-white/60">
                      PDF, DOCX, Images, Videos • Max 100MB
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-4xl flex-shrink-0">{getFileIcon(file.name)}</div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate text-white" title={file.name}>{file.name}</p>
                  <p className="text-sm text-white/60">{formatFileSize(file.size)}</p>
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
                    className="p-1 rounded-full hover:bg-white/10 transition-colors flex-shrink-0 text-white/60 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* OR Separator */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1"><GlowingSeparator /></div>
            <span className="text-sm text-white/60">or</span>
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
                className="pr-10 bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
              <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            </div>
          </div>

          {/* Encryption Settings */}
          {file && uploadStatus !== 'success' && (
            <div className="space-y-4 mb-6 p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                <Lock className="h-4 w-4" />
                Encryption Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="passphrase" className="text-sm text-white">
                    Passphrase <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="passphrase"
                    type="password"
                    placeholder="Enter encryption passphrase"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    required
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="folder" className="text-sm text-white">
                    Folder (Optional)
                  </Label>
                  <Input
                    id="folder"
                    type="text"
                    placeholder="Organize in folder"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
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
        </div>
      </div>
    </div>
  );
};
