import React, { useState } from 'react';
import { AlertTriangle, FileX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { contractService, getSigner, formatDocHash } from '@/utils/contractHelpers';
import toast from 'react-hot-toast';
import { LegalModalFrame } from './LegalModalFrame';

interface RevokeDocumentModalProps {
  documentHash: string;
  documentName: string;
  documentStatus: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const RevokeDocumentModal: React.FC<RevokeDocumentModalProps> = ({
  documentHash,
  documentName,
  documentStatus,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const handleRevoke = async () => {
    if (confirmation.toLowerCase() !== 'revoke') {
      toast.error('Please type REVOKE to confirm');
      return;
    }

    setLoading(true);
    try {
      const signer = await getSigner();
      if (!signer) {
        setLoading(false);
        return;
      }

      await contractService.revokeDocument(formatDocHash(documentHash), signer);
      onSuccess();
    } catch (error) {
      console.error('Error revoking document:', error);
    } finally {
      setLoading(false);
    }
  };

  const footerContent = (
    <>
            <Button
              onClick={onClose}
              disabled={loading}
        variant="ghost"
        className="border border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/70 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevoke}
              disabled={loading || confirmation.toLowerCase() !== 'revoke'}
              loading={loading}
        variant="destructive"
            >
        {loading ? 'Revoking…' : 'Revoke Document'}
            </Button>
    </>
  );

  return (
    <LegalModalFrame
      widthClassName="max-w-lg"
      title="Revoke Document"
      subtitle="Permanently mark this document as invalid"
      icon={<FileX className="h-5 w-5 text-red-300" />}
      onClose={onClose}
      footer={footerContent}
      headerAccent="green"
    >
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-white">Document</h3>
          <p className="text-sm text-slate-300">{documentName}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Current status:</span>
            <span className="rounded-full bg-slate-800/70 px-3 py-1 font-semibold uppercase text-white">
              {documentStatus.replace('_', ' ')}
            </span>
          </div>
          <p className="mt-2 text-xs font-mono text-slate-500">Document Hash: {documentHash}</p>
        </section>

        <section className="rounded-xl border border-red-500/25 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="space-y-1 text-sm text-red-100">
              <h4 className="font-semibold text-red-200">Irreversible action</h4>
              <p>
                Revoking this document will mark it as invalid on-chain. Recipients will no longer trust this document and the action is recorded permanently.
              </p>
          </div>
        </div>
        </section>

        <section className="space-y-3">
          <label className="block text-sm font-semibold text-white">
            Type <code className="rounded bg-red-500/10 px-2 py-1 font-mono text-red-400">REVOKE</code> to confirm
          </label>
          <Input
            type="text"
            placeholder="Type REVOKE"
            value={confirmation}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmation(e.target.value)}
            error={confirmation && confirmation.toLowerCase() !== 'revoke' ? 'Must type REVOKE exactly' : undefined}
            className="font-mono"
          />
        </section>
    </div>
    </LegalModalFrame>
  );
};

