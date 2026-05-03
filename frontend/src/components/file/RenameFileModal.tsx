import React, { useState, useEffect } from 'react';
import { FileText, X, AlertCircle, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { GlowingSeparator } from '@/components/ui/glowing-separator';
import toast from 'react-hot-toast';

interface RenameFileModalProps {
  onClose: () => void;
  onRename: (fileId: string, newName: string) => Promise<void>;
  fileId: string;
  currentName: string;
}

export const RenameFileModal: React.FC<RenameFileModalProps> = ({ 
  onClose, 
  onRename, 
  fileId, 
  currentName 
}) => {
  const [fileName, setFileName] = useState('');
  const [fileExtension, setFileExtension] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Split filename and extension
    const lastDotIndex = currentName.lastIndexOf('.');
    if (lastDotIndex > 0) {
      setFileName(currentName.substring(0, lastDotIndex));
      setFileExtension(currentName.substring(lastDotIndex));
    } else {
      setFileName(currentName);
      setFileExtension('');
    }
  }, [currentName]);

  const handleRename = async () => {
    // Validation
    if (!fileName.trim()) {
      setError('Please enter a file name');
      return;
    }

    // Validate file name (no special characters except - and _)
    const validNameRegex = /^[a-zA-Z0-9-_ ]+$/;
    if (!validNameRegex.test(fileName)) {
      setError('File name can only contain letters, numbers, spaces, hyphens, and underscores');
      return;
    }

    if (fileName.length > 100) {
      setError('File name must be less than 100 characters');
      return;
    }

    const newFullName = fileName.trim() + fileExtension;

    // Check if name actually changed
    if (newFullName === currentName) {
      setError('Please enter a different name');
      return;
    }

    try {
      setRenaming(true);
      setError('');
      await onRename(fileId, newFullName);
      toast.success('File renamed successfully');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to rename file');
      toast.error(err.message || 'Failed to rename file');
    } finally {
      setRenaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !renaming) {
      handleRename();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-black border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200 rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center shadow-[0_0_15px_hsl(var(--accent-blue-glow))]">
                <Edit3 className="h-6 w-6 text-accent-blue" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Rename File</h2>
                <p className="text-sm text-white/60 mt-1">
                  Change the file name
                </p>
              </div>
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
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50 flex items-center gap-2 animate-in slide-in-from-top duration-200">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Current File Name Display */}
          <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-white/60 mb-1">Current name:</p>
            <p className="text-sm font-medium text-white" title={currentName}>
              {currentName}
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fileName" className="text-sm font-medium text-white">
                New File Name
              </Label>
              <div className="flex gap-2">
                <Input
                  id="fileName"
                  type="text"
                  placeholder="Enter new name"
                  value={fileName}
                  onChange={(e) => {
                    setFileName(e.target.value);
                    setError('');
                  }}
                  onKeyDown={handleKeyPress}
                  disabled={renaming}
                  className="flex-1 bg-white/5 border-white/20 text-white placeholder:text-white/40"
                  autoFocus
                  maxLength={100}
                />
                {fileExtension && (
                  <div className="flex items-center px-3 rounded-md bg-white/10 border border-white/20 text-sm text-white/60 font-mono">
                    {fileExtension}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/40">
                  {fileName.length}/100 characters
                </p>
                {fileExtension && (
                  <p className="text-xs text-white/40">
                    Extension: <code className="text-accent-blue">{fileExtension}</code>
                  </p>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="p-3 rounded-lg bg-accent-blue/5 border border-accent-blue/20">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-accent-blue mt-0.5 flex-shrink-0" />
                <div className="text-xs text-white/60 space-y-1">
                  <p>• File extension will be preserved automatically</p>
                  <p>• The file content and encryption remain unchanged</p>
                  <p>• Only the display name will be updated</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="modal-secondary"
                onClick={onClose}
                disabled={renaming}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRename}
                disabled={renaming || !fileName.trim() || fileName.trim() + fileExtension === currentName}
                variant="modal-primary"
                className="flex-1 gap-2 shadow-[0_0_20px_hsl(var(--accent-blue-glow))]"
              >
                {renaming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Renaming...
                  </>
                ) : (
                  <>
                    <Edit3 className="h-4 w-4" />
                    Rename File
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Enter</kbd>
                  <span>Rename</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Esc</kbd>
                  <span>Cancel</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};







