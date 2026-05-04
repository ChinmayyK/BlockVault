import React, { useState, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import {
  Upload,
  Grid3x3,
  List,
  Download,
  Share2,
  Trash2,
  MoreVertical,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Search,
  Filter,
  HardDrive,
  TrendingUp,
  Users,
  FolderOpen,
  RefreshCw,
  Copy,
  Check,
  X,
  Command,
  UploadCloud,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlowingSeparator } from "@/components/ui/glowing-separator";
import { GlowingDivider } from "@/components/ui/GlowingDivider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useFiles } from "@/contexts/FileContext";
import { MultiFileUpload } from "@/components/file/MultiFileUpload";
import { FileList } from "@/components/file/FileList";
import { FileDetailsPanel } from "@/components/file/FileDetailsPanel";
import { FilePreviewPanel } from "@/components/file/FilePreviewPanel";
import { FileListSkeleton } from "@/components/skeleton/FileListSkeleton";
import { useDebounce } from "@/hooks/useDebounce";
import { SystemHealth } from "@/components/security/SystemHealth";

const LazyShareModal = lazy(() =>
  import("@/components/file/ShareModal").then((module) => ({ default: module.ShareModal }))
);

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    files,
    sharedFiles,
    outgoingShares,
    refreshSharedFiles,
    refreshOutgoingShares,
    loading,
    hasMoreFiles,
    loadMoreFiles,
    loadingMoreFiles,
    hasMoreSharedFiles,
    loadMoreSharedFiles,
    loadingMoreSharedFiles,
    hasMoreOutgoingShares,
    loadMoreOutgoingShares,
    loadingMoreOutgoingShares,
  } = useFiles();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<'my-files' | 'shared' | 'shares'>('my-files');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // Debounce search for performance
  const [showUpload, setShowUpload] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedDetailsFile, setSelectedDetailsFile] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<'all' | 'images' | 'documents' | 'videos' | 'audio' | 'archives'>('all');
  const [showStats, setShowStats] = useState(true);
  const [refreshingShared, setRefreshingShared] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const sharedPrefetched = useRef(false);
  const outgoingPrefetched = useRef(false);

  // Calculate statistics
  const totalFiles = (files || []).length;
  const totalSharedFiles = (sharedFiles || []).length;
  const totalShares = (outgoingShares || []).length;
  const totalSize = (files || []).reduce((sum, file) => sum + (file.size || 0), 0);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleRefreshSharedFiles = useCallback(async () => {
    setRefreshingShared(true);
    try {
      await refreshSharedFiles();
    } finally {
      setRefreshingShared(false);
    }
  }, [refreshSharedFiles]);

  const handleSharedTabHover = useCallback(() => {
    if (!sharedPrefetched.current) {
      sharedPrefetched.current = true;
      void refreshSharedFiles();
    }
  }, [refreshSharedFiles]);

  const handleSharesTabHover = useCallback(() => {
    if (!outgoingPrefetched.current) {
      outgoingPrefetched.current = true;
      void refreshOutgoingShares();
    }
  }, [refreshOutgoingShares]);

  const handleCopyAddress = useCallback(() => {
    if (user?.address) {
      navigator.clipboard.writeText(user.address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  }, [user?.address]);

  const clearFilters = useCallback(() => {
    setFilterType('all');
    setSortBy('date');
    setSortOrder('desc');
    setSearchQuery('');
  }, []);

  const hasActiveFilters = useMemo(
    () => filterType !== 'all' || sortBy !== 'date' || sortOrder !== 'desc' || debouncedSearchQuery !== '',
    [filterType, sortBy, sortOrder, debouncedSearchQuery]
  );

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setShowUpload(true);
  }, []);

  const getFileType = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext || '')) return 'images';
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(ext || '')) return 'videos';
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext || '')) return 'audio';
    if (['pdf', 'txt', 'md', 'doc', 'docx', 'rtf'].includes(ext || '')) return 'documents';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return 'archives';
    return 'other';
  };

  const filteredFiles = useMemo(() =>
    (files || []).filter(file => {
      const matchesSearch = file.name && file.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      const matchesFilter = filterType === 'all' || getFileType(file.name || '') === filterType;
      return matchesSearch && matchesFilter;
    }),
    [files, debouncedSearchQuery, filterType]
  );

  const filteredSharedFiles = useMemo(() =>
    (sharedFiles || []).filter(file => {
      const fileName = file.name || file.file_name;
      return fileName && fileName.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    }),
    [sharedFiles, debouncedSearchQuery]
  );

  const filteredOutgoingShares = useMemo(() =>
    (outgoingShares || []).filter(share =>
      share.file_name && share.file_name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    ),
    [outgoingShares, debouncedSearchQuery]
  );

  // Sort files
  const sortedFiles = useMemo(() =>
    [...filteredFiles].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'date':
          comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    }),
    [filteredFiles, sortBy, sortOrder]
  );

  const stats = [
    { label: "Total Files", value: totalFiles.toString(), icon: FileText },
    { label: "Storage Used", value: formatFileSize(totalSize), icon: HardDrive },
    { label: "Shared Files", value: totalSharedFiles.toString(), icon: Share2 },
    { label: "Active Shares", value: totalShares.toString(), icon: Users },
  ];

  return (
    <div className="flex h-[calc(100vh-6rem)] -mt-6 -mx-6 overflow-hidden animate-in fade-in duration-500">
      {/* Explorer Pane */}
      <div
        className="flex-1 overflow-y-auto px-6 pt-6 pb-12 space-y-6 custom-scrollbar relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
      {/* Drag Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-primary/20 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-background/90 border-4 border-dashed border-primary rounded-3xl p-16 text-center shadow-glow-strong">
            <div className="w-32 h-32 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <UploadCloud className="w-16 h-16 text-white" />
            </div>
            <h3 className="text-3xl font-bold mb-3">Drop Files Here</h3>
            <p className="text-muted-foreground text-lg">
              Release to upload with end-to-end encryption
            </p>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      {activeTab === 'my-files' && !showUpload && (
        <button
          onClick={() => setShowUpload(true)}
          className="fixed bottom-8 right-8 z-40 group flex items-center justify-center focus:outline-none"
          aria-label="Upload file"
          title="Upload file"
        >
          <span className="absolute inset-0 rounded-full bg-slate-900/60 blur-lg transition-all duration-300 group-hover:opacity-90 group-hover:blur-xl dark:bg-gradient-to-br dark:from-blue-500 dark:via-indigo-500 dark:to-violet-500 dark:opacity-60" />
          <span className="absolute inset-0 rounded-full border border-slate-700/50 opacity-40 group-hover:opacity-60 transition dark:border-blue-400/50" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-slate-800 dark:bg-background dark:text-foreground dark:border dark:border-border dark:shadow-[0_25px_45px_-20px_rgba(56,189,248,0.45)] dark:group-hover:shadow-[0_30px_60px_-18px_rgba(99,102,241,0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400/40">
            <Plus className="h-8 w-8 transition-transform duration-300 group-hover:rotate-90" />
          </div>
          <span className="absolute right-full mr-4 rounded-full bg-card/95 border border-border shadow-xl px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Upload File
          </span>
        </button>
      )}

      {/* Overview Banner */}
      <section className="rounded-3xl border border-borderAccent/30 bg-card-muted/60 p-6 shadow-[0_35px_70px_-28px_rgba(15,23,42,0.65)] backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">
                Overview
              </p>
              <h1 className="text-3xl font-semibold">Secure File Storage</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Manage uploads, shares, and blockchain notarization from a single workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="gap-2" onClick={() => setShowUpload(true)}>
                <Upload className="h-4 w-4" />
                Upload File
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowFilters((prev) => !prev)}
              >
                <Filter className="h-4 w-4" />
                {showFilters ? "Hide Filters" : "Quick Filters"}
              </Button>
            </div>
          </div>

          <GlowingDivider className="hidden lg:block mx-10 self-stretch" />
          <GlowingDivider orientation="horizontal" className="lg:hidden my-4" />

          <div className="flex flex-col gap-4 w-full max-w-sm">
            <div className="rounded-2xl border border-borderAccent/25 bg-card/70 p-5 shadow-[0_25px_60px_-30px_rgba(59,130,246,0.45)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Wallet
                  </p>
                  <p className="mt-1 font-semibold">
                    {user?.address ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}` : "Not connected"}
                  </p>
                </div>
                {user?.address && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAddress}
                    className="gap-2 border-borderAccent/50 text-xs"
                  >
                    {copiedAddress ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedAddress ? "Copied" : "Copy"}
                  </Button>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: "Files", value: totalFiles.toString() },
                  { label: "Shared", value: totalSharedFiles.toString() },
                  { label: "Shares", value: totalShares.toString() },
                  { label: "Storage", value: formatFileSize(totalSize) },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="text-lg font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* System Health Pulse Overlay */}
            <SystemHealth />
          </div>
        </div>
      </section>

      <GlowingSeparator className="opacity-70" />

      {/* Stats */}
      {showStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-5 hover:border-primary/50 transition-all hover:-translate-y-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-semibold mt-2">{stat.value}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary dark:bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-6 w-6 text-foreground dark:text-primary" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Files */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Recent Files</h2>
        </div>
        {loading && !files?.length ? (
          <FileListSkeleton count={4} />
        ) : (
          <FileList
            files={sortedFiles}
            onShare={(fileId) => {
              setSelectedFile(fileId);
              setShowShareModal(true);
            }}
            type="my-files"
            viewMode="grid"
            hasMore={hasMoreFiles}
            onLoadMore={loadMoreFiles}
            isLoadingMore={loadingMoreFiles}
            onFileSelect={setSelectedDetailsFile}
          />
        )}
      </section>

      {/* Upload Modal */}
      {showUpload && (
        <MultiFileUpload onClose={() => setShowUpload(false)} />
      )}
      </div>
    </div>
  );
}
