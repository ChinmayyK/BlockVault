import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { getApiBase } from '@/lib/getApiBase';
import { isUserRejection } from '@/utils/walletErrors';
import { env } from '@/config/env';
import { AUTH_STORAGE_KEY, readStoredUser, writeStoredUser, clearStoredUser } from '@/utils/authStorage';
import { rsaKeyManager } from '@/lib/crypto/rsa';
import type { OrgMembership, WorkspaceMembership } from '@/types/roles';

interface User {
  address: string;
  jwt?: string;
  refreshToken?: string;
  user_id?: string;
  wallets?: string[];
  requires_wallet_link?: boolean;
  role?: string;  // Legacy field for backward compat
  platform_role?: string;
  organizations?: OrgMembership[];
  workspaces?: WorkspaceMembership[];
  wrapped_vault_key?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  login: (provider?: any) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, wallet?: string) => Promise<void>;
  logout: () => void;
  isConnected: boolean;
  isAuthenticated: boolean;
  isMobile: boolean;
  setUser: (user: User | null) => void;
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const API_BASE = getApiBase();

if (env.isProduction) {
  if (!API_BASE) {
    console.warn(
      '[AuthContext] VITE_API_URL is not set for production build. Requests will fall back to relative URLs.'
    );
  } else if (/localhost|127\.0\.0\.1/i.test(API_BASE)) {
    console.warn(
      `[AuthContext] Production build is pointing to a localhost API base (${API_BASE}).`
    );
  }

  if (!import.meta.env.VITE_AUTH_STORAGE_KEY) {
    console.warn(
      '[AuthContext] Using default localStorage key in production. Set VITE_AUTH_STORAGE_KEY to rotate storage namespace.'
    );
  }
}

const buildApiUrl = (path: string) => `${API_BASE}${path}`;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start with true to prevent redirect during restoration
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const isConnected = !!user?.address;
  const isAuthenticated = !!(user?.address && user?.jwt);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    };
    setIsMobile(checkMobile());
  }, []);

  // Listen for wallet account changes and disconnections
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected wallet
        console.log('Wallet disconnected');
        logout();
      } else if (accounts[0] !== user?.address) {
        // User switched accounts
        console.log('Account changed:', accounts[0]);
        const newUser = { address: accounts[0] };
        setUser(newUser);
        writeStoredUser(newUser);
        toast.success('Wallet account changed');
      }
    };

    const handleChainChanged = () => {
      // Reload page when chain changes
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [user]);

  // Check for existing session on mount and validate token
  useEffect(() => {
    const restoreSession = async () => {
      const parsedUser = readStoredUser<User>();
      if (parsedUser) {
        // Always restore the wallet address (keep user connected)
        setUser(parsedUser);

        // Optionally validate JWT token if it exists
        // But don't log out if validation fails - just invalidate the JWT
        // Skip validation for demo users (synthetic token)
        if (parsedUser.jwt && parsedUser.address !== 'demo_user') {
          validateToken(parsedUser, parsedUser.jwt);
        }
      }
      // Set loading to false after restoration attempt completes
      setLoading(false);
    };

    restoreSession();
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser((currentUser) => {
        if (currentUser?.address) {
          const minimalUser = { address: currentUser.address };
          writeStoredUser(minimalUser);
          return minimalUser;
        }

        clearStoredUser();
        return null;
      });
    };

    window.addEventListener('blockvault:session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('blockvault:session-expired', handleSessionExpired);
    };
  }, []);

  // Validate JWT token by making a test request
  // If token is invalid, keep the wallet connected but remove JWT
  const validateToken = async (currentUser: User, token: string) => {
    try {
      const response = await fetch(buildApiUrl(`/users/profile`), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.log('Token validation failed, preserving current session state for now.');
        return;
      } else {
        // Token is still valid - user is fully authenticated
        const userData = await response.json();
        console.log('Token is valid, user fully authenticated. Role:', userData.role);

        // Update the role and vault state in storage if it changed
        if (userData.role || userData.wrapped_vault_key !== undefined) {
          const role = userData.role ? userData.role.toUpperCase() : undefined;
          setUser(prev => {
            if (!prev) return null;
            const updated = { ...prev };
            if (role) updated.role = role;
            if (userData.wrapped_vault_key !== undefined) updated.wrapped_vault_key = userData.wrapped_vault_key;
            writeStoredUser(updated);
            return updated;
          });
        }

        // Automatically register RSA public key if keys exist but aren't registered
        // Do this asynchronously so it doesn't block the session restoration
        autoRegisterRSAKey(token).catch(err => {
          console.warn('Background RSA key registration failed during session restore:', err);
        });
      }
    } catch (error) {
      // Network error or backend down - optimistically keep user connected
      console.log('Token validation error (backend might be offline), keeping user connected:', error);
      // Don't clear user data on network errors - assume token is still valid
    }
  };

  // Automatically generate and register RSA keys if they don't exist
  const autoGenerateAndRegisterRSAKeys = async (token: string) => {
    try {
      // Check if RSA keys already exist
      if (rsaKeyManager.hasKeyPair()) {
        console.log('RSA keys already exist, checking registration status...');
        // Keys exist, just ensure they're registered
        await autoRegisterRSAKey(token);
        return;
      }

      // Check if user already has a registered public key on the server
      const profileResponse = await fetch(buildApiUrl(`/users/profile`), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        if (profileData.has_public_key) {
          console.log('User has a registered public key on server but no local keys.');
          console.log('User may need to import their keys or regenerate.');
          return; // Don't auto-generate if they have keys on server (could be from another device)
        }
      }

      // Generate new RSA keys
      console.log('Auto-generating RSA keys for first-time user...');
      const keyPair = rsaKeyManager.generateKeyPair();

      // Register the public key with the backend
      const registerResponse = await fetch(buildApiUrl(`/users/public_key`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_key_pem: keyPair.publicKey,
        }),
      });

      if (registerResponse.ok) {
        console.log('RSA keys auto-generated and registered successfully');
        toast.success('🔐 RSA keys set up automatically for secure sharing', {
          duration: 4000,
          icon: '🔐',
        });
      } else {
        const errorText = await registerResponse.text();
        console.warn('RSA keys generated but registration failed:', errorText);
        toast('RSA keys generated locally. Please register them in Settings.', {
          icon: '⚠️',
          duration: 5000,
        });
      }
    } catch (error) {
      console.warn('Error during RSA key auto-generation:', error);
      // Silently fail - user can generate manually in Settings
    }
  };

  // Automatically register RSA public key if keys exist but aren't registered
  const autoRegisterRSAKey = async (token: string) => {
    try {
      // Check if RSA keys exist
      if (!rsaKeyManager.hasKeyPair()) {
        return; // No keys to register
      }

      const publicKey = rsaKeyManager.getPublicKey();
      if (!publicKey) {
        return; // No public key available
      }

      // Check if public key is already registered
      const profileResponse = await fetch(buildApiUrl(`/users/profile`), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        if (profileData.has_public_key) {
          console.log('RSA public key already registered');
          return; // Already registered
        }
      }

      // Register the public key
      console.log('Auto-registering RSA public key...');
      const registerResponse = await fetch(buildApiUrl(`/users/public_key`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_key_pem: publicKey,
        }),
      });

      if (registerResponse.ok) {
        console.log('RSA public key auto-registered successfully');
        // Don't show toast to avoid interrupting the login flow
      } else {
        const errorText = await registerResponse.text();
        console.warn('Failed to auto-register RSA public key:', errorText);
        // Silently fail - user can register manually later
      }
    } catch (error) {
      console.warn('Error during RSA key auto-registration:', error);
      // Silently fail - user can register manually later
    }
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      const provider = new ethers.BrowserProvider(window.ethereum!);
      const accounts = await provider.send('eth_requestAccounts', []);

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      const newUser = { address };
      setUser(newUser);

      // Save to localStorage
      writeStoredUser(newUser);

      toast.success('Wallet connected successfully');
    } catch (err: any) {
      if (isUserRejection(err)) {
        toast.error('Connection cancelled');
        return;
      }
      const errorMessage = err.message || 'Failed to connect wallet';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const login = async (provider?: any) => {
    if (!user?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get nonce from backend
      const nonceResponse = await fetch(buildApiUrl(`/auth/get_nonce`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: user.address }),
      });

      if (!nonceResponse.ok) {
        throw new Error('Failed to get nonce');
      }

      const { nonce } = await nonceResponse.json();

      // Sign message with wallet
      let signature: string;
      console.log('Login function called with:', { provider, isMobile, hasProvider: !!provider });

      if (provider && isMobile) {
        // Handle mobile wallet providers (only on mobile devices)
        const message = `BlockVault login nonce: ${nonce}`;
        console.log('Mobile wallet login attempt:', { provider, message, address: user.address });

        try {
          // Method 1: Try personal_sign with message first
          console.log('Trying personal_sign method...');
          signature = await provider.request({
            method: 'personal_sign',
            params: [message, user.address],
          });
          console.log('personal_sign successful:', signature);
        } catch (error) {
          console.log('personal_sign failed, trying eth_sign...', error);

          try {
            // Method 2: Try eth_sign
            console.log('Trying eth_sign method...');
            signature = await provider.request({
              method: 'eth_sign',
              params: [user.address, ethers.keccak256(ethers.toUtf8Bytes(message))],
            });
            console.log('eth_sign successful:', signature);
          } catch (error2) {
            console.log('eth_sign failed, trying ethers provider...', error2);

            try {
              // Method 3: Try ethers provider
              console.log('Trying ethers provider method...');
              const ethersProvider = new ethers.BrowserProvider(provider);
              const signer = await ethersProvider.getSigner();
              signature = await signer.signMessage(message);
              console.log('ethers provider successful:', signature);
            } catch (error3) {
              console.log('ethers provider failed, trying direct signing...', error3);

              try {
                // Method 4: Try direct signing with different message format
                console.log('Trying direct signing with hash...');
                signature = await provider.request({
                  method: 'personal_sign',
                  params: [ethers.keccak256(ethers.toUtf8Bytes(message)), user.address],
                });
                console.log('direct signing successful:', signature);
              } catch (error4) {
                console.error('All signing methods failed:', { error, error2, error3, error4 });
                throw new Error(`Failed to sign message with mobile wallet. Please try again or use desktop MetaMask.`);
              }
            }
          }
        }
      } else {
        // Handle desktop MetaMask
        const ethersProvider = new ethers.BrowserProvider(window.ethereum!);
        const signer = await ethersProvider.getSigner();
        signature = await signer.signMessage(`BlockVault login nonce: ${nonce}`);
      }

      // Send signature to backend for verification
      const loginResponse = await fetch(buildApiUrl(`/auth/login`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: user.address,
          signature,
        }),
      });

      if (!loginResponse.ok) {
        throw new Error('Login failed');
      }

      const loginData = await loginResponse.json();
      const { token, refresh_token, rsa_private_key, rsa_public_key, message, platform_role, role, organizations, workspaces, wrapped_vault_key } = loginData;

      // Update user with JWT and full role context
      const updatedUser = {
        ...user,
        jwt: token,
        refreshToken: refresh_token,
        role: platform_role || role || 'USER',
        platform_role: platform_role || role || 'USER',
        organizations: organizations || [],
        workspaces: workspaces || [],
        wrapped_vault_key: wrapped_vault_key || undefined,
      };
      setUser(updatedUser);

      // Save to localStorage
      writeStoredUser(updatedUser);

      // If backend auto-generated RSA keys, store them
      if (rsa_private_key && rsa_public_key) {
        try {
          // Store keys in localStorage
          localStorage.setItem('blockvault_rsa_keys', JSON.stringify({
            privateKey: rsa_private_key,
            publicKey: rsa_public_key
          }));

          toast.success(message || 'Login successful! RSA keys auto-generated and saved.', {
            duration: 3000,
          });

          // No reload needed - everything is already saved to localStorage
        } catch (err) {
          console.error('Failed to store auto-generated RSA keys:', err);
          toast.success('Login successful');
        }
      } else {
        toast.success('Login successful');

        // Automatically generate and register RSA keys if they don't exist
        // Do this asynchronously so it doesn't block the login flow
        autoGenerateAndRegisterRSAKeys(token).catch(err => {
          console.warn('Background RSA key setup failed:', err);
        });
      }
    } catch (err: any) {
      if (isUserRejection(err)) {
        toast.error('Login cancelled');
        return;
      }
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loginWithPassword = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const loginResponse = await fetch(buildApiUrl(`/auth/login/password`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(errorData.error || 'Login failed');
      }

      const { token, user_id, address, wallets, requires_wallet_link, role, platform_role, organizations, workspaces } = await loginResponse.json();

      // Update user with JWT and full role context
      const updatedUser: User = {
        address: address || '',
        jwt: token,
        user_id,
        wallets,
        requires_wallet_link,
        role: platform_role || role || 'USER',
        platform_role: platform_role || role || 'USER',
        organizations: organizations || [],
        workspaces: workspaces || [],
      };
      setUser(updatedUser);

      // Save to localStorage
      writeStoredUser(updatedUser);

      toast.success('Login successful');

      // Automatically generate and register RSA keys if they don't exist
      autoGenerateAndRegisterRSAKeys(token).catch(err => {
        console.warn('Background RSA key setup failed:', err);
      });

      if (requires_wallet_link) {
        toast('Please link a wallet to access all features', { icon: 'ℹ️' });
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, wallet?: string) => {
    try {
      setLoading(true);
      setError(null);

      const signupResponse = await fetch(buildApiUrl(`/auth/signup`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, wallet }),
      });

      if (!signupResponse.ok) {
        const errorData = await signupResponse.json().catch(() => ({ error: 'Signup failed' }));
        throw new Error(errorData.error || 'Signup failed');
      }

      const data = await signupResponse.json();

      // If wallet was provided, user is immediately authenticated
      if (data.token && data.address) {
        const newUser: User = {
          address: data.address,
          jwt: data.token,
          user_id: data.user_id,
        };
        setUser(newUser);
        writeStoredUser(newUser);
        toast.success('Account created and logged in');
      } else {
        // Email/password only - user needs to login
        toast.success('Account created! Please login.');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Signup failed';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    // Revoke refresh tokens server-side
    if (user?.jwt && user?.refreshToken) {
      try {
        await fetch(buildApiUrl('/auth/revoke'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: user.refreshToken }),
        });
      } catch {
        // Best-effort revocation
      }
    }
    if (user?.address) {
      const minimalUser = { address: user.address };
      setUser(minimalUser);
      writeStoredUser(minimalUser);
    } else {
      setUser(null);
      clearStoredUser();
    }
    toast.success('Session cleared, wallet remains connected');
  };

  // Attempt to refresh the access token using the stored refresh token
  const refreshAccessToken = async (): Promise<string | null> => {
    const currentRefresh = user?.refreshToken;
    if (!currentRefresh) return null;

    try {
      const res = await fetch(buildApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: currentRefresh }),
      });

      if (!res.ok) return null;

      const { token, refresh_token } = await res.json();
      setUser(prev => {
        if (!prev) return null;
        const updated = { ...prev, jwt: token, refreshToken: refresh_token };
        writeStoredUser(updated);
        return updated;
      });
      return token;
    } catch {
      return null;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    connectWallet,
    login,
    loginWithPassword,
    signup,
    logout,
    isConnected,
    isAuthenticated,
    isMobile,
    setUser,
    refreshAccessToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

