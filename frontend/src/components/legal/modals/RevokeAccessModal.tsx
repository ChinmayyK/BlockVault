import React, { useState, useEffect } from 'react';
import { UserMinus, AlertTriangle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { contractService, getSigner, formatDocHash } from '@/utils/contractHelpers';
import toast from 'react-hot-toast';
import { LegalModalFrame } from './LegalModalFrame';

interface RevokeAccessModalProps {
  documentHash: string;
  documentName: string;
  accessList: string[]; // List of addresses with access
  onClose: () => void;
  onSuccess: () => void;
}

export const RevokeAccessModal: React.FC<RevokeAccessModalProps> = ({
  documentHash,
  documentName,
  accessList,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [verifiedAccess, setVerifiedAccess] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    // Verify each address actually has access on-chain
    const verifyAccess = async () => {
      const verified: { [key: string]: boolean } = {};
      for (const address of accessList) {
        const hasAccess = await contractService.hasPermission(formatDocHash(documentHash), address);
        verified[address] = hasAccess;
      }
      setVerifiedAccess(verified);
    };
    verifyAccess();
  }, [documentHash, accessList]);

  const handleRevoke = async () => {
    if (!selectedAddress) {
      toast.error('Please select an address to revoke');
      return;
    }

    setLoading(true);
    try {
      const signer = await getSigner();
      if (!signer) {
        setLoading(false);
        return;
      }

      await contractService.revokeAccess(formatDocHash(documentHash), selectedAddress, signer);
      onSuccess();
    } catch (error) {
      console.error('Error revoking access:', error);
    } finally {
      setLoading(false);
    }
  };

  const addressesWithAccess = accessList.filter(addr => verifiedAccess[addr]);

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
        disabled={loading || !selectedAddress}
        loading={loading}
        variant="destructive"
      >
        {loading ? 'Revoking…' : 'Revoke Access'}
      </Button>
    </>
  );

  return (
    <LegalModalFrame
      widthClassName="max-w-xl"
      title="Revoke Document Access"
      subtitle="Remove individual access rights immediately"
      icon={<UserMinus className="h-5 w-5 text-red-300" />}
      onClose={onClose}
      footer={footerContent}
      headerAccent="green"
    >
      <div className="space-y-6">
        <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-white">Document</h3>
          <p className="text-sm text-slate-300">{documentName}</p>
          <p className="text-xs font-mono text-slate-500">Hash: {documentHash}</p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-300" />
            Current access list
          </h3>
          {accessList.length === 0 ? (
            <p className="text-sm text-slate-400">No users currently have access.</p>
            ) : (
            <div className="space-y-2">
              {accessList.map((address) => (
                  <button
                    key={address}
                    onClick={() => setSelectedAddress(address)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                      selectedAddress === address
                      ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_18px_rgba(248,113,113,0.35)]'
                      : 'border-slate-800 bg-slate-900/40 hover:border-red-400/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          verifiedAccess[address] ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      <code className="text-sm font-mono text-slate-200">
                          {address.slice(0, 10)}...{address.slice(-8)}
                        </code>
                      </div>
                      {selectedAddress === address && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-red-400">
                          Selected
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
        </section>

          {selectedAddress && (
          <section className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="space-y-1 text-sm text-red-100">
                <h4 className="font-semibold text-red-200">Irreversible action</h4>
                <p>
                  Revoking access will immediately remove this wallet’s ability to view or interact with the document.
                  </p>
              </div>
            </div>
          </section>
        )}
          </div>
    </LegalModalFrame>
  );
};

