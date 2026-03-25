import React, { useState, useEffect } from 'react';
import { UserPlus, Settings, FolderOpen, Users, Activity, ShieldAlert, X, Lock } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { InviteMemberModal } from '@/components/workspaces/InviteMemberModal';
import { FileList } from '@/components/file/FileList';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBase } from '@/lib/getApiBase';
import { useFiles } from '@/contexts/FileContext';
import toast from 'react-hot-toast';

export default function WorkspaceDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeWorkspace, activeWorkspaceKey, setActiveWorkspace, isLoading: wsLoading } = useWorkspace();
  const { user } = useAuth();
  const { downloadFile } = useFiles();
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState('files');
  const [files, setFiles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // Set the active workspace whenever the ID changes
  useEffect(() => {
    if (id && (!activeWorkspace || activeWorkspace.workspace_id !== id)) {
      setActiveWorkspace(id);
    }
  }, [id, activeWorkspace, setActiveWorkspace]);

  // Fetch files and members when workspace is active
  useEffect(() => {
    if (!activeWorkspace || !user?.jwt) return;

    const fetchWorkspaceData = async () => {
      try {
        setFilesLoading(true);
        // Fetch files scoped to this workspace
        const resFiles = await fetch(`${getApiBase()}/files/?workspace_id=${activeWorkspace.workspace_id}`, {
          headers: { 'Authorization': `Bearer ${user.jwt}` }
        });
        if (resFiles.ok) {
          const data = await resFiles.json();
          setFiles(data.files || data.items || []);
        }

        // Fetch members
        const resMembers = await fetch(`${getApiBase()}/workspaces/${activeWorkspace.workspace_id}`, {
          headers: { 'Authorization': `Bearer ${user.jwt}` }
        });
        if (resMembers.ok) {
          const data = await resMembers.json();
          setMembers(data.members || []);
        }
      } catch (err) {
        console.error('Failed to fetch workspace data:', err);
      } finally {
        setFilesLoading(false);
      }
    };

    fetchWorkspaceData();
  }, [activeWorkspace, user?.jwt]);

  const currentUserRole = activeWorkspace?.role || 'VIEWER';
  const canInvite = currentUserRole === 'WORKSPACE_OWNER' || currentUserRole === 'WORKSPACE_ADMIN';

  const handleDownload = async (fileId: string, file: any) => {
    if (!activeWorkspaceKey) {
      toast.error('Workspace Key not available. Is your Vault unlocked?');
      return;
    }
    // Pass the activeWorkspaceKey as the "passphrase" for decryption fallback in downloadFile
    await downloadFile(fileId, activeWorkspaceKey, false, undefined, file.name || file.file_name);
  };

  if (!activeWorkspace && !wsLoading) {
    return <div className="p-8 text-center text-muted-foreground">Workspace not found or access denied.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 cursor-pointer hover:text-primary transition-colors" onClick={() => navigate('/orgs')}>
            <span className="font-semibold uppercase tracking-wider">Organizations</span>
            <span>/</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {activeWorkspace?.name || 'Loading Workspace...'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm bg-muted/30 inline-block px-2 py-0.5 rounded border border-border mt-2">
            Workspace ID: <span className="font-mono">{activeWorkspace?.workspace_id || id}</span>
          </p>
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

      {!activeWorkspaceKey && activeWorkspace && (
        <Card className="bg-amber-500/10 border-amber-500/20 p-4 flex items-start gap-4 animate-pulse">
          <Lock className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-500">Workspace Locked</h3>
            <p className="text-xs text-amber-500/80 mt-1">Your Vault is locked or the Workspace Key could not be derived. Please unlock your Vault in the top right to access encrypted files.</p>
          </div>
        </Card>
      )}

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
          {filesLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground animate-pulse">
              Loading workspace files...
            </div>
          ) : (
            <FileList 
              files={files} 
              type="my-files" 
              workspaceContext={activeWorkspace?.name}
              viewMode="grid"
              onDownload={handleDownload}
            />
          )}
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
                 {members.map((member, index) => (
                   <tr key={member.wallet_address || index} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-full ${member.wallet_address === user?.address ? 'bg-primary/20 text-primary' : 'bg-accent text-accent-foreground'} flex items-center justify-center`}>
                             <span className="font-bold">{member.wallet_address?.substring(2, 4).toUpperCase() || '?'}</span>
                           </div>
                           <div>
                              <p className="font-medium text-foreground">{member.wallet_address === user?.address ? 'You' : member.wallet_address}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                           {member.role?.replace('WORKSPACE_', '') || 'MEMBER'}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                         {new Date(member.joined_at * 1000).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                         {member.wallet_address === user?.address ? (
                           <span className="text-muted-foreground text-xs italic">Current User</span>
                         ) : (
                           <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 h-8" disabled={!canInvite}>
                             <X className="w-3.5 h-3.5" />
                             Remove
                           </Button>
                         )}
                      </td>
                   </tr>
                 ))}
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
