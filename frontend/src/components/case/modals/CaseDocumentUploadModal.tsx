import React, { useState } from 'react';
import { Upload, FileText, Shield, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { getApiBase as resolveApiBase } from '@/lib/getApiBase';
import { readStoredUser } from '@/utils/authStorage';

interface CaseDocumentUploadModalProps {
  caseId: string;
  caseName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CaseDocumentUploadModal: React.FC<CaseDocumentUploadModalProps> = ({
  caseId,
  caseName,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'processing' | 'notarizing' | 'complete'>('upload');
  const [progress, setProgress] = useState(0);
  const [documentHash, setDocumentHash] = useState<string>('');
  const [ipfsCid, setIpfsCid] = useState<string>('');

  const API_BASE = resolveApiBase();

  // Auth Headers
  const getAuthHeaders = () => {
    const user = readStoredUser() || {};
    if (!user.jwt) {
      throw new Error('No authentication token found. Please login again.');
    }
    return {
      'Authorization': `Bearer ${user.jwt}`,
    };
  };

  // Step 1: File Selection and Client-Side Processing
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Step 2: Cryptographic Processing
  const processDocument = async () => {
    if (!selectedFile) return;

    setStep('processing');
    setLoading(true);
    setProgress(0);

    try {
      // Step 2a: Calculate cryptographic hash of original file
      const fileBuffer = await selectedFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const fileHash = '0x' + hashHex;
      setDocumentHash(fileHash);
      setProgress(25);

      setProgress(50);

      // Step 2b: Upload the file to IPFS
      const cid = await uploadToIpfs(selectedFile);
      setIpfsCid(cid);
      setProgress(100);

      setStep('notarizing');
      await notarizeDocument(fileHash, cid);

    } catch (error) {
      console.error('Error processing document:', error);
      toast.error('Failed to process document');
      setStep('upload');
    } finally {
      setLoading(false);
    }
  };

  // Upload to IPFS
  const uploadToIpfs = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/ipfs/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload to IPFS');
    }

    const data = await response.json();
    return data.cid;
  };

  // Step 3: Record the document, its fingerprint and IPFS address, with the case
  const notarizeDocument = async (hash: string, cid: string) => {
    try {
      // Add document to case in backend
      await addDocumentToCase(caseId, {
        name: selectedFile!.name,
        hash: hash,
        cid: cid,
        size: selectedFile!.size,
        type: selectedFile!.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user?.address || '',
      });

      // Also add to main legal documents list
      const legalDocument = {
        id: Date.now().toString(),
        file_id: Date.now().toString(),
        name: selectedFile!.name,
        docHash: hash,
        cid: cid,
        status: 'registered' as const,
        timestamp: Date.now(),
        owner: user?.address || 'current-user',
        ipfsCid: cid,
        caseId: caseId // Link to the case
      };

      // Store in localStorage for main legal documents
      const existingDocs = JSON.parse(localStorage.getItem('legal_documents') || '[]');
      existingDocs.push(legalDocument);
      localStorage.setItem('legal_documents', JSON.stringify(existingDocs));

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('legalDocumentsUpdated'));

      setStep('complete');
      toast.success('Document fingerprinted and added to the case.');
      onSuccess();

    } catch (error) {
      console.error('Error notarizing document:', error);
      toast.error('Failed to add the document to the case');
      setStep('upload');
    }
  };

  // Add document to case in backend
  const addDocumentToCase = async (caseId: string, documentData: any) => {
    const response = await fetch(`${API_BASE}/cases/${caseId}/documents`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(documentData),
    });

    if (!response.ok) {
      throw new Error('Failed to add document to case');
    }

    return response.json();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <Card className="w-full max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Add Document to Case</h2>
              <p className="text-sm text-slate-400">{caseName}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Step 1: File Selection */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Select Document</h3>
              <p className="text-slate-400 mb-4">
                Choose the document you want to add to this case file.
              </p>
              <input
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </label>
            </div>

            {selectedFile && (
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="font-medium text-white">{selectedFile.name}</p>
                    <p className="text-sm text-slate-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Legal Notice */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-400 mb-1">What happens to this document</h4>
                  <p className="text-sm text-amber-200">
                    Its SHA-256 fingerprint is calculated in your browser, the file is uploaded to IPFS, and both are
                    recorded with the case, so anyone can later check that the file hasn&apos;t changed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="space-y-6">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-medium text-white mb-2">Processing Document</h3>
              <p className="text-slate-400 mb-4">
                Fingerprinting and uploading...
              </p>
              
              <div className="w-full bg-slate-700 rounded-full h-2 mb-4">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-slate-400">{progress}% Complete</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-white">Calculated cryptographic hash</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-white">Uploaded to IPFS</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Notarizing */}
        {step === 'notarizing' && (
          <div className="space-y-6">
            <div className="text-center">
              <Shield className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Adding to the case</h3>
              <p className="text-slate-400 mb-4">
                Recording the fingerprint and IPFS address with the case...
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <h4 className="font-medium text-white mb-2">Document Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Hash:</span>
                  <span className="text-white font-mono">{documentHash.slice(0, 10)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">IPFS CID:</span>
                  <span className="text-white font-mono">{ipfsCid.slice(0, 10)}...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Document added</h3>
            <p className="text-slate-400 mb-4">
              The document was added to the case with its fingerprint and IPFS address.
            </p>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-sm text-green-300">
                Comparing a file&apos;s SHA-256 with this fingerprint shows whether it has changed since.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-6">
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={processDocument}
                disabled={!selectedFile || loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Processing...' : 'Add Document'}
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={onClose} className="bg-green-600 hover:bg-green-700">
              Close
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
