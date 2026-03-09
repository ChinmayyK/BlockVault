import React, { useState } from 'react';
import { Building2, Shield, Info, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LegalModalFrame } from '@/components/legal/modals/LegalModalFrame';
import toast from 'react-hot-toast';
import { getApiBase as resolveApiBase } from '@/lib/getApiBase';
import { readStoredUser } from '@/utils/authStorage';

interface CreateOrganizationModalProps {
  onClose: () => void;
  onCreated: (org: any) => void;
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const API_BASE = resolveApiBase();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter an organization name');
      return;
    }

    setCreating(true);
    try {
      const user = readStoredUser() || {};
      if (!user.jwt) throw new Error("Authentication required");

      const response = await fetch(`${API_BASE}/orgs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.jwt}`
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create organization');
      }

      const newOrg = await response.json();
      toast.success(`Organization "${name}" created successfully!`);
      onCreated(newOrg);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Creation failed. Please try again.');
      // Mock for demo if backend is not ready
      if (error.message.includes('Failed to fetch') || error.message.includes('404')) {
         console.warn("Backend not found, simulating success for UI demo");
         const mockOrg = {
            id: 'org-' + Math.random().toString(36).substr(2, 9),
            name: name.trim(),
            role: 'Owner',
            members: 1,
            workspaces: 0,
            createdAt: new Date().toISOString(),
            color: 'from-purple-500 to-pink-500'
         };
         toast.success(`Organization "${name}" created (Simulated)!`);
         onCreated(mockOrg);
         onClose();
      }
    } finally {
      setCreating(false);
    }
  };

  const footer = (
    <>
      <Button variant="modal-ghost" onClick={onClose} disabled={creating}>
        Cancel
      </Button>
      <Button 
        onClick={handleCreate} 
        disabled={creating || !name.trim()} 
        className="min-w-[160px] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-900/20"
      >
        {creating ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Creating...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4" />
            <span>Launch Org</span>
          </div>
        )}
      </Button>
    </>
  );

  return (
    <LegalModalFrame
      icon={<Building2 className="h-5 w-5" />}
      title="Create New Organization"
      subtitle="Establish a professional vault for your team"
      onClose={onClose}
      footer={footer}
      widthClassName="max-w-md"
      headerAccent="blue"
    >
      <div className="space-y-6">
        
        {/* Name Input */}
        <div className="space-y-3">
           <label className="text-sm font-semibold text-foreground flex items-center gap-2">
             Organization Name
           </label>
           <Input 
             value={name}
             onChange={(e) => setName(e.target.value)}
             placeholder="e.g. Acme Research Lab"
             className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-purple-500/50"
             autoFocus
           />
        </div>

        {/* Description Input */}
        <div className="space-y-3">
           <label className="text-sm font-semibold text-foreground flex items-center gap-2">
             Description (Optional)
           </label>
           <textarea 
             value={description}
             onChange={(e) => setDescription(e.target.value)}
             placeholder="Briefly describe the purpose of this organization..."
             className="w-full min-h-[100px] bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none"
           />
        </div>

        <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-4">
           <div className="flex gap-3">
              <Shield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-purple-300 uppercase tracking-wider">Enterprise-Grade Security</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Organizations provide a shared encryption context. All documents uploaded to this organization are accessible only by authorized members using their unique cryptographic identities.
                </p>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-2 px-1">
           <Info className="w-4 h-4 text-muted-foreground" />
           <p className="text-[10px] text-muted-foreground">
             As the creator, you will be assigned the <b>OWNER</b> role with full administrative privileges.
           </p>
        </div>

      </div>
    </LegalModalFrame>
  );
};
