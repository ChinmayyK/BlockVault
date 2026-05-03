import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Calendar,
  MessageSquare,
  Download,
  Eye,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { getSignatureRequestsForUser, updateSignatureRequestStatus, StoredSignatureRequest } from '@/utils/signatureRequestStorage';
import toast from 'react-hot-toast';
import { ScrollingText } from '@/components/ui/ScrollingText';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getApiBase as resolveApiBase } from '@/lib/getApiBase';
import { readStoredUser } from '@/utils/authStorage';

interface SignatureRequest {
  id: string;
  documentId: string;
  documentName: string;
  requestedBy: string;
  status: 'pending' | 'signed' | 'expired' | 'declined';
  createdAt: string;
  expiresAt: number;
  message: string;
}

export const SignatureRequests: React.FC = () => {
  const { user } = useAuth();
  const [signatureRequests, setSignatureRequests] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const API_BASE = resolveApiBase();

  // Auth Headers
  const getAuthHeaders = () => {
    const user = readStoredUser() || {};
    if (!user.jwt) {
      throw new Error('No authentication token found. Please login again.');
    }
    return {
      'Authorization': `Bearer ${user.jwt}`,
      'Content-Type': 'application/json',
    };
  };

  // Load signature requests (server-first, then fallback/merge with localStorage)
  const loadSignatureRequests = useCallback(async () => {
    setLoading(true);
    try {
      if (!user?.address) {
        console.log('⚠️ No user address, cannot load signature requests');
        setSignatureRequests([]);
        setLoading(false);
        return;
      }

      console.log('🔍 Loading signature requests for address:', user.address);

      // 1) Try to fetch server-side signature requests (mock server supports /signature-requests)
      let serverRequests: StoredSignatureRequest[] = [];
      try {
        const resp = await fetchWithTimeout(`${API_BASE}/signature-requests?user_address=${encodeURIComponent(user.address)}`, {
          headers: getAuthHeaders(),
        });

        if (resp.ok) {
          const body = await resp.json();
          const items = body.signatureRequests || body.signature_requests || [];
          console.log('📡 Server signature requests:', items);

          // Map server shape to local StoredSignatureRequest shape
          serverRequests = items.map((it: any) => ({
            id: it.id,
            documentId: it.documentId || it.document_id || it.documentId,
            documentName: it.documentName || it.document_name || it.documentName || '',
            requestedBy: (it.requestedBy || it.requested_by || '').toLowerCase(),
            requestedTo: (user.address || '').toLowerCase(),
            status: (it.status || 'pending') as StoredSignatureRequest['status'],
            message: it.message || it.msg || '',
            createdAt: it.createdAt || it.created_at || new Date().toISOString(),
            expiresAt: it.expiresAt ? (typeof it.expiresAt === 'number' ? it.expiresAt : Date.parse(it.expiresAt)) : Date.now() + 7 * 24 * 60 * 60 * 1000,
          } as StoredSignatureRequest));
        } else {
          console.warn('⚠️ Server rejected signature-requests fetch', await resp.text());
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch signature requests from server:', err);
      }

      // 2) Load from localStorage and merge (local items may include ones created on this device)
      const localRequests = getSignatureRequestsForUser(user.address);
      console.log('📋 Local signature requests:', localRequests);

      // Combine server + local, dedupe by id (prefer server entry if exists)
      const combinedMap = new Map<string, StoredSignatureRequest>();
      [...serverRequests, ...localRequests].forEach((r) => {
        combinedMap.set(r.id, r);
      });

      const combined = Array.from(combinedMap.values()).filter(req => req.status !== 'declined');

      console.log(`✅ Combined signature requests count: ${combined.length}`);
      setSignatureRequests(combined as any);
      setError(null);
    } catch (error) {
      console.error('❌ Error loading signature requests:', error);
      setError('Failed to load signature requests');
    } finally {
      setLoading(false);
    }
  }, [user?.address]);

  // Sign a document
  const signDocument = async (requestId: string, documentId: string) => {
    setLoading(true);
    try {
      console.log('✍️ Signing document:', { requestId, documentId });
      
      // Update signature request status in localStorage
      updateSignatureRequestStatus(requestId, 'signed');
      console.log('✅ Updated status to signed in localStorage');

      // Persist the signature action to the server so sender and other devices see the update
      try {
        const resp = await fetchWithTimeout(`${API_BASE}/documents/${documentId}/sign`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ signerAddress: user?.address || '', signature: 'signed-via-ui' })
        });
        if (!resp.ok) {
          console.warn('⚠️ Server sign endpoint returned non-OK', await resp.text());
        } else {
          console.log('📡 Signed on server');
        }
      } catch (err) {
        console.warn('⚠️ Could not notify server of signing action:', err);
      }

      // Also update the signature request status directly (by request id) so the sender's sent-list updates reliably
      try {
        const resp2 = await fetchWithTimeout(`${API_BASE}/signature-requests/${requestId}/status`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ status: 'signed', signer: user?.address || '' })
        });
        if (!resp2.ok) {
          console.warn('⚠️ Server signature-requests status update returned non-OK', await resp2.text());
        } else {
          console.log('📡 Signature request status updated on server');
        }
      } catch (err) {
        console.warn('⚠️ Could not update signature request status on server:', err);
      }
      
      // Update local state immediately to show signed status
      setSignatureRequests(prev => {
        const updated = prev.map(req => 
          req.id === requestId 
            ? { ...req, status: 'signed' as const }
            : req
        );
        console.log(`📋 Updated UI state. Request ${requestId} is now signed.`);
        return updated;
      });
      
      toast.success('Document signed successfully!');
      
      // Dispatch custom event to notify sender (if on same device/browser)
      window.dispatchEvent(new CustomEvent('signatureRequestUpdated', {
        detail: { requestId, documentId, status: 'signed' }
      }));
      
      // Reload signature requests to ensure consistency
      setTimeout(() => loadSignatureRequests(), 500);
    } catch (error) {
      console.error('Error signing document:', error);
      toast.error('Failed to sign document');
    } finally {
      setLoading(false);
    }
  };

  // Decline a signature request
  const declineSignature = async (requestId: string, documentId: string) => {
    setLoading(true);
    try {
      console.log('❌ Declining signature request:', { requestId, documentId });
      
      // Update status in localStorage
      updateSignatureRequestStatus(requestId, 'declined');
      console.log('✅ Updated status to declined in localStorage');
      
      // Immediately remove from UI
      setSignatureRequests(prev => {
        const filtered = prev.filter(req => req.id !== requestId);
        console.log(`📋 Removed request from UI. Before: ${prev.length}, After: ${filtered.length}`);
        return filtered;
      });

      // Persist decline to server so sender and other devices see the update
      try {
        const resp = await fetchWithTimeout(`${API_BASE}/signature-requests/${requestId}/status`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ status: 'declined', signer: user?.address || '' })
        });
        if (!resp.ok) {
          console.warn('⚠️ Server decline endpoint returned non-OK', await resp.text());
        } else {
          console.log('📡 Decline persisted on server');
        }
      } catch (err) {
        console.warn('⚠️ Could not notify server of decline action:', err);
      }
      
      toast.success('Signature request declined');
      
      // Dispatch custom event to notify sender (if on same device/browser)
      window.dispatchEvent(new CustomEvent('signatureRequestUpdated', {
        detail: { requestId, documentId, status: 'declined' }
      }));
      
      // Reload to ensure consistency (slight delay to allow state to settle)
      setTimeout(() => loadSignatureRequests(), 500);
    } catch (error) {
      console.error('Error declining signature:', error);
      toast.error('Failed to decline signature request');
    } finally {
      setLoading(false);
    }
  };

  // View document inline (opens in new tab)
  const handleViewDocument = async (request: SignatureRequest) => {
    setLoadingPreview(true);
    
    try {
      console.log('👁️ Viewing document:', request.documentId);
      
      // Fetch shared files to get the encrypted key
      const sharedData = await fetchWithTimeout(`${API_BASE}/files/shared`, {
        headers: getAuthHeaders(),
      }).then(res => res.json());
      
      const sharedFile = sharedData.shares?.find((share: any) => 
        share.file_id === request.documentId || share._id === request.documentId
      );

      if (!sharedFile || !sharedFile.encrypted_key) {
        toast.error('Document access key not found. Please contact the document owner.');
        setLoadingPreview(false);
        return;
      }

      // Decrypt the encrypted key using RSA private key
      const { rsaKeyManager } = await import('@/lib/crypto/rsa');
      const privateKey = rsaKeyManager.getPrivateKey();
      
      if (!privateKey) {
        toast.error('RSA private key not found. Please generate RSA keys first.');
        setLoadingPreview(false);
        return;
      }

      const forge = (await import('node-forge')).default;
      const privateKeyObj = forge.pki.privateKeyFromPem(privateKey);
      const encryptedBytes = forge.util.decode64(sharedFile.encrypted_key);
      
      const decryptedKey = privateKeyObj.decrypt(encryptedBytes, 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: forge.mgf.mgf1.create(forge.md.sha256.create())
      });

      console.log('🔓 Decrypted passphrase for viewing');
      
      // Fetch the decrypted document
      const response = await fetchWithTimeout(
        `${API_BASE}/files/${request.documentId}?key=${encodeURIComponent(decryptedKey)}&inline=1`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch document:', response.status, errorText);
        throw new Error(`Failed to fetch document: ${errorText}`);
      }

      // Check content type
      const contentType = response.headers.get('content-type') || 'application/pdf';
      console.log('📄 Response content-type:', contentType);
      
      // Create blob and open in new tab
      const blob = await response.blob();
      console.log('📦 Blob size:', blob.size, 'type:', blob.type);
      
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');
      
      if (newWindow) {
        toast.success('Document opened in new tab');
        // Clean up after a delay
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        URL.revokeObjectURL(url);
        toast.error('Please allow popups to view the document');
      }
      
      setLoadingPreview(false);
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error('Failed to view document: ' + (error as Error).message);
      setLoadingPreview(false);
    }
  };

  // Download document for signature
  const handleDownloadDocument = async (request: SignatureRequest) => {
    setLoadingPreview(true);
    
    try {
      console.log('⬇️ Downloading document for signature:', request.documentId);
      
      // Fetch shared files to get the encrypted key
      const sharedData = await fetchWithTimeout(`${API_BASE}/files/shared`, {
        headers: getAuthHeaders(),
      }).then(res => res.json());
      
      const sharedFile = sharedData.shares?.find((share: any) => 
        share.file_id === request.documentId || share._id === request.documentId
      );

      if (!sharedFile || !sharedFile.encrypted_key) {
        toast.error('Document access key not found. Please contact the document owner.');
        setLoadingPreview(false);
        return;
      }

      // Decrypt the encrypted key using RSA private key
      const { rsaKeyManager } = await import('@/lib/crypto/rsa');
      const privateKey = rsaKeyManager.getPrivateKey();
      
      if (!privateKey) {
        toast.error('RSA private key not found. Please generate RSA keys first.');
        setLoadingPreview(false);
        return;
      }

      const forge = (await import('node-forge')).default;
      const privateKeyObj = forge.pki.privateKeyFromPem(privateKey);
      const encryptedBytes = forge.util.decode64(sharedFile.encrypted_key);
      
      const decryptedKey = privateKeyObj.decrypt(encryptedBytes, 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: forge.mgf.mgf1.create(forge.md.sha256.create())
      });

      // Fetch and download the document (decrypted)
      console.log('🔓 Decrypted passphrase:', decryptedKey.substring(0, 10) + '...');
      
      const response = await fetchWithTimeout(
        `${API_BASE}/files/${request.documentId}?key=${encodeURIComponent(decryptedKey)}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Download failed:', response.status, errorText);
        throw new Error(`Failed to fetch document: ${errorText}`);
      }

      // Check content type
      const contentType = response.headers.get('content-type');
      console.log('📄 Response content-type:', contentType);
      console.log('📄 Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Create blob and trigger download
      const blob = await response.blob();
      console.log('📦 Downloaded blob size:', blob.size, 'type:', blob.type);
      
      // Check if the blob might be encrypted (very rough heuristic)
      if (blob.size > 0) {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const first16Bytes = Array.from(uint8Array.slice(0, 16));
        console.log('🔍 First 16 bytes:', first16Bytes.map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        // PDF files should start with "%PDF" (25 50 44 46)
        const isPDF = uint8Array[0] === 0x25 && uint8Array[1] === 0x50 && uint8Array[2] === 0x44 && uint8Array[3] === 0x46;
        console.log('🔍 Looks like valid PDF:', isPDF);
        
        if (!isPDF && blob.size > 100) {
          console.warn('⚠️ File does not start with PDF magic bytes - might still be encrypted!');
          toast.error('Warning: Downloaded file may be corrupted or still encrypted. Check console logs.');
        }
        
        // Re-create blob with correct content type
        const finalBlob = new Blob([arrayBuffer], { type: contentType || 'application/octet-stream' });
        
        // Preserve original filename and extension
        let fileName = request.documentName || 'document';
        
        // Don't force .pdf extension - use the original filename as-is
        console.log('📥 Original filename:', fileName);
        console.log('📥 Content-Type:', contentType);
        
        // If somehow there's no extension, try to infer from content-type
        if (!fileName.includes('.')) {
          if (contentType?.includes('pdf')) {
            fileName += '.pdf';
          } else if (contentType?.includes('text')) {
            fileName += '.txt';
          } else if (contentType?.includes('wordprocessingml')) {
            fileName += '.docx';
          } else {
            // Default to original name without forcing extension
            console.log('⚠️ No extension in filename and unknown content-type');
          }
        }
        
        const url = URL.createObjectURL(finalBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('✅ Downloaded file:', fileName, 'with type:', contentType);
        toast.success(`Document downloaded: ${fileName}`);
      } else {
        throw new Error('Downloaded file is empty');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document: ' + (error as Error).message);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Load signature requests on mount and listen for updates
  useEffect(() => {
    loadSignatureRequests();
    
    // Listen for new signature requests
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'blockvault_signature_requests') {
        console.log('Signature requests updated, reloading...');
        loadSignatureRequests();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also reload periodically (in case of same-tab changes)
    const interval = setInterval(loadSignatureRequests, 5000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [loadSignatureRequests]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'signed':
        return 'bg-green-500/10 text-green-400';
      case 'expired':
        return 'bg-red-500/10 text-red-400';
      case 'declined':
        return 'bg-gray-500/10 text-gray-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'signed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'expired':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'declined':
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (expiresAt: number) => {
    return Date.now() > expiresAt;
  };

  if (loading && signatureRequests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Error Loading Signature Requests</h3>
        <p className="text-slate-400 mb-4">{error}</p>
        <Button onClick={loadSignatureRequests}>
          Try Again
        </Button>
      </div>
    );
  }

  const debugStorage = () => {
    console.log('🔍 DEBUG: Signature Request Storage');
    console.log('=====================================');
    console.log('Current user address:', user?.address);
    
    const rawStorage = localStorage.getItem('blockvault_signature_requests');
    console.log('Raw localStorage value:', rawStorage);
    
    if (rawStorage) {
      const parsed = JSON.parse(rawStorage);
      console.log('Parsed signature requests:', parsed);
      console.log('Total count:', parsed.length);
      
      if (parsed.length > 0) {
        parsed.forEach((req: any, idx: number) => {
          console.log(`Request ${idx + 1}:`, {
            id: req.id,
            documentName: req.documentName,
            requestedBy: req.requestedBy,
            requestedTo: req.requestedTo,
            status: req.status
          });
        });
      }
    } else {
      console.log('No signature requests in localStorage');
    }
    
    console.log('=====================================');
    toast.success('Check browser console for debug info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Signature Requests</h2>
          <p className="text-slate-400">Documents waiting for your signature</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={debugStorage} variant="outline" size="sm">
            Debug Storage
          </Button>
          <Button onClick={loadSignatureRequests} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Signature Requests List */}
      {signatureRequests.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Signature Requests</h3>
          <p className="text-slate-400">
            You don't have any pending signature requests at the moment.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {signatureRequests.map((request) => (
            <Card key={request.id} className="hover:bg-slate-800/50 transition-colors">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-slate-300" />
                    </div>
                    <div>
                      <ScrollingText
                        text={request.documentName}
                        className="font-medium text-white max-w-[240px]"
                      />
                      <p className="text-sm text-slate-400">
                        Requested by {request.requestedBy.slice(0, 6)}...{request.requestedBy.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(request.status)}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center space-x-2 text-sm">
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">{request.message}</span>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-slate-400">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>Requested {formatDate(request.createdAt)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>
                        Expires {formatDate(request.expiresAt.toString())}
                      </span>
                    </div>
                  </div>

                  {isExpired(request.expiresAt) && request.status === 'pending' && (
                    <div className="flex items-center space-x-2 text-sm text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>This signature request has expired</span>
                    </div>
                  )}
                </div>

                {request.status === 'pending' && !isExpired(request.expiresAt) && (
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => signDocument(request.id, request.documentId)}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Sign Document
                    </Button>
                    <Button
                      onClick={() => declineSignature(request.id, request.documentId)}
                      variant="outline"
                      disabled={loading}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDocument(request)}
                      disabled={loadingPreview}
                      className="mr-2"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {loadingPreview ? 'Loading...' : 'View'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocument(request)}
                      disabled={loadingPreview}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                )}

                {request.status === 'signed' && (
                  <div className="flex items-center space-x-2 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">You have signed this document</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
};
