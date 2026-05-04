import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { wrapVaultKeyWithWorker, unwrapVaultKeyWithWorker } from '../utils/cryptoWorker';
import { getApiBase } from '../lib/getApiBase';

interface VaultContextType {
  isVaultUnlocked: boolean;
  vaultKey: string | null;
  hasVaultInitialized: boolean;
  unlockVault: (passphrase: string) => Promise<void>;
  initVault: (passphrase: string) => Promise<void>;
  lockVault: () => void;
  isVaultOperating: boolean;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const useVault = () => {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};

interface VaultProviderProps {
  children: ReactNode;
}

export const VaultProvider: React.FC<VaultProviderProps> = ({ children }) => {
  const { user, setUser } = useAuth();
  const [vaultKey, setVaultKey] = useState<string | null>(null);
  const [isVaultOperating, setIsVaultOperating] = useState(false);

  // If the user has a wrapped_vault_key in their profile, their vault is initialized
  const hasVaultInitialized = !!user?.wrapped_vault_key;
  const isVaultUnlocked = !!vaultKey;

  // Auto-lock vault on logout or wallet switch
  useEffect(() => {
    if (!user?.address) {
      setVaultKey(null);
    }
  }, [user?.address]);

  const unlockVault = async (passphrase: string) => {
    if (!user?.wrapped_vault_key) {
      toast.error('Vault not initialized');
      return;
    }
    
    try {
      setIsVaultOperating(true);
      
      // Unwrap the vault key using the Web Worker to avoid freezing the UI
      const result = await unwrapVaultKeyWithWorker(user.wrapped_vault_key, passphrase);
      
      if (result && result.vaultKey) {
        setVaultKey(result.vaultKey);
        toast.success('Vault unlocked successfully');
      } else {
        throw new Error('Failed to unwrap vault key');
      }
    } catch (err: any) {
      console.error('Failed to unlock vault:', err);
      toast.error(err.message || 'Invalid passphrase. Vault unlock failed.');
      throw err;
    } finally {
      setIsVaultOperating(false);
    }
  };

  const initVault = async (passphrase: string) => {
    if (!user?.jwt) {
      toast.error('Must be logged in to initialize vault');
      return;
    }

    try {
      setIsVaultOperating(true);
      
      // Generate and wrap a new Vault Key using the Web Worker
      const result = await wrapVaultKeyWithWorker(passphrase);
      
      if (!result || !result.vaultKey || !result.wrappedVaultKey) {
        throw new Error('Failed to generate vault key');
      }

      // Persist the wrapped vault key to the backend
      const response = await fetch(`${getApiBase()}/users/vault`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.jwt}`
        },
        body: JSON.stringify({ wrapped_vault_key: result.wrappedVaultKey })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save vault key to database');
      }

      // Update the user context so `hasVaultInitialized` becomes true immediately
      setUser({
        ...user,
        wrapped_vault_key: result.wrappedVaultKey
      });

      // Unlock the vault locally
      setVaultKey(result.vaultKey);
      toast.success('Vault initialized and unlocked!');
    } catch (err: any) {
      console.error('Failed to initialize vault:', err);
      toast.error(err.message || 'Vault initialization failed');
      throw err;
    } finally {
      setIsVaultOperating(false);
    }
  };

  const lockVault = () => {
    setVaultKey(null);
    toast.success('Vault locked safely');
  };

  const value: VaultContextType = {
    isVaultUnlocked,
    vaultKey,
    hasVaultInitialized,
    unlockVault,
    initVault,
    lockVault,
    isVaultOperating
  };

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
};
