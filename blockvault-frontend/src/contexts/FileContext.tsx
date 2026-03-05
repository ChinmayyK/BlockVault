import React, { createContext, useContext, useCallback, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getApiBase } from '@/lib/getApiBase';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
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

  const getStoredUser = () => readStoredUser<{ jwt?: string }>();

  const initialUser = getStoredUser();

  // Cache user authentication state to avoid repeated localStorage reads
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!initialUser);

  const userRef = useRef<{ jwt?: string } | null>(initialUser);

  // Initialize user ref on mount and listen for auth changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const updateAuth = () => {
      const storedUser = readStoredUser<{ jwt?: string }>();
      const authenticated = !!storedUser;
      setIsAuthenticated(authenticated);
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
    queryKey: ['files', 'infinite'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) {
        params.append('after', String(pageParam));
      }
      const response = await fetchWithTimeout(`${getApiBase()}/files/?${params.toString()}`, {
        headers: getAuthHeadersWithContentType(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          return { items: [], next_after: null, has_more: false };
        }
        throw new Error('Failed to fetch files');
      }
      return response.json();
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
    queryKey: ['sharedFiles'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) {
        params.append('after', String(pageParam));
      }
      const response = await fetchWithTimeout(`${getApiBase()}/files/shared?${params.toString()}`, {
        headers: getAuthHeadersWithContentType(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          return { shares: [], next_after: null, has_more: false };
        }
        throw new Error('Failed to fetch shared files');
      }
      return response.json();
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
    queryKey: ['outgoingShares'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) {
        params.append('after', String(pageParam));
      }
      const response = await fetchWithTimeout(`${getApiBase()}/files/shares/outgoing?${params.toString()}`, {
        headers: getAuthHeadersWithContentType(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          return { shares: [], next_after: null, has_more: false };
        }
        throw new Error('Failed to fetch outgoing shares');
      }
      return response.json();
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
      (filesPages?.pages || [])
        .flatMap((page: any) => page?.items || [])
        .filter((item: any) => item && typeof item === 'object'),
    [filesPages],
  );
  const sharedFiles = useMemo(
    () =>
      (sharedFilesPages?.pages || [])
        .flatMap((page: any) => page?.shares || [])
        .filter((share: any) => share && typeof share === 'object'),
    [sharedFilesPages],
  );
  const outgoingShares = useMemo(
    () =>
      (outgoingSharesPages?.pages || [])
        .flatMap((page: any) => page?.shares || [])
        .filter((share: any) => share && typeof share === 'object'),
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

      const response = await fetchWithTimeout(`${getApiBase()}/files/`, {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeaders().Authorization,
        },
        body: formData,
        timeout: 60000,
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearStoredUser();
          throw new Error('Session expired. Please login again.');
        }
        let errorMessage = `Upload failed with status ${response.status}`;
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            if (data?.error) {
              errorMessage = data.error;
            } else {
              errorMessage = JSON.stringify(data);
            }
          } else {
            const text = await response.text();
            if (text) {
              errorMessage = text;
            }
          }
        } catch (err) {
          // ignore parsing errors
        }
        throw new Error(errorMessage);
      }

      return response.json();
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

      const requestUrl = `${getApiBase()}/files/${fileId}?key=${encodeURIComponent(actualPassphrase)}`;
      console.log('🌐 Starting download fetch to:', requestUrl);

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: getAuthHeadersWithContentType(),
      });

      if (!response.ok) {
        console.error('❌ Download response not OK', response.status);
        if (response.status === 401) {
          clearStoredUser();
          throw new Error('Session expired. Please login again.');
        }
        if (response.status === 410) {
          throw new Error('File is no longer available. It may have been deleted or expired.');
        }
        if (response.status === 404) {
          throw new Error('File not found. It may have been deleted.');
        }
        const errorText = await response.text().catch(() => '');
        const errorMessage = errorText || `Download failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      console.log('✅ Download response OK, reading blob…');

      const blob = await response.blob();
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
      const response = await fetchWithTimeout(`${getApiBase()}/files/${fileId}`, {
        method: 'DELETE',
        headers: getAuthHeadersWithContentType(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearStoredUser();
          throw new Error('Session expired. Please login again.');
        }
        // If the file is already gone on the backend, treat this as a successful delete
        if (response.status === 404) {
          return;
        }
        throw new Error('Delete failed');
      }
    },
    onSuccess: (_data, fileId) => {
      // Optimistically remove the file from the local infinite query cache
      queryClient.setQueryData<any>(['files', 'infinite'], (prev) => {
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

      const response = await fetchWithTimeout(`${getApiBase()}/files/${fileId}/share`, {
        method: 'POST',
        headers: getAuthHeadersWithContentType(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearStoredUser();
          throw new Error('Session expired. Please login again.');
        }
        const errorData = await response.json().catch(() => ({ error: 'Share failed' }));
        throw new Error(errorData.error || 'Share failed');
      }

      return response.json();
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
      const response = await fetchWithTimeout(`${getApiBase()}/files/shares/${shareId}`, {
        method: 'DELETE',
        headers: getAuthHeadersWithContentType(),
      });

      if (!response.ok) {
        if (response.status === 401) {
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
