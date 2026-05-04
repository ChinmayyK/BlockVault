import React, { useState } from 'react';
import { PenTool, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { ScrollingText } from '@/components/ui/ScrollingText';
import { LegalModalFrame } from './LegalModalFrame';
import { getApiBase as resolveApiBase } from '@/lib/getApiBase';
import { readStoredUser } from '@/utils/authStorage';

interface ESignatureModalProps {
  document: {
    file_id: string;
    name: string;
    docHash: string;
    status: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export const ESignatureModal: React.FC<ESignatureModalProps> = ({ document, onClose, onSuccess }) => {
  const { user } = useAuth();
  const API_BASE = resolveApiBase();
  const getAuthHeaders = () => {
    const stored = readStoredUser() || {};
    if (!stored.jwt) {
      throw new Error('No authentication token found. Please login again.');
    }
    return {
      'Authorization': `Bearer ${stored.jwt}`,
      'Content-Type': 'application/json',
    };
  };
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'request' | 'signing' | 'complete'>('request');
  const [signatureRequest, setSignatureRequest] = useState({
    signers: [] as string[],
    escrowAmount: '',
    deadline: '',
    customMessage: ''
  });
  const [signatureStatus, setSignatureStatus] = useState<{
    required: number;
    completed: number;
    signers: { address: string; signed: boolean; signature?: string }[];
  }>({
    required: 0,
    completed: 0,
    signers: []
  });

  const handleRequestSignatures = async () => {
    setLoading(true);

    try {
      // Validate inputs
      if (signatureRequest.signers.length === 0) {
        toast.error('Please specify at least one signer');
        return;
      }

      if (signatureRequest.deadline && new Date(signatureRequest.deadline) <= new Date()) {
        toast.error('Deadline must be in the future');
        return;
      }

      // Send signature request to backend
      const response = await fetchWithTimeout(`${API_BASE}/documents/${document.file_id}/request-signature`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          signers: signatureRequest.signers.map(addr => ({
            address: addr,
            name: '',
            email: ''
          })),
          requestedBy: user?.address || '',
          documentName: document.name,
          message: signatureRequest.customMessage || 'Please sign this document',
          expiresAt: signatureRequest.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to request signatures: ${response.status}`);
      }

      await response.json();
      
      setSignatureStatus({
        required: signatureRequest.signers.length,
        completed: 0,
        signers: signatureRequest.signers.map(addr => ({ address: addr, signed: false }))
      });

      setStep('signing');
      toast.success('Signature request sent successfully!');

    } catch (error) {
      console.error('Error requesting signatures:', error);
      toast.error('An error occurred while requesting signatures.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignDocument = async () => {
    if (!user?.address) {
      toast.error('Please connect your wallet to sign');
      return;
    }

    setLoading(true);

    try {
      // Simulate signing process
      const signature = await signDocumentHash(document.docHash);
      
      // Send signature to backend
      const response = await fetchWithTimeout(`${API_BASE}/documents/${document.file_id}/sign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          signerAddress: user.address,
          signature: signature,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sign document: ${response.status}`);
      }

      await response.json();
      
      // Update signature status
      setSignatureStatus(prev => {
        const updatedSigners = prev.signers.map(signer => 
          signer.address.toLowerCase() === user.address?.toLowerCase() 
            ? { ...signer, signed: true, signature }
            : signer
        );
        
        const completed = updatedSigners.filter(s => s.signed).length;
        
        return {
          ...prev,
          completed,
          signers: updatedSigners
        };
      });

      if (signatureStatus.completed + 1 >= signatureStatus.required) {
        setStep('complete');
        toast.success('All signatures collected! Contract executed.');
      } else {
        toast.success('Your signature has been recorded!');
      }

    } catch (error) {
      console.error('Error signing document:', error);
      toast.error('An error occurred while signing.');
    } finally {
      setLoading(false);
    }
  };

  // Placeholder functions
  // const requestSignaturesOnChain = async () => {
  //   // Simulate smart contract call
  //   await new Promise(resolve => setTimeout(resolve, 2000));
  //   console.log('Signature request sent:', signatureRequest);
  // };

  const signDocumentHash = async (docHash: string): Promise<string> => {
    // Simulate MetaMask signing
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `0x${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  };

  const isSignerRequired = () => {
    if (!user?.address) return false;
    return signatureRequest.signers.some(addr => 
      addr.toLowerCase() === user.address?.toLowerCase()
    );
  };

  const canSign = () => {
    if (!user?.address) return false;
    const signer = signatureStatus.signers.find(s => 
      s.address.toLowerCase() === user.address?.toLowerCase()
    );
    return signer && !signer.signed;
  };

  const footerContent = (
    <>
          <Button
            onClick={onClose}
            variant="ghost"
        className="border border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/70 hover:text-white"
          >
        {step === 'complete' ? 'Close' : 'Cancel'}
      </Button>
      {step === 'request' && (
        <Button onClick={handleRequestSignatures} loading={loading}>
          Request Signatures
          </Button>
      )}
    </>
  );

  return (
    <LegalModalFrame
      widthClassName="max-w-2xl"
      title="E-Signature & Escrow"
      subtitle="Coordinate blockchain-backed contract execution"
      icon={<PenTool className="h-5 w-5 text-blue-200" />}
      onClose={onClose}
      footer={footerContent}
    >
        {/* Document Info */}
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="font-medium text-white mb-2">Document</h3>
          <ScrollingText text={document.name} className="block text-sm text-slate-400" />
          <p className="text-xs text-slate-500 font-mono">{document.docHash}</p>
        </section>

        {/* Request Signatures */}
        {step === 'request' && (
          <div className="space-y-6">
            <section className="space-y-3">
              <label className="block text-sm font-medium text-white">Required Signers</label>
              <Input
                type="text"
                placeholder="Enter signer addresses separated by commas"
              value={signatureRequest.signers.join(', ')}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSignatureRequest((prev) => ({
                    ...prev,
                    signers: e.target.value
                      .split(',')
                      .map((addr) => addr.trim())
                      .filter(Boolean),
                  }))
                }
              />
              <p className="text-xs text-slate-500">Use valid wallet addresses for all signers.</p>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Escrow Amount (ETH)</label>
              <Input
                type="number"
              value={signatureRequest.escrowAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSignatureRequest((prev) => ({ ...prev, escrowAmount: e.target.value }))
                  }
                  placeholder="Optional"
              />
                <p className="text-xs text-slate-500">Funds held until all signatures are complete.</p>
            </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Deadline</label>
              <Input
              type="datetime-local"
              value={signatureRequest.deadline}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSignatureRequest((prev) => ({ ...prev, deadline: e.target.value }))
                  }
              />
                <p className="text-xs text-slate-500">Leave blank to use the default 7-day window.</p>
            </div>
            </section>

            <section className="space-y-2">
              <label className="block text-sm font-medium text-white">Custom Message</label>
              <textarea
                value={signatureRequest.customMessage}
                onChange={(e) =>
                  setSignatureRequest((prev) => ({ ...prev, customMessage: e.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Include any additional context for your signers."
              />
            </section>

            <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-amber-400" />
                <div>
                  <h4 className="font-semibold text-amber-200">Legal Notice</h4>
                  <p className="text-sm text-amber-100">
                    Requesting signatures initiates a binding contract workflow. All signers will be notified and the document will be executed once signatures are complete.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {step === 'signing' && (
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <h3 className="text-lg font-semibold text-white">Sign Document</h3>
              <p className="text-sm text-slate-400">
              Complete your signature to finalize this contract. Once all parties sign, funds will be released automatically.
            </p>
            <Button
              onClick={() => setStep('complete')}
              className="w-full bg-emerald-500 text-white hover:bg-emerald-400"
            >
              Sign & Execute
                </Button>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Contract Executed!</h3>
            <p className="text-slate-400 mb-4">
              All signatures have been collected and the smart contract has been executed.
            </p>
            {signatureRequest.escrowAmount && (
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-sm text-slate-400">Escrow Amount Released:</p>
                <p className="text-lg font-semibold text-white">{signatureRequest.escrowAmount} ETH</p>
              </div>
            )}
          </div>
          )}
        </div>
    </LegalModalFrame>
  );
};
