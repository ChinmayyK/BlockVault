import React, { useState } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Plus, 
  Settings, 
  User, 
  Check 
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

// Dummy interfaces for now to power the UI. 
// A real implementation would wire this up to a WorkspaceContext.
export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team';
}

const DUMMY_WORKSPACES: Workspace[] = [
  { id: 'personal', name: 'Personal Vault', type: 'personal' },
  { id: 'org-1', name: 'Acme Legal', type: 'team' },
  { id: 'org-2', name: 'Research Team', type: 'team' },
];

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(DUMMY_WORKSPACES[0]);

  const personalWorkspaces = DUMMY_WORKSPACES.filter(w => w.type === 'personal');
  const teamWorkspaces = DUMMY_WORKSPACES.filter(w => w.type === 'team');

  const switchWorkspace = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
    if (workspace.type === 'personal') {
      navigate('/files');
    } else {
      navigate(`/workspaces/${workspace.id}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card/50 hover:bg-accent hover:text-accent-foreground transition-colors outline-none focus:ring-2 focus:ring-primary/20">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary">
            {activeWorkspace.type === 'personal' ? (
              <User className="w-3.5 h-3.5" />
            ) : (
              <Building2 className="w-3.5 h-3.5" />
            )}
          </div>
          <span className="text-sm font-medium truncate max-w-[140px]">
            {activeWorkspace.name}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground opacity-70" />
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-64" align="start" alignOffset={-4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider font-semibold">
            Personal
          </DropdownMenuLabel>
          {personalWorkspaces.map(workspace => (
            <DropdownMenuItem 
              key={workspace.id}
              onClick={() => switchWorkspace(workspace)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{workspace.name}</span>
              </div>
              {activeWorkspace.id === workspace.id && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider font-semibold flex items-center justify-between">
            Organizations
            <button 
              onClick={(e) => {
                e.preventDefault();
                navigate('/orgs');
              }}
              className="px-1 py-0.5 rounded hover:bg-accent text-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuLabel>
          {teamWorkspaces.map(workspace => (
            <DropdownMenuItem 
              key={workspace.id}
              onClick={() => switchWorkspace(workspace)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30">
                  <span className="text-[9px] font-bold text-indigo-400">
                    {workspace.name.charAt(0)}
                  </span>
                </div>
                <span>{workspace.name}</span>
              </div>
              {activeWorkspace.id === workspace.id && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => navigate('/settings')}
          className="text-muted-foreground cursor-pointer"
        >
          <Settings className="w-4 h-4 mr-2" />
          Workspace Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
