import React, { createContext, useContext, useCallback, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getApiBase } from '@/lib/getApiBase';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import apiClient from '@/api/client';
import { readStoredUser, clearStoredUser } from '@/utils/authStorage';

interface File {
  id: string;
  file_id?: string;
  name?: string;
  file_name?: string;
  size?: number;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  updated_at?: string;
  folder?: string;
  is_shared?: boolean;
}

interface Share {
  id: string;
  file_id: string;
  file_name: string;
  shared_with: string;
  created_at: string;
  expires_at?: string;
}

const getCanonicalId = (item: any) => String(item?.file_id || item?.id || item?._id || '');

const getCreatedAtValue = (item: any) => Number(item?.created_at || 0);

const dedupeFiles = (items: any[]): File[] => {
  const byKey = new Map<string, any>();

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const fileId = getCanonicalId(item);
    if (!fileId) {
      continue;
    }

    const semanticDuplicateKey = item?.redacted_from
      ? `redacted-source:${String(item.redacted_from)}`
      : `id:${fileId}`;

    const existing = byKey.get(semanticDuplicateKey);
    if (!existing || getCreatedAtValue(item) > getCreatedAtValue(existing)) {
      byKey.set(semanticDuplicateKey, item);
    }
  }

  return Array.from(byKey.values()) as File[];
};

const dedupeShares = <T extends Record<string, any>>(items: T[], keyResolver: (item: T) => string): T[] => {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const key = keyResolver(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }

  return output;
};

interface FileContextType {
  files: File[];
  sharedFiles: File[];
  outgoingShares: Share[];
  hasMoreFiles: boolean;
  loadMoreFiles: () => Promise<void>;
  loadingMoreFiles: boolean;
  hasMoreSharedFiles: boolean;
  loadMoreSharedFiles: () => Promise<void>;
  loadingMoreSharedFiles: boolean;
  hasMoreOutgoingShares: boolean;
  loadMoreOutgoingShares: () => Promise<void>;
  loadingMoreOutgoingShares: boolean;
  loading: boolean;
  error: string | null;
  uploadFile: (file: any, passphrase: string, aad?: string, folder?: string) => Promise<void>;
  downloadFile: (fileId: string, passphrase: string, isSharedFile?: boolean, encryptedKey?: string, fileName?: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  shareFile: (fileId: string, recipientAddress: string, passphrase: string, isEmail?: boolean) => Promise<void>;
  revokeShare: (shareId: string) => Promise<void>;
  refreshFiles: () => Promise<void>;
  refreshSharedFiles: () => Promise<void>;
  refreshOutgoingShares: () => Promise<void>;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export const useFiles = () => {
  const context = useContext(FileContext);
  if (context === undefined) {
    throw new Error('useFiles must be used within a FileProvider');
  }
  return context;
};

interface FileProviderProps {
  children: ReactNode;
}

export const FileProvider: React.FC<FileProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();

  const getStoredUser = () => readStoredUser<{ jwt?: string; address?: string }>();

  const initialUser = getStoredUser();
  const initialIsAuthenticated = !!initialUser?.jwt;
  const initialAuthScope = initialIsAuthenticated
    ? `${initialUser?.address || 'unknown'}:${initialUser?.jwt}`
    : 'guest';

  // Only consider the session authenticated once a JWT is present.
  const [isAuthenticated, setIsAuthenticated] = useState(initialIsAuthenticated);
  const [authScope, setAuthScope] = useState(initialAuthScope);

  const userRef = useRef<{ jwt?: string; address?: string } | null>(initialUser);

  // Initialize user ref on mount and listen for auth changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const updateAuth = () => {
      const storedUser = readStoredUser<{ jwt?: string; address?: string }>();
      const authenticated = !!storedUser?.jwt;
      setIsAuthenticated(authenticated);
      setAuthScope(
        authenticated
          ? `${storedUser?.address || 'unknown'}:${storedUser?.jwt}`
          : 'guest'
      );
      userRef.current = storedUser;
    };

    updateAuth();

    // Listen for auth changes
    const handleStorageChange = () => updateAuth();
    const handleAuthChange = () => updateAuth();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('blockvault:auth-changed', handleAuthChange);
    window.addEventListener('blockvault:session-expired', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('blockvault:auth-changed', handleAuthChange);
      window.removeEventListener('blockvault:session-expired', handleAuthChange);
    };
  }, []);

  const getAuthHeaders = useCallback(() => {
    if (!userRef.current?.jwt) {
      throw new Error('No authentication token found. Please login again.');
    }
    return {
      'Authorization': `Bearer ${userRef.current.jwt}`,
    };
  }, []);

  const getAuthHeadersWithContentType = useCallback(() => {
    const headers = getAuthHeaders();
    return {
      ...headers,
      'Content-Type': 'application/json',
    };
  }, [getAuthHeaders]);

  // React Query hooks for fetching data
  const {
    data: filesPages,
    isLoading: filesLoading,
    error: filesError,
    refetch: refetchFiles,
    fetchNextPage: fetchNextFilesPage,
    hasNextPage: hasMoreFiles,
    isFetchingNextPage: isFetchingMoreFiles,
  } = useInfiniteQuery({
    queryKey: ['files', 'infinite', authScope],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) {
        params.append('after', String(pageParam));
      }
      try {
        const response = await apiClient.get(`/files/?${params.toString()}`, {
          skipGlobalLoader: true
        } as any);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          return { items: [], next_after: null, has_more: false };
        }
        throw new Error('Failed to fetch files');
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage?.has_more ? lastPage?.next_after : undefined,
    enabled: isAuthenticated,
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: sharedFilesPages,
    isLoading: sharedFilesLoading,
    error: sharedFilesError,
    refetch: refetchSharedFiles,
    fetchNextPage: fetchNextSharedFiles,
    hasNextPage: hasMoreSharedFiles,
    isFetchingNextPage: isFetchingMoreSharedFiles,
  } = useInfiniteQuery({
    queryKey: ['sharedFiles', authScope],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) {
        params.append('after', String(pageParam));
      }
      try {
        const response = await apiClient.get(`/files/shared?${params.toString()}`, {
          skipGlobalLoader: true
        } as any);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          return { shares: [], next_after: null, has_more: false };
        }
        throw new Error('Failed to fetch shared files');
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage?.has_more ? lastPage?.next_after : undefined,
    enabled: isAuthenticated,
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: outgoingSharesPages,
    isLoading: outgoingSharesLoading,
    error: outgoingSharesError,
    refetch: refetchOutgoingShares,
    fetchNextPage: fetchNextOutgoingShares,
    hasNextPage: hasMoreOutgoingShares,
    isFetchingNextPage: isFetchingMoreOutgoingShares,
  } = useInfiniteQuery({
    queryKey: ['outgoingShares', authScope],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) {
        params.append('after', String(pageParam));
      }
      try {
        const response = await apiClient.get(`/files/shares/outgoing?${params.toString()}`, {
          skipGlobalLoader: true
        } as any);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          return { shares: [], next_after: null, has_more: false };
        }
        throw new Error('Failed to fetch outgoing shares');
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage?.has_more ? lastPage?.next_after : undefined,
    enabled: isAuthenticated,
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const files = useMemo(
    () =>
      dedupeFiles(
        (filesPages?.pages || [])
          .flatMap((page: any) => page?.items || [])
          .filter((item: any) => item && typeof item === 'object')
      ),
    [filesPages],
  );
  const sharedFiles = useMemo(
    () =>
      dedupeShares(
        (sharedFilesPages?.pages || [])
          .flatMap((page: any) => page?.shares || [])
          .filter((share: any) => share && typeof share === 'object'),
        (share: any) => String(share?.share_id || share?.id || share?.file_id || ''),
      ),
    [sharedFilesPages],
  );
  const outgoingShares = useMemo(
    () =>
      dedupeShares(
        (outgoingSharesPages?.pages || [])
          .flatMap((page: any) => page?.shares || [])
          .filter((share: any) => share && typeof share === 'object'),
        (share: any) => String(share?.share_id || share?.id || ''),
      ),
    [outgoingSharesPages],
  );
  const loading = filesLoading || sharedFilesLoading || outgoingSharesLoading;
  const error = filesError || sharedFilesError || outgoingSharesError
    ? (filesError || sharedFilesError || outgoingSharesError)?.message || 'An error occurred'
    : null;
  const loadMoreSharedFiles = useCallback(async () => {
    if (!hasMoreSharedFiles) {
      return;
    }
    await fetchNextSharedFiles();
  }, [hasMoreSharedFiles, fetchNextSharedFiles]);

  const loadMoreOutgoingShares = useCallback(async () => {
    if (!hasMoreOutgoingShares) {
      return;
    }
    await fetchNextOutgoingShares();
  }, [hasMoreOutgoingShares, fetchNextOutgoingShares]);

  const loadMoreFiles = useCallback(async () => {
    if (!hasMoreFiles) {
      return;
    }
    await fetchNextFilesPage();
  }, [hasMoreFiles, fetchNextFilesPage]);

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, passphrase, aad, folder }: { file: any; passphrase: string; aad?: string; folder?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', passphrase);
      if (aad) formData.append('aad', aad);
      if (folder) formData.append('folder', folder);

      try {
        const response = await apiClient.post(`/files/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000,
          loadingMessage: 'Encrypting and Uploading File...',
        } as any);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          clearStoredUser();
          throw new Error('Session expired. Please login again.');
        }
        let errorMessage = `Upload failed with status ${error.response?.status || 'unknown'}`;
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.response?.data) {
          errorMessage = JSON.stringify(error.response.data);
        }
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      toast.success('File uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['files', 'infinite'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Upload failed');
    },
  });

  const uploadFile = useCallback(async (file: any, passphrase: string, aad?: string, folder?: string) => {
    await uploadFileMutation.mutateAsync({ file, passphrase, aad, folder });
  }, [uploadFileMutation]);

  const downloadFile = useCallback(async (fileId: string, passphrase: string, isSharedFile: boolean = false, encryptedKey?: string, fileName?: string) => {
    try {
      console.log('📥 downloadFile called', {
        fileId,
        isSharedFile,
        hasEncryptedKey: !!encryptedKey,
        hasFileName: !!fileName,
      });

      let actualPassphrase = passphrase;

      // For shared files, decrypt the encrypted key to get the original passphrase
      if (isSharedFile && encryptedKey) {
        try {
          const { rsaKeyManager } = await import('@/lib/crypto/rsa');
          const privateKey = rsaKeyManager.getPrivateKey();
          if (!privateKey) {
            toast.error('RSA private key not found. Please log out and log back in to regenerate keys.');
            throw new Error('RSA private key not found. Please generate RSA keys first.');
          }

          // Decrypt the encrypted key using RSA private key
          const forge = (await import('node-forge')).default;
          const privateKeyObj = forge.pki.privateKeyFromPem(privateKey);
          const encryptedBytes = forge.util.decode64(encryptedKey);

          actualPassphrase = privateKeyObj.decrypt(encryptedBytes, 'RSA-OAEP', {
            md: forge.md.sha256.create(),
            mgf1: forge.mgf.mgf1.create(forge.md.sha256.create())
          });
        } catch (decryptError) {
          console.error('RSA decryption failed:', decryptError);
          toast.error('Failed to decrypt file key. The file may have been shared with a different RSA key.');
          throw new Error('Failed to decrypt shared file key. Please ensure you have the correct RSA keys.');
        }
      }

      const response = await apiClient.get(`/files/${fileId}?key=${encodeURIComponent(actualPassphrase)}`, {
        responseType: 'blob',
        loadingMessage: 'Decrypting & Downloading...',
      } as any);
      const blob = response.data;
      console.log('✅ Blob created', { size: blob.size, type: blob.type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (fileName && typeof fileName === 'string' && fileName.trim() !== '')
        ? fileName
        : `file_${fileId}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('File downloaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
      throw err;
    }
  }, [getAuthHeadersWithContentType]);

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      try {
        await apiClient.delete(`/files/${fileId}`, {
          loadingMessage: 'Deleting file...',
        } as any);
      } catch (error: any) {
        if (error.response?.status === 401) {
          clearStoredUser();
          throw new Error('Session expired. Please login again.');
        }
        if (error.response?.status === 404) {
          return;
        }
        throw new Error('Delete failed');
      }
    },
    onSuccess: (_data, fileId) => {
      // Optimistically remove the file from the local infinite query cache
      queryClient.setQueriesData<any>({ queryKey: ['files', 'infinite'] }, (prev) => {
        if (!prev || !prev.pages) return prev;
        const nextPages = prev.pages.map((page: any) => {
          if (!page?.items) return page;
          return {
            ...page,
            items: page.items.filter((item: any) => {
              const id = item?.file_id || item?.id || item?._id;
              return id !== fileId;
            }),
          };
        });
        return { ...prev, pages: nextPages };
      });

      toast.success('File deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['files', 'infinite'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Delete failed');
    },
  });

  const deleteFile = useCallback(async (fileId: string) => {
    await deleteFileMutation.mutateAsync(fileId);
  }, [deleteFileMutation]);

  const shareFileMutation = useMutation({
    mutationFn: async ({ fileId, recipient, passphrase, isEmail }: { fileId: string; recipient: string; passphrase: string; isEmail?: boolean }) => {
      const body: any = {
        passphrase,
        allow_multiple_downloads: true,
      };

      if (isEmail) {
        body.recipient_email = recipient;
      } else {
        body.recipient = recipient;
      }

      try {
        const response = await apiClient.post(`/files/${fileId}/share`, body, {
          loadingMessage: 'Creating secure share link...',
        } as any);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          clearStoredUser();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(error.response?.data?.error || 'Share failed');
      }
    },
    onSuccess: async (result) => {
      if (result.status === 'pending') {
        toast.success('File share created. Recipient will receive access when they link a wallet.');
      } else {
        toast.success('File shared successfully');
      }
      // Invalidate and immediately refetch outgoing shares
      await queryClient.invalidateQueries({ queryKey: ['outgoingShares'] });
      await refetchOutgoingShares();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Share failed');
    },
  });

  const shareFile = useCallback(async (fileId: string, recipient: string, passphrase: string, isEmail: boolean = false) => {
    await shareFileMutation.mutateAsync({ fileId, recipient, passphrase, isEmail });
  }, [shareFileMutation]);

  const revokeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      try {
        await apiClient.delete(`/files/shares/${shareId}`, {
          loadingMessage: 'Revoking access...',
        } as any);
      } catch (error: any) {
        if (error.response?.status === 401) {
          clearStoredUser();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Revoke failed');
      }
    },
    onSuccess: () => {
      toast.success('Share removed successfully');
      // Refresh both outgoing (for owner) and shared (for recipient) lists
      queryClient.invalidateQueries({ queryKey: ['outgoingShares'] });
      queryClient.invalidateQueries({ queryKey: ['sharedFiles'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Revoke failed');
    },
  });

  const revokeShare = useCallback(async (shareId: string) => {
    await revokeShareMutation.mutateAsync(shareId);
  }, [revokeShareMutation]);

  const refreshFiles = useCallback(async () => {
    await refetchFiles();
  }, [refetchFiles]);

  const refreshSharedFiles = useCallback(async () => {
    await refetchSharedFiles();
  }, [refetchSharedFiles]);

  const refreshOutgoingShares = useCallback(async () => {
    await refetchOutgoingShares();
  }, [refetchOutgoingShares]);

  const contextValue = useMemo<FileContextType>(() => ({
    files,
    sharedFiles,
    outgoingShares,
    hasMoreFiles: Boolean(hasMoreFiles),
    loadMoreFiles,
    loadingMoreFiles: isFetchingMoreFiles,
    hasMoreSharedFiles: Boolean(hasMoreSharedFiles),
    loadMoreSharedFiles,
    loadingMoreSharedFiles: isFetchingMoreSharedFiles,
    hasMoreOutgoingShares: Boolean(hasMoreOutgoingShares),
    loadMoreOutgoingShares,
    loadingMoreOutgoingShares: isFetchingMoreOutgoingShares,
    loading,
    error,
    uploadFile,
    downloadFile,
    deleteFile,
    shareFile,
    revokeShare,
    refreshFiles,
    refreshSharedFiles,
    refreshOutgoingShares,
  }), [
    files,
    sharedFiles,
    outgoingShares,
    hasMoreFiles,
    loadMoreFiles,
    isFetchingMoreFiles,
    hasMoreSharedFiles,
    loadMoreSharedFiles,
    isFetchingMoreSharedFiles,
    hasMoreOutgoingShares,
    loadMoreOutgoingShares,
    isFetchingMoreOutgoingShares,
    loading,
    error,
    uploadFile,
    downloadFile,
    deleteFile,
    shareFile,
    revokeShare,
    refreshFiles,
    refreshSharedFiles,
    refreshOutgoingShares,
  ]);

  return (
    <FileContext.Provider value={contextValue}>
      {children}
    </FileContext.Provider>
  );
};
