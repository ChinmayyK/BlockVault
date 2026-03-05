import React from 'react';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LegalModalFrame } from './LegalModalFrame';
import { useNavigate } from 'react-router-dom';

interface RedactionModalProps {
  document: {
    file_id: string;
    name: string;
    cid: string;
    docHash: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export const RedactionModal: React.FC<RedactionModalProps> = ({ document, onClose, onSuccess }) => {
  const navigate = useNavigate();

  const handleLaunch = () => {
    onClose();
    onSuccess();
    navigate(`/redact/${document.file_id}`);
  };

  return (
    <LegalModalFrame
      icon={<Shield className="h-5 w-5 text-white" />}
      title="Secure Redaction"
      subtitle="Launch the full redaction workflow with ZK proof verification."
      onClose={onClose}
      widthClassName="max-w-lg"
      contentClassName="space-y-6"
      headerAccent="blue"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleLaunch}>Open Redaction</Button>
        </div>
      )}
    >
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          This action opens the primary redaction workspace where you can scan for sensitive
          entities, review highlights, and generate verifiable ZK proofs.
        </p>
        <p className="text-xs text-muted-foreground">
          Document: <span className="font-medium text-foreground">{document.name}</span>
        </p>
      </div>
    </LegalModalFrame>
  );
};
