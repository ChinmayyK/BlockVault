import React, { useState, useEffect } from 'react';
import { X, Users, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCase } from '@/contexts/CaseContext';
import { useRBAC } from '@/contexts/RBACContext';
import { CaseFile, PracticeArea, CasePriority } from '@/types/caseManagement';
import { UserRole, CaseMember, getRoleDisplayName, getRoleDescription } from '@/types/rbac';
import { GlowingSeparator } from '@/components/ui/glowing-separator';
import toast from 'react-hot-toast';

interface EditCaseModalProps {
  caseId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditCaseModal: React.FC<EditCaseModalProps> = ({ caseId, onClose, onSuccess }) => {
  const { getCase, updateCase } = useCase();
  const { currentUser } = useRBAC();
  const [loading, setLoading] = useState(false);
  const [loadingCase, setLoadingCase] = useState(true);
  const [step, setStep] = useState<'basic' | 'team' | 'review'>('basic');
  
  const [formData, setFormData] = useState<Partial<CaseFile>>({
    title: '',
    description: '',
    clientName: '',
    matterNumber: '',
    practiceArea: 'corporate',
    priority: 'medium',
    status: 'active',
    team: [],
  });

  const [teamMembers, setTeamMembers] = useState<CaseMember[]>([]);
  const [newMember, setNewMember] = useState({
    walletAddress: '',
    name: '',
    email: '',
    role: 'associate' as UserRole
  });

  const practiceAreas: PracticeArea[] = [
    'corporate', 'litigation', 'real-estate', 'family', 'criminal',
    'immigration', 'intellectual-property', 'employment', 'tax', 'other'
  ];

  const priorities: CasePriority[] = ['low', 'medium', 'high', 'urgent'];

  // Load case data on mount
  useEffect(() => {
    const loadCase = async () => {
      try {
        setLoadingCase(true);
        const caseData = await getCase(caseId);
        setFormData({
          title: caseData.title || '',
          description: caseData.description || '',
          clientName: caseData.clientName || '',
          matterNumber: caseData.matterNumber || '',
          practiceArea: caseData.practiceArea || 'corporate',
          priority: caseData.priority || 'medium',
          status: caseData.status || 'active',
        });
        setTeamMembers(caseData.team || []);
      } catch (error) {
        console.error('Error loading case:', error);
        toast.error('Failed to load case data');
        onClose();
      } finally {
        setLoadingCase(false);
      }
    };

    loadCase();
  }, [caseId, getCase, onClose]);

  const addTeamMember = () => {
    if (!newMember.walletAddress || !newMember.name) {
      toast.error('Please fill in wallet address and name');
      return;
    }

    if (teamMembers.some(member => member.walletAddress === newMember.walletAddress)) {
      toast.error('This wallet address is already added to the team');
      return;
    }

    const member: CaseMember = {
      walletAddress: newMember.walletAddress,
      role: newMember.role,
      name: newMember.name,
      email: newMember.email,
      addedAt: new Date(),
      addedBy: currentUser?.walletAddress || 'unknown'
    };

    setTeamMembers(prev => [...prev, member]);
    setNewMember({
      walletAddress: '',
      name: '',
      email: '',
      role: 'associate'
    });
    toast.success('Team member added successfully');
  };

  const removeTeamMember = (walletAddress: string) => {
    setTeamMembers(prev => prev.filter(member => member.walletAddress !== walletAddress));
    toast.success('Team member removed');
  };

  const updateMemberRole = (walletAddress: string, newRole: UserRole) => {
    setTeamMembers(prev => 
      prev.map(member => 
        member.walletAddress === walletAddress 
          ? { ...member, role: newRole }
          : member
      )
    );
  };

  const handleInputChange = (field: keyof CaseFile, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.clientName || !formData.matterNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const updates = {
        ...formData,
        team: teamMembers,
        updatedAt: new Date()
      };

      await updateCase(caseId, updates);
      toast.success('Case updated successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating case:', error);
      // Error toast is handled inside CaseContext.updateCase
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = (stepName: string) => {
    if (step === stepName) {
      return <div className="w-6 h-6 bg-accent-blue rounded-full flex items-center justify-center shadow-[0_0_15px_hsl(var(--accent-blue-glow))]">
        <div className="w-3 h-3 bg-black rounded-full animate-pulse" />
      </div>;
    }
    return <div className="w-6 h-6 bg-white/10 rounded-full border border-white/20" />;
  };

  if (loadingCase) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[999]">
        <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[999] p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-black border border-white/10 rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Edit Case</h2>
            <Button variant="modal-ghost" onClick={onClose} className="text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {getStepIcon('basic')}
                <span className={`text-sm ${step === 'basic' ? 'text-accent-blue' : 'text-white/40'}`}>
                  Basic Info
                </span>
              </div>
              <div className="w-8 h-px bg-white/20" />
              <div className="flex items-center space-x-2">
                {getStepIcon('team')}
                <span className={`text-sm ${step === 'team' ? 'text-accent-blue' : 'text-white/40'}`}>
                  Team
                </span>
              </div>
              <div className="w-8 h-px bg-white/20" />
              <div className="flex items-center space-x-2">
                {getStepIcon('review')}
                <span className={`text-sm ${step === 'review' ? 'text-accent-blue' : 'text-white/40'}`}>
                  Review
                </span>
              </div>
            </div>
          </div>

          {/* Step 1: Basic Information */}
          {step === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Case Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    placeholder="e.g., Acme Corp Merger"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={formData.clientName || ''}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    placeholder="e.g., Acme Corporation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Matter Number *
                  </label>
                  <input
                    type="text"
                    value={formData.matterNumber || ''}
                    onChange={(e) => handleInputChange('matterNumber', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    placeholder="e.g., 2024-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Practice Area
                  </label>
                  <select
                    value={formData.practiceArea || 'corporate'}
                    onChange={(e) => handleInputChange('practiceArea', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  >
                    {practiceAreas.map(area => (
                      <option key={area} value={area}>
                        {area.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority || 'medium'}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  >
                    {priorities.map(priority => (
                      <option key={priority} value={priority}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  >
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                    <option value="closed">Closed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  placeholder="Brief description of the case..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Team Members */}
          {step === 'team' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-white">Team Members</h3>
                  <p className="text-sm text-slate-400">
                    Add team members with specific roles and permissions
                  </p>
                </div>
              </div>

              {/* Add New Member Form */}
              <Card className="p-6">
                <h4 className="font-medium text-white mb-4">Add Team Member</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Wallet Address *
                    </label>
                    <Input
                      value={newMember.walletAddress}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMember(prev => ({ ...prev, walletAddress: e.target.value }))}
                      placeholder="0x..."
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Name *
                    </label>
                    <Input
                      value={newMember.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={newMember.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Role *
                    </label>
                    <select
                      value={newMember.role}
                      onChange={(e) => setNewMember(prev => ({ ...prev, role: e.target.value as UserRole }))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    >
                      <option value="associate">Associate Attorney</option>
                      <option value="paralegal">Paralegal</option>
                      <option value="client">Client</option>
                      <option value="external-counsel">External Counsel</option>
                    </select>
                  </div>
                </div>
                <Button onClick={addTeamMember} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Member
                </Button>
              </Card>

              {/* Team Members List */}
              <div className="space-y-4">
                <h4 className="font-medium text-white">Current Team Members</h4>
                {teamMembers.map((member, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h5 className="font-medium text-white">{member.name}</h5>
                        <p className="text-sm text-white/60 font-mono">{member.walletAddress}</p>
                        {member.email && (
                          <p className="text-sm text-white/60">{member.email}</p>
                        )}
                      </div>
                      <Button
                        variant="modal-ghost"
                        size="sm"
                        onClick={() => removeTeamMember(member.walletAddress)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-white/60">Role: </span>
                        <span className="text-sm font-medium text-accent-blue">
                          {getRoleDisplayName(member.role)}
                        </span>
                      </div>
                      <select
                        value={member.role}
                        onChange={(e) => updateMemberRole(member.walletAddress, e.target.value as UserRole)}
                        className="px-2 py-1 bg-white/5 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue"
                      >
                        <option value="associate">Associate Attorney</option>
                        <option value="paralegal">Paralegal</option>
                        <option value="client">Client</option>
                        <option value="external-counsel">External Counsel</option>
                      </select>
                    </div>
                    
                    <div className="mt-2">
                      <p className="text-xs text-white/40">
                        {getRoleDescription(member.role)}
                      </p>
                    </div>
                  </Card>
                ))}
                
                {teamMembers.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-white/40 mx-auto mb-3" />
                    <p className="text-white/40">No team members added yet</p>
                    <p className="text-sm text-slate-500">Add team members to collaborate on this case</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Case Summary</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-400">Title</label>
                      <p className="text-white">{formData.title}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">Client</label>
                      <p className="text-white">{formData.clientName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">Matter Number</label>
                      <p className="text-white">{formData.matterNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">Practice Area</label>
                      <p className="text-white">{formData.practiceArea}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">Priority</label>
                      <p className="text-white">{formData.priority}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">Status</label>
                      <p className="text-white">{formData.status}</p>
                    </div>
                  </div>
                  
                  {formData.description && (
                    <div>
                      <label className="text-sm font-medium text-slate-400">Description</label>
                      <p className="text-white">{formData.description}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium text-slate-400">Team Members</label>
                    <p className="text-white">{teamMembers.length} members</p>
                    {teamMembers.map((member, index) => (
                      <div key={index} className="text-sm text-slate-300 ml-4">
                        {member.name} ({member.role}) - {member.walletAddress.slice(0, 10)}...
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <div>
              {step !== 'basic' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (step === 'team') setStep('basic');
                    if (step === 'review') setStep('team');
                  }}
                >
                  Previous
                </Button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <Button variant="modal-secondary" onClick={onClose}>
                Cancel
              </Button>
              
              {step !== 'review' ? (
                <Button
                  onClick={() => {
                    if (step === 'basic') setStep('team');
                    if (step === 'team') setStep('review');
                  }}
                  variant="modal-primary"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  variant="modal-primary"
                  className="shadow-[0_0_20px_hsl(var(--accent-blue-glow))]"
                >
                  {loading ? 'Updating...' : 'Update Case'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

