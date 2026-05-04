import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './button';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div 
        className="relative w-full max-w-md bg-black border border-white/10 shadow-2xl rounded-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isDanger 
                  ? 'bg-red-500/10 border border-red-500/20' 
                  : 'bg-accent-blue/10 border border-accent-blue/20'
              }`}>
                <AlertTriangle className={`h-5 w-5 ${isDanger ? 'text-red-500' : 'text-accent-blue'}`} />
              </div>
              <h2 className="text-xl font-semibold text-white">
                {title}
              </h2>
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="text-white/70 text-sm mb-6 pl-[52px]">
            {message}
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="modal-secondary"
              onClick={onCancel}
            >
              {cancelText}
            </Button>
            <Button
              variant={isDanger ? 'modal-danger' : 'modal-primary'}
              onClick={onConfirm}
              className={isDanger ? '' : 'shadow-[0_0_15px_hsl(var(--accent-blue-glow))]'}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
