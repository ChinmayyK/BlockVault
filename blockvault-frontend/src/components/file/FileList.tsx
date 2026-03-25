import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  File,
  Download,
  Share2,
  Trash2,
  Calendar,
  User,
  Clock,
  MoreVertical,
  Lock,
  Loader2,
  Search,
  ShieldHalf,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useFiles } from '@/contexts/FileContext';
import { useVault } from '@/contexts/VaultContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollingText } from '@/components/ui/ScrollingText';
import { LegalModalFrame } from '@/components/legal/modals/LegalModalFrame';
import { PassphraseModal } from './PassphraseModal';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { verifyRedaction } from '@/api/redactor';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import { canRedact, canShare, canDelete, canRevokeShare } from '@/utils/permissions';
import { FileActionsMenu } from './FileActionsMenu';
import { FileDetailsPanel } from './FileDetailsPanel';

interface FileListProps {
  files?: any[];
  shares?: any[];
  onShare?: (fileId: string) => void;
  type: 'my-files' | 'shared' | 'shares';
  viewMode?: 'grid' | 'list';
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  workspaceContext?: string;
  onFileSelect?: (file: any) => void;
  onDownload?: (fileId: string, file: any) => Promise<void>;
}

export const FileList: React.FC<FileListProps> = React.memo(({
  files = [],
  shares = [],
  onShare,
  type,
  viewMode = 'grid',
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  workspaceContext,
  onFileSelect,
  onDownload,
}) => {
  const { downloadFile, deleteFile, revokeShare } = useFiles();
  const { isVaultUnlocked, vaultKey } = useVault();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileData, setSelectedFileData] = useState<any>(null);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [proofStatusById, setProofStatusById] = useState<Record<string, 'verified' | 'missing' | 'pending' | 'failed'>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const parentRef = useRef<HTMLDivElement>(null);
  const selectionContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    kind: 'file' | 'share';
    data: any;
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const MENU_DIMENSIONS = {
    file: { width: 240, height: 180 },
    share: { width: 240, height: 120 },
  } as const;

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleItemClick = useCallback(
    (id: string, event: React.MouseEvent) => {
      // Toggle side panel on item click instead of selection if single click
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
          // selection logic
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
              next.delete(id);
            } else {
              next.add(id);
            }
            return next;
          });
      } else {
          // Find the file and open details panel
          const clickedFile = (files || []).find(f => (f.file_id || f.id || f._id) === id) 
                           || (shares || []).find(s => (s.share_id || s.id) === id);
          if (clickedFile && onFileSelect) {
              onFileSelect(clickedFile);
          }
      }
    },
    [files, shares, onFileSelect],
  );

  const openFileContextMenuAtPosition = useCallback(
    (
      event: React.MouseEvent,
      id: string,
      data: any,
    ) => {
      event.preventDefault();
      event.stopPropagation();

      const { clientX, clientY } = event;
      const { width, height } = MENU_DIMENSIONS.file;
      const padding = 12;

      let left = clientX;
      let top = clientY;

      if (left + width > window.innerWidth - padding) {
        left = window.innerWidth - padding - width;
      }
      if (left < padding) left = padding;

      if (top + height > window.innerHeight - padding) {
        top = window.innerHeight - padding - height;
      }
      if (top < padding) top = padding;

      setMenuAnchor({ id, kind: 'file', data, top, left, width });
    },
    [],
  );

  const closeMenu = () => setMenuAnchor(null);

  const toggleMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    id: string,
    kind: 'file' | 'share',
    data: any,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (menuAnchor?.id === id) {
      closeMenu();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const { width, height } = MENU_DIMENSIONS[kind];
    const padding = 12;

    let left = rect.right - width;
    let top = rect.bottom + 10;

    if (left < padding) left = padding;
    if (left + width > window.innerWidth - padding) {
      left = window.innerWidth - padding - width;
    }

    if (top + height > window.innerHeight - padding) {
      top = rect.top - height - 10;
    }

    if (top < padding) {
      top = Math.min(window.innerHeight - padding - height, padding);
    }

    setMenuAnchor({ id, kind, data, top, left, width });
  };

  const menuRef = useRef<HTMLDivElement>(null); // Added menuRef for outside click detection

  useEffect(() => {
    if (!menuAnchor) return;

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAnchor(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuAnchor(null);
      }
    };

    const handleViewportChange = () => {
      setMenuAnchor(null);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [menuAnchor]);

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    try {
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (error) {
      console.warn('Error formatting file size:', bytes, error);
      return 'Unknown Size';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown Date';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  };

  const handleDownload = async (fileId: string, file?: any) => {
    console.log('📁 handleDownload called', { fileId, file });

    if (onDownload) {
      await onDownload(fileId, file);
      return;
    }

    // For shared files with encrypted_key, download directly without asking for passphrase
    if (file && file.encrypted_key) {
      const downloadName = file.original_name || file.name || file.file_name;
      try {
        console.log('🔐 Shared file download path', {
          fileId: file.file_id,
          encryptedKeyPresent: !!file.encrypted_key,
          downloadName,
        });
        await downloadFile(file.file_id, '', true, file.encrypted_key, downloadName);
      } catch (err) {
        console.error('Auto-download failed:', err);
      }
      return;
    }

    // If vault is unlocked, download directly using the session vault key
    if (isVaultUnlocked) {
      const downloadName = file?.original_name || file?.name || file?.file_name;
      try {
        await downloadFile(fileId, undefined, false, undefined, downloadName);
      } catch (err) {
        console.error('Vault auto-download failed:', err);
      }
      return;
    }

    // For own files, ask for passphrase if vault is locked
    setSelectedFile(fileId);
    setSelectedFileData(file);
    setShowPassphraseModal(true);
  };

  const confirmDownloadWithPassphrase = async (p: string) => {
    if (selectedFile) {
      const isSharedFile = selectedFileData && selectedFileData.encrypted_key;
      const encryptedKey = selectedFileData?.encrypted_key;
      const actualFileId = isSharedFile ? selectedFileData?.file_id : selectedFile;

      const downloadName =
        selectedFileData?.original_name ||
        selectedFileData?.name ||
        selectedFileData?.file_name;
      await downloadFile(actualFileId, p, isSharedFile, encryptedKey, downloadName);
      setShowPassphraseModal(false);
      setSelectedFile(null);
      setSelectedFileData(null);
      setPassphrase('');
    }
  };

  const confirmDownload = async () => {
    if (selectedFile && passphrase) {
      await confirmDownloadWithPassphrase(passphrase);
    }
  };

  const handleDelete = (fileId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete File',
      message: 'Are you sure you want to delete this file? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await deleteFile(fileId);
      }
    });
  };

  const handleRevokeShare = (shareId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Revoke Share',
      message: 'Are you sure you want to revoke this share? The recipient will lose access.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await revokeShare(shareId);
      }
    });
  };

  const getFileIcon = (fileName?: string) => {
    if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') return '📁';
    try {
      const normalizedName = fileName.trim().toLowerCase();
      if (normalizedName === '') return '📁';

      const parts = normalizedName.split('.');
      if (!parts || parts.length === 0) return '📁';

      const ext = parts[parts.length - 1];
      if (!ext || ext === '') return '📁';

      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return '🖼️';
      if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(ext)) return '🎥';
      if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return '🎵';
      if (['pdf'].includes(ext)) return '📄';
      if (['txt', 'md', 'doc', 'docx', 'rtf'].includes(ext)) return '📝';
      if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
      return '📁';
    } catch (error) {
      console.warn('Error getting file icon for:', fileName, error);
      return '📁';
    }
  };

  const getFileTypeColor = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext || '')) return 'from-pink-500 to-rose-500';
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(ext || '')) return 'from-primary-500 to-indigo-500';
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext || '')) return 'from-green-500 to-emerald-500';
    if (['pdf', 'txt', 'md', 'doc', 'docx', 'rtf'].includes(ext || '')) return 'from-blue-500 to-cyan-500';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return 'from-orange-500 to-yellow-500';
    return 'from-secondary-500 to-secondary-600';
  };

  // Virtual scrolling setup - enable for both list and grid views when there are many items
  const baseItems = type === 'shares' ? (shares || []).filter(share => share && typeof share === 'object') : (files || []).filter(file => file && typeof file === 'object');
  
  // Filter by search query
  const itemsToRender = useMemo(() => {
    if (!searchQuery.trim()) return baseItems;
    const lowerQuery = searchQuery.toLowerCase();
    return baseItems.filter((item: any) => {
        const nameMatch = (item.name || item.file_name || item.original_name || '').toLowerCase().includes(lowerQuery);
        const folderMatch = (item.folder || '').toLowerCase().includes(lowerQuery);
        const userMatch = (item.user_address || item.recipient || item.shared_with || '').toLowerCase().includes(lowerQuery);
        return nameMatch || folderMatch || userMatch;
    });
  }, [baseItems, searchQuery]);

  const shouldUseVirtualScrolling = itemsToRender.length > 20;

  const fileProofMeta = useMemo(
    () =>
      itemsToRender
        .map((file) => ({
          id: file?.file_id || file?.id || file?._id,
          redactionStatus: file?.redaction_status,
          redactedFrom: file?.redacted_from,
        }))
        .filter((item) => typeof item.id === 'string'),
    [itemsToRender],
  );

  const refreshProofStatuses = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const result = await verifyRedaction(id, { silent: true });
          const verified = result.proof_valid ?? result.valid_proof;

          if (verified) {
            return { id, status: 'verified' as const };
          }
          if (result.status === 'pending') {
            return { id, status: 'pending' as const };
          }
          if (result.status === 'failed') {
            return { id, status: 'failed' as const };
          }
          return { id, status: 'missing' as const };
        } catch (error) {
          const responseStatus =
            typeof error === 'object' && error && 'response' in error
              ? (error as { response?: { status?: number } }).response?.status
              : undefined;
          if (responseStatus === 429) {
            return { id, status: 'pending' as const };
          }
          return { id, status: 'missing' as const };
        }
      }),
    );

    setProofStatusById((prev) => {
      const next = { ...prev };
      let changed = false;
      results.forEach((r) => {
        if (next[r.id] !== r.status) {
          next[r.id] = r.status;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    if (type !== 'my-files') return;

    const eligible = fileProofMeta
      .filter((item) => item.redactionStatus || item.redactedFrom)
      .map((item) => item.id as string);
    const ineligible = fileProofMeta
      .filter((item) => !item.redactionStatus && !item.redactedFrom)
      .map((item) => item.id as string);

    setProofStatusById((prev) => {
      const next = { ...prev };
      let changed = false;

      ineligible.forEach((id) => {
        if (next[id] !== 'missing') {
          next[id] = 'missing';
          changed = true;
        }
      });

      fileProofMeta.forEach((item) => {
        const id = item.id as string;
        if (item.redactionStatus === 'pending') {
          if (next[id] !== 'pending') {
            next[id] = 'pending';
            changed = true;
          }
        } else if (item.redactionStatus === 'failed') {
          if (next[id] !== 'failed') {
            next[id] = 'failed';
            changed = true;
          }
        } else if ((item.redactionStatus || item.redactedFrom) && !next[id]) {
          next[id] = 'missing';
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    const idsToVerify = eligible.filter((id) => {
      const currentStatus = proofStatusById[id];
      const serverStatus = fileProofMeta.find((item) => item.id === id)?.redactionStatus;
      if (!currentStatus) {
        return true;
      }
      return serverStatus === 'complete' || currentStatus === 'pending';
    });

    void refreshProofStatuses(idsToVerify);
  }, [fileProofMeta, proofStatusById, refreshProofStatuses, type]);

  useEffect(() => {
    if (type !== 'my-files') return;

    const pendingIds = fileProofMeta
      .filter((item) => item.redactionStatus === 'pending' || proofStatusById[item.id as string] === 'pending')
      .map((item) => item.id as string);

    if (pendingIds.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshProofStatuses(pendingIds);
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fileProofMeta, proofStatusById, refreshProofStatuses, type]);

  const getResponsiveColumns = useCallback(() => {
    if (viewMode !== 'grid') return 1;
    if (typeof window === 'undefined') return 1;
    const width = parentRef.current?.clientWidth || window.innerWidth;
    if (width >= 1280) return 4;
    if (width >= 1024) return 3;
    if (width >= 768) return 2;
    return 1;
  }, [viewMode]);

  const [gridColumns, setGridColumns] = useState(() => getResponsiveColumns());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setGridColumns(getResponsiveColumns());
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [getResponsiveColumns]);

  const itemsPerRow = viewMode === 'grid' ? gridColumns : 1;
  const rowCount = viewMode === 'grid' ? Math.ceil(itemsToRender.length / Math.max(itemsPerRow, 1)) : itemsToRender.length;

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoadingMore) {
          onLoadMore();
        }
      },
      {
        root: shouldUseVirtualScrolling ? parentRef.current : null,
        threshold: 0.3,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, onLoadMore, isLoadingMore, shouldUseVirtualScrolling]);

  const virtualizer = useVirtualizer({
    count: viewMode === 'grid' ? rowCount : itemsToRender.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => viewMode === 'grid' ? 280 : 120, // Row height for grid, item height for list
    overscan: 5,
    enabled: shouldUseVirtualScrolling && itemsToRender.length > 0,
  });

  // Marquee selection handlers
  const updateSelectionFromRect = useCallback(
    (rect: { x1: number; y1: number; x2: number; y2: number }) => {
      const container = selectionContainerRef.current;
      if (!container) return;

      const { x1, y1, x2, y2 } = rect;
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const top = Math.min(y1, y2);
      const bottom = Math.max(y1, y2);

      const next = new Set<string>();
      const cards = container.querySelectorAll<HTMLElement>('[data-file-id]');
      cards.forEach((el) => {
        const id = el.getAttribute('data-file-id');
        if (!id) return;
        const box = el.getBoundingClientRect();
        const intersects =
          box.right >= left &&
          box.left <= right &&
          box.bottom >= top &&
          box.top <= bottom;
        if (intersects) {
          next.add(id);
        }
      });
      setSelectedIds(next);
    },
    [],
  );

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Only start marquee on left button
    if (event.button !== 0) return;
    // Avoid starting selection when clicking on interactive controls
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[data-menu-anchor]')) {
      return;
    }

    const container = selectionContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    // Only start if click is inside the container bounds
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return;
    }

    event.preventDefault();
    clearSelection();
    selectionStartRef.current = { x, y };
    setSelectionRect({ x1: x, y1: y, x2: x, y2: y });
    setIsSelecting(true);
  }, [clearSelection]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selectionStartRef.current) return;
    const { x, y } = selectionStartRef.current;
    const currentX = event.clientX;
    const currentY = event.clientY;
    const rect = { x1: x, y1: y, x2: currentX, y2: currentY };
    setSelectionRect(rect);
    updateSelectionFromRect(rect);
  }, [isSelecting, updateSelectionFromRect]);

  const handleMouseUp = useCallback(() => {
    if (!isSelecting) return;
    setIsSelecting(false);
    selectionStartRef.current = null;
    setSelectionRect((prev) => {
      if (!prev) return null;
      updateSelectionFromRect(prev);
      return null;
    });
  }, [isSelecting, updateSelectionFromRect]);

  // Memoize file/share card rendering
  const renderFileCard = useCallback((file: any, index: number) => {
    const fileName = file?.name || file?.file_name || 'Unknown File';
    const fileSize = file?.size || file?.file_size || 0;
    const fileId = file?.file_id || file?.id || 'unknown';
    const createdAt = file?.created_at || new Date().toISOString();
    const folder = file?.folder;
    const isSelected = selectedIds.has(fileId);
    const proofStatus = proofStatusById[fileId] || 'missing';

    return (
      <Card
        key={fileId}
        variant="premium"
        data-file-id={fileId}
        onClick={(event) => handleItemClick(fileId, event)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          handleDownload(fileId, file);
        }}
        className={`group relative cursor-pointer border rounded-2xl ${isSelected
          ? 'border-primary ring-2 ring-primary/40 shadow-[0_0_20px_rgba(var(--primary),0.15)] bg-primary/5'
          : 'border-border/50 bg-card hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:scale-[1.01]'
          } transition-all duration-300 ease-out`}
        style={{ animationDelay: `${Math.min(index, 20) * 50}ms`, animationFillMode: 'both' }}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className={`relative w-14 h-14 bg-gradient-to-br ${getFileTypeColor(fileName)} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <span className="text-2xl drop-shadow-sm text-white">{getFileIcon(fileName)}</span>
                <div className="absolute inset-0 rounded-xl bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity dark:bg-white/10" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <ScrollingText
                    text={fileName}
                    className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate"
                  />
                  <div className="flex items-center gap-1.5 opacity-60">
                    <Lock className="w-3 h-3 text-primary" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium mb-3">
                  <span>{formatFileSize(fileSize)}</span>
                  <span className="opacity-30">•</span>
                  <span>{formatDate(createdAt)}</span>
                </div>

                {type === 'my-files' && (
                  <div className="relative group inline-block">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-default border transition-colors ${proofStatus === 'verified'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : proofStatus === 'failed'
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        : proofStatus === 'pending'
                          ? 'bg-sky-500/10 text-sky-500 border-sky-500/20'
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}
                    >
                      {proofStatus === 'verified' && <><span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Verified</>}
                      {proofStatus === 'failed' && <><Trash2 className="w-3 h-3" /> Proof Failed</>}
                      {proofStatus === 'pending' && <><Loader2 className="w-3 h-3 animate-spin" /> Generating Proof</>}
                      {proofStatus === 'missing' && <><Clock className="w-3 h-3" /> Proof Missing</>}
                    </span>
                    {proofStatus === 'pending' && file?.redaction_progress && (
                      <div className="absolute left-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-48 p-2.5 bg-slate-900 border border-slate-700/50 rounded-lg shadow-xl z-50">
                        <div className="flex items-center justify-between text-[10px] text-sky-200/90 mb-1.5 font-medium">
                          <span>Chunk {file.redaction_progress.current} of {file.redaction_progress.total}</span>
                          <span>{file.redaction_progress.total > 0 ? Math.round((file.redaction_progress.current / file.redaction_progress.total) * 100) : 0}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-400 rounded-full transition-all duration-300"
                            style={{ width: `${file.redaction_progress.total > 0 ? Math.round((file.redaction_progress.current / file.redaction_progress.total) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="relative flex-shrink-0 z-10" onClick={(e) => e.stopPropagation()}>
              <FileActionsMenu
                  fileId={fileId}
                  fileName={fileName}
                  canRedact={canRedact(user?.role) && (fileName.toLowerCase().endsWith('.pdf'))}
                  canShare={canShare(user?.role)}
                  canDelete={canDelete(user?.role)}
                  hasProof={proofStatus === 'verified'}
                  isShared={false}
                  onDownload={() => handleDownload(fileId, file)}
                  onRedact={() => navigate(user?.address === 'demo_user' ? `/demo/redact/${fileId}` : `/redact/${fileId}`)}
                  onShare={() => onShare && onShare(fileId)}
                  onVerify={() => {}} // Could dispatch a proof verification manually if needed
                  onDelete={() => handleDelete(fileId)}
              />
            </div>
          </div>

          {folder && (
            <div className="mt-2 flex items-center space-x-1.5 text-[10px] uppercase tracking-wider font-bold text-primary/70">
              <span className="opacity-50">in</span>
              <span className="bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">{folder}</span>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-col gap-2 mt-5 pt-4 border-t border-border/10">
            {type === 'my-files' && canRedact(user?.role) && fileName.toLowerCase().endsWith('.pdf') && (
              <Button
                onClick={() => navigate(user?.address === 'demo_user' ? `/demo/redact/${fileId}` : `/redact/${fileId}`)}
                variant="ghost"
                size="sm"
                disabled={proofStatus === 'pending'}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary transition-all rounded-xl h-10 border border-primary/20"
              >
                <ShieldHalf className="w-4 h-4" />
                Redact Document
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handleDownload(fileId, file)}
                variant="ghost"
                size="sm"
                className="flex items-center justify-center gap-1.5 text-[11px] font-semibold bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all rounded-xl h-9"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
              {type === 'my-files' && onShare && canShare(user?.role) && (
                <Button
                  onClick={() => onShare(fileId)}
                  variant="ghost"
                  size="sm"
                  className="flex items-center justify-center gap-1.5 text-[11px] font-semibold bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all rounded-xl h-9"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </Button>
              )}
              {type === 'shared' && canRevokeShare(user?.role) && (
                <Button
                  onClick={() => handleRevokeShare(file.share_id || file.id)}
                  variant="ghost"
                  size="sm"
                  className="flex items-center justify-center gap-1.5 text-[11px] font-semibold bg-destructive/5 hover:bg-destructive/10 text-destructive transition-all rounded-xl h-9 col-span-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Revoke Access
                </Button>
              )}
            </div>
          </div>

        </div>
      </Card>
    );
  }, [type, onShare, handleDownload, handleItemClick, selectedIds, user?.role, proofStatusById, navigate]);

  const renderShareCard = useCallback((share: any, index: number) => {
    const shareId = share?.share_id || 'unknown';
    const fileName = share?.file_name || 'Unknown File';
    const sharedWith = share?.shared_with || share?.recipient || 'Unknown';
    const createdAt = share?.created_at || new Date().toISOString();

    return (
      <Card
        key={shareId}
        variant="premium"
        onClick={(event) => handleItemClick(shareId, event)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          handleDownload(shareId, share);
        }}
        className="cursor-pointer group relative border border-border/50 bg-card rounded-2xl transition-all duration-300 ease-out hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:scale-[1.01]"
        style={{ animationDelay: `${Math.min(index, 20) * 50}ms`, animationFillMode: 'both' }}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className={`relative w-14 h-14 bg-gradient-to-br ${getFileTypeColor(fileName)} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <span className="text-2xl drop-shadow-sm text-white">
                  {getFileIcon(fileName)}
                </span>
                <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <ScrollingText
                    text={fileName}
                    className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate"
                  />
                  <div className="flex items-center gap-1.5 opacity-60">
                    <Share2 className="w-3 h-3 text-primary" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                  <span>Shared with recipient</span>
                  <span className="opacity-30">•</span>
                  <span>{formatDate(createdAt)}</span>
                </div>
              </div>
            </div>
            <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
              <FileActionsMenu
                  fileId={shareId}
                  fileName={fileName}
                  canRedact={false}
                  canShare={false}
                  canDelete={true}
                  hasProof={false}
                  isShared={true}
                  onDownload={() => handleDownload(shareId, share)}
                  onRedact={() => {}}
                  onShare={() => {}}
                  onVerify={() => {}}
                  onRevoke={() => handleRevokeShare(shareId)}
                  onDelete={() => {}}
              />
            </div>
          </div>
          <div className="space-y-3 p-4 bg-accent rounded-xl border border-border/60">
            <div className="flex items-center space-x-2 text-sm">
              <User className="w-4 h-4 text-primary" />
              <span className="text-foreground font-medium">Recipient:</span>
              <code className="text-primary font-mono text-xs bg-primary/5 px-2 py-1 rounded flex-1 truncate">
                {sharedWith && typeof sharedWith === 'string' ? `${sharedWith.slice(0, 10)}...${sharedWith.slice(-8)}` : 'Unknown'}
              </code>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-accent-foreground/80" />
              <span>{formatDate(createdAt)}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }, [handleDownload, handleRevokeShare]);

  const loadMoreSection = hasMore && onLoadMore ? (
    <div className="flex flex-col items-center mt-6 space-y-2">
      {isLoadingMore && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
      )}
      <Button
        variant="outline"
        onClick={onLoadMore}
        disabled={isLoadingMore}
        className="gap-2"
      >
        {isLoadingMore ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          'Load more'
        )}
      </Button>
    </div>
  ) : null;

  if (type === 'shares') {
    return (
      <div
        className="space-y-4"
        ref={selectionContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {workspaceContext && (
          <div className="bg-primary/5 rounded-lg border border-primary/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium text-foreground">
                Workspace: <span className="text-primary font-bold">{workspaceContext}</span>
              </span>
            </div>
          </div>
        )}

        {(shares || []).length === 0 ? (
          <Card variant="premium" className="text-center py-24 animate-fade-in-up">
            <div className="relative mb-10 inline-block">
              <div className="w-32 h-32 bg-gradient-to-br from-primary-500 via-primary-600 to-accent-500 rounded-3xl flex items-center justify-center mx-auto animate-float shadow-2xl">
                <Share2 className="w-16 h-16 text-white drop-shadow-lg" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-accent-500 rounded-3xl blur-3xl opacity-40 animate-glow-pulse" />
            </div>
            <h3 className="text-3xl font-bold text-foreground mb-4 text-gradient">No Shares Yet</h3>
            <p className="text-muted-foreground max-w-lg mx-auto text-lg leading-relaxed mb-8">
              Files you share with others will appear here. Start sharing to see your active shares.
            </p>
            <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
              <p className="text-sm text-muted-foreground">
                Share files securely with team members, clients, or external parties with controlled access and expiration dates.
              </p>
            </div>
          </Card>
        ) : shouldUseVirtualScrolling ? (
          <div
            ref={parentRef}
            className="h-[600px] overflow-auto"
          >
            <div
              className={`relative ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-6'}`}
              style={{
                height: `${virtualizer.getTotalSize()}px`,
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                if (viewMode === 'grid') {
                  // For grid view, render a row of items
                  const rowIndex = virtualItem.index;
                  const startIdx = rowIndex * itemsPerRow;
                  const endIdx = Math.min(startIdx + itemsPerRow, itemsToRender.length);
                  const rowItems = itemsToRender.slice(startIdx, endIdx);

                  return (
                    <div
                      key={virtualItem.key}
                      data-index={rowIndex}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                      {rowItems.map((share, idx) => renderShareCard(share, startIdx + idx))}
                    </div>
                  );
                } else {
                  // For list view, render single item
                  const share = itemsToRender[virtualItem.index];
                  if (!share) return null;
                  return (
                    <div
                      key={virtualItem.key}
                      data-index={virtualItem.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      {renderShareCard(share, virtualItem.index)}
                    </div>
                  );
                }
              })}
            </div>
          </div>
        ) : (
          <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
            {itemsToRender.map((share, index) => renderShareCard(share, index))}
          </div>
        )}
        {loadMoreSection}
        <div ref={loadMoreSentinelRef} className="h-1 w-full" aria-hidden />
        {isSelecting && selectionRect && (
          <div
            className="pointer-events-none fixed z-40 rounded-lg border border-accent-blue/70 bg-accent-blue/10"
            style={{
              left: Math.min(selectionRect.x1, selectionRect.x2),
              top: Math.min(selectionRect.y1, selectionRect.y2),
              width: Math.abs(selectionRect.x2 - selectionRect.x1),
              height: Math.abs(selectionRect.y2 - selectionRect.y1),
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full relative">
      <div
        className="space-y-4 flex-1 min-w-0"
        ref={selectionContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {workspaceContext && (
                <div className="bg-primary/5 rounded-lg border border-primary/20 px-4 py-3 flex items-center justify-between w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-sm font-medium text-foreground">
                        Workspace: <span className="text-primary font-bold">{workspaceContext}</span>
                        </span>
                    </div>
                </div>
            )}
            <div className="relative w-full sm:w-80 ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search files by name, folder, or user..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-slate-400"
                />
            </div>
        </div>

        {(files || []).length === 0 && (shares || []).length === 0 && !searchQuery ? (
        <Card variant="premium" className="text-center py-24 animate-fade-in-up">
          <div className="relative mb-10 inline-block">
            <div className="w-32 h-32 bg-gradient-to-br from-primary via-primary/80 to-accent rounded-3xl flex items-center justify-center mx-auto animate-float shadow-2xl">
              <File className="w-16 h-16 text-foreground drop-shadow-lg" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-3xl blur-3xl opacity-40 animate-glow-pulse" />
          </div>
          <h3 className="text-3xl font-bold text-foreground mb-4 text-gradient">
            {type === 'my-files' ? 'No Files Yet' : 'No Shared Files'}
          </h3>
          <p className="text-muted-foreground max-w-lg mx-auto text-lg leading-relaxed mb-8">
            {type === 'my-files'
              ? 'Upload your first file to get started with secure, encrypted storage.'
              : 'Files shared with you will appear here.'
            }
          </p>

          {type === 'my-files' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="p-4 bg-accent rounded-xl border border-border/60">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">End-to-End Encryption</h4>
                  <p className="text-sm text-muted-foreground">Your files are encrypted before upload</p>
                </div>
                <div className="p-4 bg-accent rounded-xl border border-border/60">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center mb-3">
                    <Share2 className="w-5 h-5 text-green-500" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">Secure Sharing</h4>
                  <p className="text-sm text-muted-foreground">Share files with controlled access</p>
                </div>
                <div className="p-4 bg-accent rounded-xl border border-border/60">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mb-3">
                    <Download className="w-5 h-5 text-purple-500" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">IPFS Storage</h4>
                  <p className="text-sm text-muted-foreground">Decentralized file storage</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      ) : shouldUseVirtualScrolling ? (
        <div
          ref={parentRef}
          className="h-[600px] overflow-auto"
        >
          <div
            className={`relative ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-6'}`}
            style={{
              height: `${virtualizer.getTotalSize()}px`,
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              if (viewMode === 'grid') {
                // For grid view, render a row of items
                const rowIndex = virtualItem.index;
                const startIdx = rowIndex * itemsPerRow;
                const endIdx = Math.min(startIdx + itemsPerRow, itemsToRender.length);
                const rowItems = itemsToRender.slice(startIdx, endIdx);

                return (
                  <div
                    key={virtualItem.key}
                    data-index={rowIndex}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '1.5rem'
                    }}
                  >
                    {rowItems.map((file, idx) => renderFileCard(file, startIdx + idx))}
                  </div>
                );
              } else {
                // For list view, render single item
                const file = itemsToRender[virtualItem.index];
                if (!file) return null;
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {renderFileCard(file, virtualItem.index)}
                  </div>
                );
              }
            })}
          </div>
        </div>
      ) : (
        <div 
          style={{ 
            display: viewMode === 'grid' ? 'grid' : 'block',
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(260px, 1fr))' : undefined,
            gap: viewMode === 'grid' ? '1.5rem' : '1.5rem'
          }}
          className={viewMode === 'list' ? 'space-y-6' : ''}
        >
          {itemsToRender.map((file, index) => renderFileCard(file, index))}
        </div>
      )}

      {loadMoreSection}
      <div ref={loadMoreSentinelRef} className="h-1 w-full" aria-hidden />

      <PassphraseModal
        isOpen={showPassphraseModal}
        onClose={() => {
          setShowPassphraseModal(false);
          setPassphrase('');
        }}
        onConfirm={(p) => {
          // Temporarily set passphrase for confirmDownload to work, 
          // though it's better to pass it directly.
          // For now, let's just pass it to confirmDownload directly.
          void confirmDownloadWithPassphrase(p);
        }}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        isDanger={true}
        confirmText="Confirm"
      />
      </div>
    </div>
  );
});
