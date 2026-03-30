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
import { FileUpload } from "@/components/file/FileUpload";
import { FileList } from "@/components/file/FileList";
import { FileDetailsPanel } from "@/components/file/FileDetailsPanel";
import { FilePreviewPanel } from "@/components/file/FilePreviewPanel";
import { FileListSkeleton } from "@/components/skeleton/FileListSkeleton";
import { useDebounce } from "@/hooks/useDebounce";

const LazyShareModal = lazy(() =>
  import("@/components/file/ShareModal").then((module) => ({ default: module.ShareModal }))
);

export default function FilesPage() {
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
      const fileName = file.name || file.file_name || 'Unknown File';
      return fileName.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
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

  const currentViewMode = selectedDetailsFile ? 'list' : viewMode;

  return (
    <div className={`h-[calc(100vh-6rem)] -mt-6 overflow-hidden animate-in fade-in duration-500 ${
      selectedDetailsFile 
        ? "grid grid-cols-[340px_minmax(0,1fr)_320px] gap-6" 
        : "flex -mx-6"
    }`}>
      {/* Explorer Pane */}
      <div
        className={
          selectedDetailsFile
            ? "hidden lg:flex flex-col overflow-y-auto pt-6 pb-12 space-y-4 custom-scrollbar relative"
            : "flex-1 overflow-y-auto px-6 pt-6 pb-12 space-y-6 custom-scrollbar relative"
        }
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
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 opacity-60 blur-lg transition-all duration-300 group-hover:opacity-90 group-hover:blur-xl" />
          <span className="absolute inset-0 rounded-full border border-blue-400/50 opacity-40 group-hover:opacity-60 transition" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-background border border-border shadow-[0_25px_45px_-20px_rgba(56,189,248,0.45)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_30px_60px_-18px_rgba(99,102,241,0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40">
            <Plus className="h-8 w-8 text-foreground transition-transform duration-300 group-hover:rotate-90" />
          </div>
          <span className="absolute right-full mr-4 rounded-full bg-card/95 border border-border shadow-xl px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Upload File
          </span>
        </button>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          {!selectedDetailsFile && <FolderOpen className="w-5 h-5 text-muted-foreground hidden sm:block" />}
          <h1 className="text-xl font-semibold">{selectedDetailsFile ? "Files" : "File Explorer"}</h1>
        </div>
        <div className="flex-1" />
        <div className="relative w-full max-w-xs sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground pointer-events-none">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
          Filter
        </Button>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={clearFilters}
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
        <div className="flex items-center gap-1 rounded-lg border border-border p-1 hidden sm:flex">
          <Button
            variant={currentViewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 px-3"
            disabled={!!selectedDetailsFile}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={currentViewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-8 px-3"
            disabled={!!selectedDetailsFile}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList>
          <TabsTrigger value="my-files" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            My Files
            <span className="ml-1 px-2 py-0.5 bg-muted rounded-full text-xs">{totalFiles}</span>
          </TabsTrigger>
          <TabsTrigger
            value="shared"
            className="gap-2"
            onMouseEnter={handleSharedTabHover}
            onFocus={handleSharedTabHover}
          >
            <Download className="h-4 w-4" />
            Shared with Me
            <span className="ml-1 px-2 py-0.5 bg-muted rounded-full text-xs">{totalSharedFiles}</span>
          </TabsTrigger>
          <TabsTrigger
            value="shares"
            className="gap-2"
            onMouseEnter={handleSharesTabHover}
            onFocus={handleSharesTabHover}
          >
            <Share2 className="h-4 w-4" />
            My Shares
            <span className="ml-1 px-2 py-0.5 bg-muted rounded-full text-xs">{totalShares}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-files" className="mt-4">
          {loading && !files?.length ? (
            <FileListSkeleton count={6} />
          ) : (
            <FileList
              files={sortedFiles}
              onShare={(fileId) => {
                setSelectedFile(fileId);
                setShowShareModal(true);
              }}
              type="my-files"
              viewMode={currentViewMode}
              hasMore={hasMoreFiles}
              onLoadMore={loadMoreFiles}
              isLoadingMore={loadingMoreFiles}
              onFileSelect={setSelectedDetailsFile}
            />
          )}
        </TabsContent>

        <TabsContent value="shared" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Shared with Me</h3>
                <p className="text-sm text-muted-foreground">Files that others have shared with you</p>
              </div>
              <Button
                onClick={handleRefreshSharedFiles}
                disabled={refreshingShared}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshingShared ? 'animate-spin' : ''}`} />
                {refreshingShared ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
            {loading && !sharedFiles?.length ? (
              <FileListSkeleton count={4} />
            ) : (
              <FileList
                files={filteredSharedFiles}
                type="shared"
                viewMode={currentViewMode}
                hasMore={hasMoreSharedFiles}
                onLoadMore={loadMoreSharedFiles}
                isLoadingMore={loadingMoreSharedFiles}
                onFileSelect={setSelectedDetailsFile}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="shares" className="mt-4">
          {loading && !outgoingShares?.length ? (
            <FileListSkeleton count={4} />
          ) : (
            <FileList
              shares={filteredOutgoingShares}
              type="shares"
              viewMode={currentViewMode}
              hasMore={hasMoreOutgoingShares}
              onLoadMore={loadMoreOutgoingShares}
              isLoadingMore={loadingMoreOutgoingShares}
              onFileSelect={setSelectedDetailsFile}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Modal */}
      {showUpload && (
        <FileUpload onClose={() => setShowUpload(false)} />
      )}

      {/* Share Modal */}
      {showShareModal && selectedFile && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70">Loading share modal…</div>}>
          <LazyShareModal
            fileId={selectedFile}
            onClose={() => {
              setShowShareModal(false);
              setSelectedFile(null);
            }}
          />
        </Suspense>
      )}
      </div>

      {/* Document Workspace (Preview & Inspector) */}
      {selectedDetailsFile && (
        <>
          {/* Document Preview Pane */}
          <div className="hidden md:flex flex-col min-w-0 relative bg-secondary/30 rounded-xl border border-border mt-6 mb-6 overflow-hidden">
            <FilePreviewPanel 
              file={selectedDetailsFile} 
              onClose={() => setSelectedDetailsFile(null)}
            />
          </div>

          {/* Inspector Panel */}
          <aside className="w-full h-full overflow-y-auto custom-scrollbar pt-6 pb-6">
            <FileDetailsPanel 
              file={selectedDetailsFile} 
              onClose={() => setSelectedDetailsFile(null)} 
            />
          </aside>
        </>
      )}
    </div>
  );
}
