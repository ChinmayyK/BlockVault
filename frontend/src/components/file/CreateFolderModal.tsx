import React, { useState } from 'react';
import { Folder, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import toast from 'react-hot-toast';

interface CreateFolderModalProps {
  onClose: () => void;
  onCreateFolder: (folderName: string) => Promise<void>;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ onClose, onCreateFolder }) => {
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    // Validation
    if (!folderName.trim()) {
      setError('Please enter a folder name');
      return;
    }

    // Validate folder name (no special characters except - and _)
    const validNameRegex = /^[a-zA-Z0-9-_ ]+$/;
    if (!validNameRegex.test(folderName)) {
      setError('Folder name can only contain letters, numbers, spaces, hyphens, and underscores');
      return;
    }

    if (folderName.length > 50) {
      setError('Folder name must be less than 50 characters');
      return;
    }

    try {
      setCreating(true);
      setError('');
      await onCreateFolder(folderName.trim());
      toast.success(`Folder "${folderName}" created successfully`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create folder');
      toast.error(err.message || 'Failed to create folder');
    } finally {
      setCreating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !creating) {
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <Card 
        className="relative w-full max-w-md bg-card border-border shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Folder className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Create New Folder</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Organize your files into folders
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 flex items-center gap-2 animate-in slide-in-from-top duration-200">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folderName" className="text-sm font-medium">
                Folder Name
              </Label>
              <Input
                id="folderName"
                type="text"
                placeholder="e.g., Legal Documents, Client Files, Contracts..."
                value={folderName}
                onChange={(e) => {
                  setFolderName(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyPress}
                disabled={creating}
                className="w-full"
                autoFocus
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                {folderName.length}/50 characters
              </p>
            </div>

            {/* Info Box */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Folders help organize your encrypted files</p>
                  <p>• You can upload files directly to folders</p>
                  <p>• Folder names are encrypted along with your files</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={creating}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !folderName.trim()}
                className="flex-1 gap-2"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Folder className="h-4 w-4" />
                    Create Folder
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
                  <span>Create</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Esc</kbd>
                  <span>Cancel</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};







