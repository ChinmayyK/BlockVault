import React from 'react';
import { Building2, Plus, Users, FolderOpen, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { CreateOrganizationModal } from '@/components/workspaces/CreateOrganizationModal';
import toast from 'react-hot-toast';

// Dummy data
const ORGANIZATIONS = [
  {
    id: 'org-1',
    name: 'Acme Legal',
    role: 'Owner',
    members: 12,
    workspaces: 4,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    color: 'from-blue-500 to-indigo-500'
  },
  {
    id: 'org-2',
    name: 'Research Team Alpha',
    role: 'Admin',
    members: 5,
    workspaces: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    color: 'from-emerald-500 to-teal-500'
  }
];

export default function Organizations() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = React.useState(ORGANIZATIONS);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

  const handleOrgCreated = (newOrg: any) => {
    // Add to local state (mock)
    setOrganizations(prev => [newOrg, ...prev]);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shadow-inner">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Organizations</h1>
            <p className="text-muted-foreground mt-1">Manage your team workspaces and access</p>
          </div>
        </div>
        
        <Button 
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow bg-primary text-primary-foreground font-bold"
        >
          <Plus className="w-4 h-4" />
          Create Organization
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
          <Card 
            key={org.id} 
            variant="premium" 
            className="group hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden border-border"
            onClick={() => navigate(`/workspaces/${org.id}`)}
          >
            <div className={`h-2 w-full bg-gradient-to-r ${org.color}`} />
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {org.name}
                  </h3>
                  <div className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/20">
                    {org.role}
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${org.color} p-[1px] opacity-80 group-hover:opacity-100 transition-opacity`}>
                  <div className="w-full h-full bg-background rounded-[7px] flex items-center justify-center">
                    <span className="font-bold text-transparent bg-clip-text bg-gradient-to-br ${org.color}">
                      {org.name.charAt(0)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 my-6">
                <div className="bg-accent/50 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Members</span>
                  </div>
                  <p className="text-lg font-bold">{org.members}</p>
                </div>
                <div className="bg-accent/50 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Workspaces</span>
                  </div>
                  <p className="text-lg font-bold">{org.workspaces}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-border/60">
                <span className="text-xs text-muted-foreground">
                  Created {formatDistanceToNow(new Date(org.createdAt))} ago
                </span>
                <span className="text-xs font-semibold text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0">
                  View Details <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </Card>
        ))}
        
        {/* Placeholder for new org */}
        <Card 
          onClick={() => setIsCreateModalOpen(true)}
          className="border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 bg-transparent hover:bg-primary/5 transition-all duration-300 flex flex-col items-center justify-center min-h-[250px] cursor-pointer group"
        >
          <div className="w-14 h-14 rounded-full bg-muted-foreground/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors mb-4">
            <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <h3 className="text-lg font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Create New Organization
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-[200px] text-center">
            Set up a secure vault for your team or enterprise.
          </p>
        </Card>
      </div>

      {isCreateModalOpen && (
        <CreateOrganizationModal 
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={handleOrgCreated}
        />
      )}
    </div>
  );
}
