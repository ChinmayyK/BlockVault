import React, { useState } from 'react';
import { UserPlus, Shield, Mail, Wallet, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LegalModalFrame } from '@/components/legal/modals/LegalModalFrame';
import toast from 'react-hot-toast';
import { getApiBase as resolveApiBase } from '@/lib/getApiBase';
import { readStoredUser } from '@/utils/authStorage';

interface InviteMemberModalProps {
  workspaceId: string;
  onClose: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ workspaceId, onClose }) => {
  const [recipient, setRecipient] = useState('');
  const [role, setRole] = useState<'Admin' | 'Member' | 'Viewer'>('Viewer');
  const [inviteType, setInviteType] = useState<'wallet' | 'email'>('wallet');
  const [inviting, setInviting] = useState(false);

  const API_BASE = resolveApiBase();

  const handleInvite = async () => {
    if (!recipient.trim()) {
      toast.error(`Please enter a valid ${inviteType === 'email' ? 'email address' : 'wallet address'}`);
      return;
    }

    setInviting(true);
    try {
      const user = readStoredUser() || {};
      if (!user.jwt) throw new Error("Authentication required");

      const response = await fetch(`${API_BASE}/orgs/${workspaceId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.jwt}`
        },
        body: JSON.stringify({
          recipient,
          type: inviteType,
          role: role.toUpperCase() // matching backend enums
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send invitation');
      }

      toast.success('Invitation sent securely!');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Invitation failed. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const footer = (
    <>
      <Button variant="modal-ghost" onClick={onClose} disabled={inviting}>
        Cancel
      </Button>
      <Button 
        onClick={handleInvite} 
        disabled={inviting || !recipient.trim()} 
        variant="modal-primary"
        className="min-w-[140px]"
      >
        {inviting ? 'Inviting...' : 'Send Invite'}
      </Button>
    </>
  );

  return (
    <LegalModalFrame
      icon={<UserPlus className="h-5 w-5" />}
      title="Invite Workspace Member"
      subtitle="Grant access to documents in this workspace"
      onClose={onClose}
      footer={footer}
      widthClassName="max-w-md"
      headerAccent="blue"
      className="border-blue-500/20 shadow-blue-500/10"
    >
      <div className="space-y-5">
        
        {/* Type Toggle */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 border border-border">
          <button
            onClick={() => setInviteType('wallet')}
            className={`flex-1 py-2 px-4 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all ${inviteType === 'wallet'
                ? 'bg-blue-600 shadow-lg shadow-blue-900/20 text-white translate-y-[-1px]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10'
              }`}
          >
            <Wallet className="w-4 h-4" />
            Wallet Address
          </button>
          <button
            onClick={() => setInviteType('email')}
            className={`flex-1 py-2 px-4 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all ${inviteType === 'email'
                ? 'bg-blue-600 shadow-lg shadow-blue-900/20 text-white translate-y-[-1px]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10'
              }`}
          >
            <Mail className="w-4 h-4" />
            Email Invite
          </button>
        </div>

        {/* Recipient Input */}
        <div className="space-y-3">
           <label className="text-sm font-semibold text-foreground flex items-center gap-2">
             {inviteType === 'wallet' ? 'Recipient Wallet' : 'Recipient Email'}
           </label>
           <Input 
             value={recipient}
             onChange={(e) => setRecipient(e.target.value)}
             placeholder={inviteType === 'wallet' ? '0x...' : 'colleague@company.com'}
             className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-blue-500/50"
             autoFocus
           />
        </div>

        {/* Role Selection */}
        <div className="space-y-3">
           <label className="text-sm font-semibold text-foreground flex items-center gap-2">
             <Shield className="w-4 h-4 text-blue-500" />
             Access Privileges
           </label>
           <select 
             value={role}
             onChange={(e) => setRole(e.target.value as 'Admin' | 'Member' | 'Viewer')}
             className="w-full bg-muted/50 border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer font-medium"
           >
             <option value="Admin">Admin (Full Control)</option>
             <option value="Member">Member (Upload/Edit Files)</option>
             <option value="Viewer">Viewer (Read Only)</option>
           </select>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 mt-6">
           <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-blue-300 uppercase tracking-wider">Secure Onboarding</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  When invited via email, a temporary cryptographic identity is provisioned. The user will establish their full key envelope upon their first secure login.
                </p>
              </div>
           </div>
        </div>

      </div>
    </LegalModalFrame>
  );
};
