import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { useVault } from './VaultContext';
import { wrapWorkspaceKeyWithWorker, unwrapWorkspaceKeyWithWorker } from '../utils/cryptoWorker';
import { getApiBase } from '../lib/getApiBase';

export interface Workspace {
  workspace_id: string;
  name: string;
  org_id?: string;
  role: string | number;
  created_at: number;
  encrypted_workspace_key?: string; // from get_user_workspaces (in member object)
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceKey: string | null;
  isLoading: boolean;
  fetchWorkspaces: () => Promise<void>;
  setActiveWorkspace: (workspaceId: string | null) => Promise<void>;
  createWorkspace: (name: string, orgId?: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

interface WorkspaceProviderProps {
  children: ReactNode;
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { isVaultUnlocked, vaultKey } = useVault();
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [activeWorkspaceKey, setActiveWorkspaceKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    if (!user?.jwt) return;
    try {
      setIsLoading(true);
      const res = await fetch(`${getApiBase()}/workspaces`, {
        headers: { 'Authorization': `Bearer ${user.jwt}` }
      });
      if (!res.ok) throw new Error('Failed to fetch workspaces');
      const data = await res.json();
      setWorkspaces(data.workspaces || []);
      
      // If the active workspace was deleted or user removed, clear it
      if (activeWorkspace) {
        const stillExists = data.workspaces?.find((w: any) => w.workspace_id === activeWorkspace.workspace_id);
        if (!stillExists) {
          setActiveWorkspaceState(null);
          setActiveWorkspaceKey(null);
        } else {
          // Update details (like role changes) but keep key if unlocked
          setActiveWorkspaceState(stillExists);
        }
      }
    } catch (err) {
      console.error('Error fetching workspaces:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.jwt, activeWorkspace]);

  // Initial fetch on mount or auth change
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Handle active workspace selection and key unwrapping
  const setActiveWorkspace = async (workspaceId: string | null) => {
    if (!workspaceId) {
      setActiveWorkspaceState(null);
      setActiveWorkspaceKey(null);
      return;
    }

    const ws = workspaces.find(w => w.workspace_id === workspaceId);
    if (!ws) {
      toast.error('Workspace not found');
      return;
    }

    if (!isVaultUnlocked || !vaultKey) {
      // Set visually active but without a key (user will be prompted to unlock vault)
      setActiveWorkspaceState(ws);
      setActiveWorkspaceKey(null);
      toast('Please unlock your vault to access this workspace', { icon: '🔐' });
      return;
    }

    if (!ws.encrypted_workspace_key) {
      console.error('Workspace object missing encrypted_workspace_key:', ws);
      toast.error('Workspace key missing or corrupt');
      return;
    }

    try {
      setIsLoading(true);
      const { workspaceKey } = await unwrapWorkspaceKeyWithWorker(ws.encrypted_workspace_key, vaultKey);
      setActiveWorkspaceKey(workspaceKey);
      setActiveWorkspaceState(ws);
    } catch (err: any) {
      console.error('Failed to unwrap workspace key:', err);
      toast.error('Failed to access workspace (key derivation error)');
    } finally {
      setIsLoading(false);
    }
  };

  // If vault is suddenly unlocked, try to unwrap the active workspace's key
  useEffect(() => {
    if (activeWorkspace && isVaultUnlocked && vaultKey && !activeWorkspaceKey && activeWorkspace.encrypted_workspace_key) {
      unwrapWorkspaceKeyWithWorker(activeWorkspace.encrypted_workspace_key, vaultKey)
        .then(({ workspaceKey }) => setActiveWorkspaceKey(workspaceKey))
        .catch(err => console.error('Auto-unwrap of workspace key failed:', err));
    } else if (!isVaultUnlocked) {
      // Clear key if vault locks
      setActiveWorkspaceKey(null);
    }
  }, [activeWorkspace, isVaultUnlocked, vaultKey, activeWorkspaceKey]);

  const createWorkspace = async (name: string, orgId?: string) => {
    if (!user?.jwt) {
      toast.error('Must be logged in to create a workspace');
      return;
    }
    if (!isVaultUnlocked || !vaultKey) {
      toast.error('Please unlock your vault to create a workspace');
      return;
    }

    try {
      setIsLoading(true);
      
      // 1. Generate & Wrap a new Workspace Key using the Vault Key
      const result = await wrapWorkspaceKeyWithWorker(vaultKey);
      
      // 2. Submit to backend
      const res = await fetch(`${getApiBase()}/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.jwt}`
        },
        body: JSON.stringify({
          name,
          org_id: orgId || null,
          encrypted_workspace_key: result.wrappedWorkspaceKey
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create workspace');
      }

      const created = await res.json();
      await fetchWorkspaces();
      toast.success('Workspace created successfully!');
      
      // Auto-set as active using the returned ID
      setActiveWorkspace(created.workspace_id);
      
    } catch (err: any) {
      console.error('Create workspace error:', err);
      toast.error(err.message || 'Failed to create workspace');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const value: WorkspaceContextType = {
    workspaces,
    activeWorkspace,
    activeWorkspaceKey,
    isLoading,
    fetchWorkspaces,
    setActiveWorkspace,
    createWorkspace
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};
