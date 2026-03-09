import React, { useState } from 'react';
import { UserPlus, Settings, FolderOpen, Users, Activity, ShieldAlert, X } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { InviteMemberModal } from '@/components/workspaces/InviteMemberModal';
import { FileList } from '@/components/file/FileList';

export default function WorkspaceDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState('files');

  // Dummy user context to simulate roles
  const currentUserRole = 'Admin'; // Suppose the current user is an Admin
  const canInvite = currentUserRole === 'Admin' || currentUserRole === 'Owner';

  const dummyFiles = [
    { id: '1', name: 'Due_Diligence_Report.pdf', size: 1024 * 1024 * 2.5, created_at: new Date().toISOString(), type: 'my-files' },
    { id: '2', name: 'Acquisition_Agreement_Draft.docx', size: 1024 * 512, created_at: new Date().toISOString(), type: 'my-files' }
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 cursor-pointer hover:text-primary transition-colors" onClick={() => navigate('/orgs')}>
            <span className="font-semibold uppercase tracking-wider">Organizations</span>
            <span>/</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Mergers 2026</h1>
          <p className="text-muted-foreground mt-1">Acme Legal</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </Button>
          {canInvite && (
            <Button 
              onClick={() => setShowInviteModal(true)} 
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
            >
              <UserPlus className="w-4 h-4" />
              Invite Member
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="files" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="w-4 h-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="w-4 h-4" />
            Activity Log
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="files" className="mt-6">
          <FileList 
            files={dummyFiles} 
            type="my-files" 
            workspaceContext="Mergers 2026"
            viewMode="grid"
          />
        </TabsContent>
        
        <TabsContent value="members" className="mt-6">
          <Card variant="premium" className="overflow-hidden">
            <table className="w-full text-sm text-left">
               <thead className="bg-muted border-b border-border/60">
                 <tr>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Member</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Role</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Joined</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-border/60">
                 {/* Current User */}
                 <tr className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                           <span className="font-bold text-primary">Y</span>
                         </div>
                         <div>
                            <p className="font-medium text-foreground">You</p>
                            <p className="text-xs text-muted-foreground">0x12..34xx</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                         {currentUserRole}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                       Jan 12, 2026
                    </td>
                    <td className="px-6 py-4 text-right">
                       <span className="text-muted-foreground text-xs italic">Current User</span>
                    </td>
                 </tr>
                 {/* Dummy User */}
                 <tr className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                           <span className="font-bold text-muted-foreground">A</span>
                         </div>
                         <div>
                            <p className="font-medium text-foreground">Alice Lawyer</p>
                            <p className="text-xs text-muted-foreground">0x99..12xx</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-muted text-muted-foreground border border-border">
                         Viewer
                       </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                       Mar 01, 2026
                    </td>
                    <td className="px-6 py-4 text-right">
                       <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 h-8" disabled={!canInvite}>
                         <X className="w-3.5 h-3.5" />
                         Remove
                       </Button>
                    </td>
                 </tr>
               </tbody>
            </table>
          </Card>
        </TabsContent>
        
        <TabsContent value="activity" className="mt-6">
           <Card variant="premium" className="p-6">
              <div className="space-y-6">
                 {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4">
                       <div className="relative mt-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/20 z-10 relative" />
                          {i !== 3 && <div className="absolute top-4 left-1/2 -ml-[1px] w-[2px] h-12 bg-border z-0" />}
                       </div>
                       <div>
                          <p className="text-sm">
                            <span className="font-semibold text-foreground">Alice Lawyer</span> viewed document <span className="font-mono text-primary bg-primary/10 px-1 py-0.5 rounded">Discovery_Notes_V2.pdf</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                       </div>
                    </div>
                 ))}
              </div>
           </Card>
        </TabsContent>
      </Tabs>

      {showInviteModal && (
        <InviteMemberModal 
          workspaceId={id || ''} 
          onClose={() => setShowInviteModal(false)} 
        />
      )}
    </div>
  );
}
