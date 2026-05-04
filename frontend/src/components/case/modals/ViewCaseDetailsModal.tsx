import React, { useState, useEffect } from 'react';
import { X, Briefcase, Users, Calendar, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCase } from '@/contexts/CaseContext';
import { CaseFile } from '@/types/caseManagement';
import { getRoleDisplayName } from '@/types/rbac';
import toast from 'react-hot-toast';

interface ViewCaseDetailsModalProps {
  caseId: string;
  onClose: () => void;
  onEdit?: () => void;
}

export const ViewCaseDetailsModal: React.FC<ViewCaseDetailsModalProps> = ({ caseId, onClose, onEdit }) => {
  const { getCase } = useCase();
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<CaseFile | null>(null);

  useEffect(() => {
    const loadCase = async () => {
      try {
        setLoading(true);
        const data = await getCase(caseId);
        setCaseData(data);
      } catch (error) {
        console.error('Error loading case:', error);
        toast.error('Failed to load case details');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadCase();
  }, [caseId, getCase, onClose]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/20 text-success border-success/30">Active</Badge>;
      case "pending":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Pending</Badge>;
      case "closed":
        return <Badge className="bg-muted/50 text-muted-foreground border-muted">Closed</Badge>;
      case "on-hold":
        return <Badge className="bg-warning/20 text-warning border-warning/30">On Hold</Badge>;
      case "archived":
        return <Badge className="bg-muted/50 text-muted-foreground border-muted">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
      case "urgent":
        return <Badge variant="destructive">High Priority</Badge>;
      case "medium":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Medium</Badge>;
      case "low":
        return <Badge className="bg-info/20 text-info border-info/30">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[999]">
        <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[999]">
        <Card className="p-6 max-w-md">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Case Not Found</h3>
            <p className="text-slate-400 mb-4">The case you're looking for doesn't exist or has been deleted.</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[999] p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-black border border-white/10 rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-accent-blue/20 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-accent-blue" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{caseData.title}</h2>
                  <p className="text-sm text-slate-400 font-mono mt-1">
                    {caseData.matterNumber || caseData.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {getStatusBadge(caseData.status || 'active')}
                {getPriorityBadge(caseData.priority || 'medium')}
              </div>
            </div>
            <Button variant="modal-ghost" onClick={onClose} className="text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Case Details */}
          <div className="space-y-6">
            {/* Basic Information */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-400">Client Name</label>
                  <p className="text-white mt-1">{caseData.clientName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">Practice Area</label>
                  <p className="text-white mt-1 capitalize">
                    {caseData.practiceArea?.replace('-', ' ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">Created</label>
                  <p className="text-white mt-1">
                    {caseData.createdAt 
                      ? new Date(caseData.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">Last Updated</label>
                  <p className="text-white mt-1">
                    {caseData.updatedAt 
                      ? new Date(caseData.updatedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>
              {caseData.description && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-400">Description</label>
                  <p className="text-white mt-1 whitespace-pre-wrap">{caseData.description}</p>
                </div>
              )}
            </Card>

            {/* Team Members */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Members
                </h3>
                <Badge variant="outline">
                  {(caseData.team || []).length} member{(caseData.team || []).length !== 1 ? 's' : ''}
                </Badge>
              </div>
              {caseData.team && caseData.team.length > 0 ? (
                <div className="space-y-3">
                  {caseData.team.map((member, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex-1">
                        <p className="font-medium text-white">{member.name || 'Unknown'}</p>
                        <p className="text-sm text-slate-400 font-mono">{member.walletAddress}</p>
                        {member.email && (
                          <p className="text-sm text-slate-400">{member.email}</p>
                        )}
                      </div>
                      <Badge className="bg-accent-blue/20 text-accent-blue border-accent-blue/30">
                        {getRoleDisplayName(member.role)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-400">No team members assigned</p>
                </div>
              )}
            </Card>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Documents</p>
                    <p className="text-xl font-semibold text-white">
                      {(caseData.documents || []).length}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Tasks</p>
                    <p className="text-xl font-semibold text-white">
                      {(caseData.tasks || []).length}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Deadlines</p>
                    <p className="text-xl font-semibold text-white">
                      {(caseData.deadlines || []).length}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-white/10">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {onEdit && (
              <Button onClick={onEdit} variant="default">
                Edit Case
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

