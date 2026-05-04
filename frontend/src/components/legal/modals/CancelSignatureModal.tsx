import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, DollarSign, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { contractService, getSigner, formatDocHash } from '@/utils/contractHelpers';
import { ethers } from 'ethers';
import { LegalModalFrame } from './LegalModalFrame';

interface CancelSignatureModalProps {
  documentHash: string;
  documentName: string;
  deadline: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const CancelSignatureModal: React.FC<CancelSignatureModalProps> = ({
  documentHash,
  documentName,
  deadline,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [escrowAmount, setEscrowAmount] = useState<string>('0');

  useEffect(() => {
    const loadEscrowAmount = async () => {
      try {
        const amount = await contractService.getEscrowAmount(formatDocHash(documentHash));
        setEscrowAmount(ethers.formatEther(amount));
      } catch (error) {
        console.error('Error loading escrow amount:', error);
      }
    };
    loadEscrowAmount();
  }, [documentHash]);

  const handleCancel = async () => {
    setLoading(true);
    try {
      const signer = await getSigner();
      if (!signer) {
        setLoading(false);
        return;
      }

      await contractService.cancelSignatureRequest(formatDocHash(documentHash), signer);
      onSuccess();
    } catch (error) {
      console.error('Error cancelling signature request:', error);
    } finally {
      setLoading(false);
    }
  };

  const isPastDeadline = Date.now() > deadline;

  const footerContent = (
    <>
      <Button onClick={onClose} disabled={loading} variant="outline">
        Go Back
      </Button>
      <Button
        onClick={handleCancel}
        disabled={loading || !isPastDeadline}
        loading={loading}
        variant="destructive"
      >
        {loading ? 'Cancelling…' : 'Cancel Request'}
      </Button>
    </>
  );

  return (
    <LegalModalFrame
      icon={<AlertTriangle className="h-5 w-5 text-status-warning" />}
      title="Cancel Signature Request"
      subtitle="Reclaim escrowed funds"
      onClose={onClose}
      footer={footerContent}
      widthClassName="max-w-lg"
      headerAccent="violet"
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">Document</h4>
          <p className="font-medium text-foreground mb-3">{documentName}</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={`font-semibold ${isPastDeadline ? 'text-status-error' : 'text-status-warning'}`}>
                {isPastDeadline ? 'Deadline Passed' : 'Awaiting Signatures'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Deadline:</span>
              <span className="font-mono text-xs text-foreground">
                {new Date(deadline).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {parseFloat(escrowAmount) > 0 && (
          <div className="rounded-xl border border-status-success/30 bg-status-success/10 p-4">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-status-success" />
              <h4 className="text-sm font-semibold text-status-success">Escrow Refund</h4>
            </div>
            <p className="text-2xl font-bold text-status-success mb-1">{escrowAmount} ETH</p>
            <p className="text-xs text-muted-foreground">This amount will be refunded to your wallet.</p>
          </div>
        )}

        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-status-warning mb-1">Important</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isPastDeadline
                  ? 'The deadline has passed. You can now cancel the request and reclaim any escrowed funds.'
                  : 'You can only cancel signature requests after the deadline has passed.'}
              </p>
            </div>
          </div>
        </div>

        {!isPastDeadline && (
          <p className="text-xs text-muted-foreground text-center">
            Please wait until after the deadline to cancel.
          </p>
        )}
      </div>
    </LegalModalFrame>
  );
};

