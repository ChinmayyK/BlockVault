import { Briefcase, Plus, Users, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GlowingSeparator } from "@/components/ui/glowing-separator";
import { useState, useEffect } from "react";
import { useCase } from "@/contexts/CaseContext";
import { CreateCaseModal } from "@/components/case/modals/CreateCaseModal";
import { EditCaseModal } from "@/components/case/modals/EditCaseModal";
import { ViewCaseDetailsModal } from "@/components/case/modals/ViewCaseDetailsModal";
import toast from 'react-hot-toast';

export default function CasesPage() {
  const { cases, loading, error, getCases } = useCase();
  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Debug: Log cases when they change
  useEffect(() => {
    console.log('CasesPage: cases updated', { count: cases.length, cases });
  }, [cases]);

  const activeCases = cases.filter(c => c.status === 'active');
  const closedCases = cases.filter(c => c.status === 'closed');
  const totalMembers = new Set(cases.flatMap(c => c.teamMembers || [])).size;

  const stats = [
    { label: "Total Cases", value: cases.length.toString() },
    { label: "Active Cases", value: activeCases.length.toString() },
    { label: "Closed Cases", value: closedCases.length.toString() },
    { label: "Team Members", value: totalMembers.toString() },
  ];

  const handleRefresh = async () => {
    try {
      await getCases();
      toast.success('Cases refreshed successfully');
    } catch (error) {
      console.error('Error refreshing cases:', error);
      toast.error('Failed to refresh cases');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/20 text-success border-success/30">Active</Badge>;
      case "pending":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Pending</Badge>;
      case "closed":
        return <Badge className="bg-muted/50 text-muted-foreground border-muted">Closed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">High Priority</Badge>;
      case "medium":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Medium</Badge>;
      case "low":
        return <Badge className="bg-info/20 text-info border-info/30">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  if (loading && cases.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Case Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage legal case files with role-based access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setShowCreateCaseModal(true)}>
            <Plus className="h-4 w-4" />
            New Case
          </Button>
        </div>
      </div>

      <GlowingSeparator />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-semibold mt-2">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Cases Grid */}
      {cases.length === 0 ? (
        <Card className="p-12 text-center">
          <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Cases Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first case to get started with case management
          </p>
          <Button onClick={() => setShowCreateCaseModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Case
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cases.map((caseItem) => (
            <Card key={caseItem.id} className="p-5 hover:border-accent transition-colors">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20">
                  <Briefcase className="h-6 w-6 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium mb-1">{caseItem.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {caseItem.description || 'No description'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                {getStatusBadge(caseItem.status || 'active')}
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span className="font-mono text-xs">{caseItem.caseNumber || caseItem.id}</span>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{(caseItem.teamMembers || []).length}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(caseItem.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedCaseId(caseItem.id);
                    setShowViewModal(true);
                  }}
                >
                  View Details
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedCaseId(caseItem.id);
                    setShowEditModal(true);
                  }}
                >
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateCaseModal && (
        <CreateCaseModal
          onClose={() => {
            setShowCreateCaseModal(false);
          }}
          onSuccess={(caseId: string) => {
            // Cases are automatically refetched in CaseContext.createCase
            // Optionally handle success (e.g., navigate to case detail)
            console.log('Case created with ID:', caseId);
          }}
        />
      )}

      {/* View Case Details Modal */}
      {showViewModal && selectedCaseId && (
        <ViewCaseDetailsModal
          caseId={selectedCaseId}
          onClose={() => {
            setShowViewModal(false);
            setSelectedCaseId(null);
          }}
          onEdit={() => {
            setShowViewModal(false);
            setShowEditModal(true);
          }}
        />
      )}

      {/* Edit Case Modal */}
      {showEditModal && selectedCaseId && (
        <EditCaseModal
          caseId={selectedCaseId}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCaseId(null);
          }}
          onSuccess={() => {
            // Cases are automatically refetched in CaseContext.updateCase
            getCases().catch(console.error);
          }}
        />
      )}
    </div>
  );
}
