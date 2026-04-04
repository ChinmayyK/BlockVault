import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload, X, Lock, CheckCircle, AlertCircle, Loader2, FileText,
  Shield, Eye, EyeOff, ChevronDown, ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFiles } from '@/contexts/FileContext';
import { useVault } from '@/contexts/VaultContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { validatePassphrase } from '@/utils/passphrase';
import { RecoveryKeyModal } from '../security/RecoveryKeyModal';
import { LegalModalFrame } from '@/components/legal/modals/LegalModalFrame';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FileStage = 'queued' | 'encrypting' | 'uploading' | 'pinning' | 'done' | 'error';

interface QueuedFile {
  id: string;
  file: File;
  stage: FileStage;
  progress: number;
  stageLabel: string;
  error?: string;
}

interface MultiFileUploadProps {
  onClose: () => void;
  inline?: boolean;
}

const MAX_CONCURRENT = 3;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const fileIcon = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return '🖼️';
  if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) return '🎥';
  if (ext === 'pdf') return '📄';
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return '📦';
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return '📝';
  return '📁';
};

let _nextId = 0;
const genId = () => `mfu_${++_nextId}_${Date.now()}`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MultiFileUpload: React.FC<MultiFileUploadProps> = ({ onClose, inline = false }) => {
  const { uploadFile } = useFiles();
  const { isVaultUnlocked } = useVault();

  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [folder, setFolder] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [started, setStarted] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [recoveryKeys, setRecoveryKeys] = useState<string[]>([]);
  const [showRecovery, setShowRecovery] = useState(false);

  const activeCount = useRef(0);
  const passphraseRef = useRef<HTMLInputElement>(null);

  // ---- Queue helpers ----

  const updateItem = useCallback((id: string, patch: Partial<QueuedFile>) => {
    setQueue(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setQueue(prev => prev.filter(f => f.id !== id));
  }, []);

  // ---- Drop handler ----

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setGlobalError('');
      const newItems: QueuedFile[] = [];
      for (const f of acceptedFiles) {
        if (f.size > MAX_FILE_SIZE) {
          setGlobalError(`"${f.name}" exceeds 100 MB limit — skipped.`);
          continue;
        }
        newItems.push({
          id: genId(),
          file: f,
          stage: 'queued',
          progress: 0,
          stageLabel: 'Queued',
        });
      }
      setQueue(prev => [...prev, ...newItems]);
    },
    [],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    noClick: queue.length > 0 && started,
  });

  // ---- Upload pipeline ----

  const processOne = useCallback(
    async (item: QueuedFile) => {
      activeCount.current++;
      try {
        updateItem(item.id, { stage: 'encrypting', stageLabel: 'Encrypting…', progress: 5 });

        const response = await uploadFile(
          item.file as any,
          isVaultUnlocked ? undefined : passphrase,
          (progress: number, msg?: string) => {
            // Map sub-stages
            let stage: FileStage = 'encrypting';
            if (progress > 70) stage = 'pinning';
            else if (progress > 30) stage = 'uploading';
            updateItem(item.id, {
              stage,
              progress: Math.min(progress, 99),
              stageLabel: msg || (stage === 'pinning' ? 'IPFS pinning…' : stage === 'uploading' ? 'Uploading…' : 'Encrypting…'),
            });
          },
          undefined,
          folder || undefined,
        );

        updateItem(item.id, { stage: 'done', progress: 100, stageLabel: 'Complete' });

        if (response?.recovery_key) {
          setRecoveryKeys(prev => [...prev, response.recovery_key]);
        }
      } catch (err: any) {
        updateItem(item.id, {
          stage: 'error',
          progress: 0,
          stageLabel: 'Failed',
          error: err?.message || 'Upload failed',
        });
      } finally {
        activeCount.current--;
      }
    },
    [uploadFile, isVaultUnlocked, passphrase, folder, updateItem],
  );

  const startAllUploads = useCallback(async () => {
    if (!isVaultUnlocked) {
      const err = validatePassphrase(passphrase);
      if (err) {
        setGlobalError(err);
        return;
      }
    }
    if (queue.length === 0) {
      setGlobalError('Add at least one file.');
      return;
    }

    setStarted(true);
    setGlobalError('');

    // Drain the queue with concurrency limit
    const pending = [...queue];
    const run = async () => {
      while (pending.length > 0) {
        if (activeCount.current >= MAX_CONCURRENT) {
          await new Promise(r => setTimeout(r, 200));
          continue;
        }
        const next = pending.shift();
        if (next && next.stage === 'queued') {
          processOne(next); // fire-and-forget; concurrency controlled via activeCount
        }
      }
    };
    await run();
  }, [queue, passphrase, isVaultUnlocked, processOne]);

  // ---- Derived state ----

  const stats = useMemo(() => {
    const done = queue.filter(f => f.stage === 'done').length;
    const errors = queue.filter(f => f.stage === 'error').length;
    const total = queue.length;
    const inFlight = queue.filter(f => !['done', 'error', 'queued'].includes(f.stage)).length;
    const allDone = total > 0 && done + errors === total;
    return { done, errors, total, inFlight, allDone };
  }, [queue]);

  const canStart = queue.length > 0 && (isVaultUnlocked || passphrase) && !started;

  // ---- Stage color helper ----
  const stageColor = (s: FileStage) => {
    switch (s) {
      case 'done':
        return 'text-emerald-400';
      case 'error':
        return 'text-red-400';
      case 'encrypting':
        return 'text-amber-400';
      case 'uploading':
        return 'text-blue-400';
      case 'pinning':
        return 'text-purple-400';
      default:
        return 'text-zinc-500';
    }
  };

  // ---- Render ----

  const renderQueue = () => {
    const visible = showCompleted ? queue : queue.filter(f => f.stage !== 'done');
    if (visible.length === 0 && queue.length > 0) {
      return (
        <p className="text-xs text-zinc-500 text-center py-2">
          All {queue.length} files completed.{' '}
          <button className="underline text-indigo-400" onClick={() => setShowCompleted(true)}>
            Show
          </button>
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        <AnimatePresence>
          {visible.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60"
            >
              <span className="text-lg flex-shrink-0">{fileIcon(item.file.name)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 truncate font-medium" title={item.file.name}>
                  {item.file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-zinc-500">{formatFileSize(item.file.size)}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${stageColor(item.stage)}`}>
                    {item.stageLabel}
                  </span>
                </div>
                {item.stage !== 'queued' && item.stage !== 'done' && item.stage !== 'error' && (
                  <Progress
                    value={item.progress}
                    className="h-1 mt-1.5 bg-zinc-800"
                    indicatorClassName="bg-indigo-500 transition-all duration-300"
                  />
                )}
                {item.error && (
                  <p className="text-[10px] text-red-400 mt-1 truncate" title={item.error}>
                    {item.error}
                  </p>
                )}
              </div>

              {/* Status indicator / remove button */}
              {item.stage === 'done' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : item.stage === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              ) : item.stage === 'queued' ? (
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin flex-shrink-0" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  const footer = (
    <div className="flex w-full items-center gap-3">
      {!started && (
        <Button
          variant="ghost"
          onClick={onClose}
          className="flex-1 text-zinc-400 hover:text-white hover:bg-zinc-800 h-12 rounded-xl"
        >
          Cancel
        </Button>
      )}
      {!started ? (
        <Button
          onClick={startAllUploads}
          disabled={!canStart}
          className="flex-1 gap-2 h-12 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] shadow-lg transition-all"
        >
          <Lock className="w-4 h-4" />
          Encrypt &amp; Upload {queue.length > 0 ? `(${queue.length})` : ''} &rarr;
        </Button>
      ) : stats.allDone ? (
        <Button
          onClick={() => {
            if (recoveryKeys.length > 0) {
              setShowRecovery(true);
            } else {
              onClose();
            }
          }}
          className="flex-1 gap-2 h-12 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-500 hover:to-green-500 shadow-lg transition-all"
        >
          <CheckCircle className="w-4 h-4" />
          {stats.errors > 0
            ? `Done — ${stats.done} succeeded, ${stats.errors} failed`
            : `All ${stats.done} files uploaded`}
        </Button>
      ) : (
        <div className="flex-1 flex items-center justify-center gap-3 h-12 text-sm text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          Uploading {stats.done}/{stats.total}…
        </div>
      )}
    </div>
  );

  return (
    <>
      <LegalModalFrame
        icon={<Lock className="h-5 w-5" />}
        title="Upload Secure Files"
        subtitle="Drag multiple files — each encrypted separately"
        onClose={onClose}
        footer={footer}
        headerAccent="blue"
        widthClassName="max-w-[520px]"
        inline={inline}
      >
        <div className="flex flex-col gap-4 pt-2 pb-1 min-h-[380px]">
          {/* Error banner */}
          <AnimatePresence>
            {globalError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-400">{globalError}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Drop zone — always visible before start */}
          {!started && (
            <div
              {...getRootProps()}
              className={`relative rounded-2xl border-2 border-dashed p-8 transition-all duration-300 cursor-pointer group ${
                isDragActive
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-[1.01]'
                  : 'border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900/50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center text-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all mb-3 ${
                    isDragActive
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                      : 'bg-zinc-800/80 text-zinc-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-400'
                  }`}
                >
                  <Upload className={`w-5 h-5 ${isDragActive ? 'animate-bounce' : ''}`} />
                </div>
                <p className="text-sm font-semibold text-zinc-200 mb-0.5">
                  Drop files here or click to browse
                </p>
                <p className="text-xs text-zinc-500">
                  Multiple files supported · Up to 100 MB each
                </p>
              </div>
            </div>
          )}

          {/* Queue */}
          {queue.length > 0 && (
            <>
              {stats.done > 0 && started && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-zinc-500">
                    {stats.done}/{stats.total} completed
                  </span>
                  <button
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    onClick={() => setShowCompleted(prev => !prev)}
                  >
                    {showCompleted ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showCompleted ? 'Hide completed' : 'Show completed'}
                  </button>
                </div>
              )}
              {renderQueue()}
            </>
          )}

          {/* Passphrase / Folder inputs — before start */}
          {!started && queue.length > 0 && (
            <div className="flex flex-col gap-4 mt-1">
              {isVaultUnlocked ? (
                <div className="flex items-center p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                  <Shield className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-300">Vault Key active</p>
                    <p className="text-xs text-emerald-500/80">All files will be encrypted with your master key.</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-emerald-500/60 ml-auto shrink-0" />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mfu-pass" className="text-sm font-medium text-zinc-200">
                    Passphrase <span className="text-red-400">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      ref={passphraseRef}
                      id="mfu-pass"
                      type={showPassphrase ? 'text' : 'password'}
                      placeholder="Create a strong passphrase"
                      value={passphrase}
                      onChange={e => setPassphrase(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && canStart) {
                          e.preventDefault();
                          startAllUploads();
                        }
                      }}
                      className="bg-zinc-900/50 border-zinc-800 text-sm pr-10 focus-visible:ring-indigo-500 h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mfu-folder" className="text-sm font-medium text-zinc-200">
                  Folder <span className="text-zinc-500 text-xs font-normal">(optional)</span>
                </Label>
                <Input
                  id="mfu-folder"
                  type="text"
                  placeholder="Organize in a folder"
                  value={folder}
                  onChange={e => setFolder(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-800 text-sm focus-visible:ring-indigo-500 h-11"
                />
              </div>
            </div>
          )}
        </div>
      </LegalModalFrame>

      {/* Recovery key modal for the first key (chain if multiple) */}
      {showRecovery && recoveryKeys.length > 0 && (
        <RecoveryKeyModal
          recoveryKey={recoveryKeys[0]}
          onClose={() => {
            setRecoveryKeys(prev => prev.slice(1));
            if (recoveryKeys.length <= 1) {
              setShowRecovery(false);
              onClose();
            }
          }}
        />
      )}
    </>
  );
};
