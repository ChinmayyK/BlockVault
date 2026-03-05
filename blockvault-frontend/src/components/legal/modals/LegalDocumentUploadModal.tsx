import React, { useState, useCallback } from 'react';
import { Upload, FileText, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LegalModalFrame } from './LegalModalFrame';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getApiBase } from '@/lib/getApiBase';
import { readStoredUser } from '@/utils/authStorage';
import { storeLegalDocumentKey } from '@/utils/legalDocumentKeys';
import { validatePassphrase } from '@/utils/passphrase';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface LegalDocumentUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const LegalDocumentUploadModal: React.FC<LegalDocumentUploadModalProps> = ({ onClose, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const user = readStoredUser() || {};
    return {
      'Authorization': `Bearer ${user.jwt}`,
    };
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setDragActive(false);
      setErrorMessage(null);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage(null);
    }
    setDragActive(false);
  }, []);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!dragActive) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setDragActive(false);
  };

  const handleUpload = async () => {
    if (!selectedFile || !passphrase) {
      toast.error('Please select a file and enter a passphrase');
      return;
    }
    const passphraseError = validatePassphrase(passphrase);
    if (passphraseError) {
      setErrorMessage(passphraseError);
      toast.error(passphraseError);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // Upload encrypted file to backend
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('key', passphrase);

      console.log('📤 Uploading file to backend...');
      const uploadResponse = await fetchWithTimeout(`${getApiBase()}/files/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Upload failed:', errorText);
        throw new Error(`File upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      const fileId = uploadData.file_id;
      const sha256 = uploadData.sha256;

      console.log('✅ File uploaded to backend successfully!');
      console.log('📋 Upload data:', { fileId, sha256 });

      if (!fileId || fileId === 'undefined') {
        throw new Error('Backend returned invalid file_id');
      }

      // Store the encryption key for this document
      storeLegalDocumentKey(fileId, passphrase);
      console.log('🔐 Encryption key stored for:', fileId);

      // Add to legal documents list
      const user = readStoredUser() || {};
      const legalDocument = {
        id: fileId,
        file_id: fileId,
        name: selectedFile.name,
        docHash: sha256,
        status: 'uploaded' as const,
        timestamp: Date.now(),
        owner: user.address || 'current-user',
      };

      // Store in localStorage
      const existingDocs = JSON.parse(localStorage.getItem('legal_documents') || '[]');
      existingDocs.push(legalDocument);
      localStorage.setItem('legal_documents', JSON.stringify(existingDocs));

      // Dispatch event to refresh documents
      window.dispatchEvent(new CustomEvent('legalDocumentsUpdated'));

      toast.success('Document uploaded successfully!');
      onSuccess();
      onClose();

    } catch (error) {
      console.error('Error during upload:', error);
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred.');
      toast.error('An error occurred during upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LegalModalFrame
      icon={<Upload className="h-5 w-5" />}
      title="Upload Legal Document"
      subtitle="Upload a document to your legal workspace"
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={
        <>
          <Button
            onClick={onClose}
            variant="modal-ghost"
            disabled={loading}
          >
            Cancel
          </Button>
          {selectedFile && (
            <Button
              onClick={handleUpload}
              loading={loading}
              disabled={!passphrase || loading}
              variant="modal-primary"
            >
              {loading ? 'Uploading…' : 'Upload Document'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <div
          className={cn(
            'group relative rounded-2xl border-2 border-dashed p-9 text-center transition-all duration-300',
            dragActive
              ? 'border-accent-blue bg-accent-blue/10 shadow-[0_0_28px_hsl(var(--accent-blue-glow))]'
              : selectedFile
              ? 'border-accent-blue/70 bg-accent-blue/5'
              : 'border-white/20 bg-white/5 hover:border-accent-blue/60 hover:bg-accent-blue/5',
          )}
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-accent-blue/10 via-transparent to-accent-blue/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 border border-white/20 shadow-[0_0_24px_hsl(var(--accent-blue-glow))]">
            <FileText className={`h-6 w-6 ${dragActive ? 'animate-bounce text-accent-blue' : 'text-white'}`} />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">Select Document to Upload</h3>
          <p className="mx-auto mb-6 max-w-md text-sm text-white/60">
            Upload your legal document. You can notarize it later if needed.
          </p>
          <input
            type="file"
            onChange={handleFileSelect}
            className="sr-only"
            id="file-input"
            accept=".pdf,.doc,.docx,.txt"
          />
          <label
            htmlFor="file-input"
            className="group inline-flex items-center rounded-lg bg-white text-black px-5 py-2.5 text-sm font-medium shadow-[0_0_20px_hsl(var(--accent-blue-glow))] transition-all hover:bg-white/90 hover:shadow-[0_0_30px_hsl(var(--accent-blue-glow))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-accent-blue cursor-pointer"
          >
            <Upload className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:-translate-y-[1px] group-hover:scale-105" />
            Choose File
          </label>
          <p className="mt-4 text-xs text-white/40">Drag & drop also supported. 100&nbsp;MB max · PDF, DOCX, TXT</p>
        </div>

        {selectedFile && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/20 bg-white/5 p-4 shadow-sm">
              <div className="flex items-center space-x-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 border border-white/20">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{selectedFile.name}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-accent-blue/80">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                  <p className="text-xs text-white/40">{selectedFile.type || 'Unknown format'}</p>
                </div>
                <Button
                  size="sm"
                  variant="modal-ghost"
                  className="text-white/60 hover:text-red-400 hover:bg-red-500/10"
                  onClick={() => {
                    setSelectedFile(null);
                    setPassphrase('');
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Encryption Passphrase
              </label>
              <Input
                type="password"
                placeholder="Enter a secure passphrase to encrypt this document"
                value={passphrase}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassphrase(e.target.value)}
                required
                className="w-full"
              />
              <p className="text-xs text-white/40">
                This passphrase encrypts your document before upload. Store it securely as you'll need it to decrypt the document later.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Upload failed</p>
                    <p className="text-xs text-destructive/80 break-all">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </LegalModalFrame>
  );
};
