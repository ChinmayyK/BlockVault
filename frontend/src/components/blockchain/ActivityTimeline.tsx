import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChainOfCustodyEntry } from '@/types/blockchain';
import {
  Brain,
  CheckCircle,
  FileSignature,
  FileText,
  Link2,
  Shield,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityTimelineProps {
  entries: ChainOfCustodyEntry[];
  loading?: boolean;
  emptyMessage?: string;
  onSelectEntry?: (entry: ChainOfCustodyEntry) => void;
}

const typeConfig: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
    badgeClass: string;
  }
> = {
  creation: {
    label: 'Document Notarized',
    icon: Shield,
    tone: 'text-emerald-300',
    badgeClass: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  },
  notarization: {
    label: 'Document Notarized',
    icon: Shield,
    tone: 'text-emerald-300',
    badgeClass: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  },
  transformation: {
    label: 'Document Transformed',
    icon: Link2,
    tone: 'text-sky-300',
    badgeClass: 'bg-sky-500/15 text-sky-200 border-sky-500/40',
  },
  signature: {
    label: 'Signature Event',
    icon: FileSignature,
    tone: 'text-amber-300',
    badgeClass: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  },
  analysis: {
    label: 'AI Analysis',
    icon: Brain,
    tone: 'text-purple-300',
    badgeClass: 'bg-purple-500/15 text-purple-200 border-purple-500/40',
  },
  access: {
    label: 'Access Event',
    icon: FileText,
    tone: 'text-blue-300',
    badgeClass: 'bg-blue-500/15 text-blue-200 border-blue-500/40',
  },
  revocation: {
    label: 'Access Revoked',
    icon: FileText,
    tone: 'text-rose-300',
    badgeClass: 'bg-rose-500/15 text-rose-200 border-rose-500/40',
  },
  sharing: {
    label: 'Sharing Event',
    icon: FileText,
    tone: 'text-cyan-300',
    badgeClass: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40',
  },
};

const defaultConfig = {
  label: 'Blockchain Event',
  icon: FileText,
  tone: 'text-primary-300',
  badgeClass: 'bg-primary-500/15 text-primary-200 border-primary-500/40',
};

const formatTimestamp = (timestamp: ChainOfCustodyEntry['timestamp']) => {
  if (!timestamp) return 'Unknown time';

  try {
    let date: Date | null = null;
    if (typeof timestamp === 'number') {
      const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
      date = new Date(ms);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        date = parsed;
      }
    }

    if (!date) return 'Unknown time';

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return 'Unknown time';
  }
};

const toDisplayString = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback || '[object]';
    }
  }

  return String(value);
};

const extractDetailSnippet = (details: ChainOfCustodyEntry['details']) => {
  if (!details) return null;

  if (typeof details === 'string') {
    return details.length > 160 ? `${details.slice(0, 160)}…` : details;
  }

  try {
    const json = JSON.stringify(details);
    return json.length > 160 ? `${json.slice(0, 160)}…` : json;
  } catch {
    return null;
  }
};

export function ActivityTimeline({ entries, loading, emptyMessage, onSelectEntry }: ActivityTimelineProps) {
  const timelineEntries = useMemo(() => entries ?? [], [entries]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={`timeline-skeleton-${index}`}
            className="border border-slate-800/60 bg-slate-900/60 p-4"
          >
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-full bg-slate-800/80" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-1/2 bg-slate-800/80" />
                <Skeleton className="h-3 w-3/4 bg-slate-800/80" />
                <Skeleton className="h-3 w-2/3 bg-slate-800/80" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!timelineEntries.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
        {emptyMessage ?? 'No blockchain activity recorded yet.'}
      </div>
    );
  }

  return (
    <div className="relative space-y-4">
      <div className="absolute left-6 top-0 h-full w-px bg-gradient-to-b from-transparent via-blue-500/20 to-transparent" />
      {timelineEntries.map((entry, index) => {
        const eventType =
          typeof entry.type === 'string' && entry.type.trim()
            ? entry.type.trim()
            : 'unknown';
        const config = typeConfig[eventType] ?? defaultConfig;
        const Icon = config.icon;
        const timestamp = formatTimestamp(entry.timestamp);
        const snippet = extractDetailSnippet(entry.details);
        const rawHash = entry.hash || entry.parentHash;
        const hash = rawHash ? toDisplayString(rawHash) : '';
        const documentName = toDisplayString(entry.documentName ?? (entry as unknown as { document?: unknown }).document, '');
        const documentId = toDisplayString(entry.documentId, '');
        const actor = toDisplayString(entry.user ?? (entry as unknown as { actor?: unknown }).actor, '');
        const parentDisplay = entry.parentHash ? toDisplayString(entry.parentHash) : '';
        const cidDisplay = entry.cid
          ? toDisplayString(entry.cid)
          : (entry as unknown as { ipfs?: unknown }).ipfs
            ? toDisplayString((entry as unknown as { ipfs?: unknown }).ipfs)
            : '';

        return (
          <Card
            key={String(entry.id ?? hash ?? documentId ?? index)}
            className="relative ml-8 border border-slate-800/60 bg-slate-950/70 p-4 shadow-[0_15px_45px_-25px_rgba(59,130,246,0.45)] hover:border-slate-700/80"
          >
            <span className="absolute left-[-54px] top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 shadow-[0_0_18px_rgba(59,130,246,0.45)]">
              <Icon className={cn('h-5 w-5', config.tone)} />
            </span>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-base font-semibold text-white">{entry.action}</h3>
                <Badge variant="outline" className={cn('text-xs uppercase tracking-wide', config.badgeClass)}>
                  {config.label}
                </Badge>
                {entry.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm">
                {documentName && (
                  <p className="font-medium text-slate-200">{documentName}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <div className="inline-flex items-center gap-1.5">
                    <Timer className="h-4 w-4 text-slate-500" />
                    <span>{timestamp}</span>
                  </div>
                  {actor && (
                    <div className="inline-flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <span className="font-mono text-[11px] truncate">{actor}</span>
                    </div>
                  )}
                  {hash && (
                    <div className="inline-flex items-center gap-1.5">
                      <Link2 className="h-4 w-4 text-slate-500" />
                      <span className="font-mono text-[11px] truncate">{hash}</span>
                    </div>
                  )}
                </div>
                {snippet && <p className="text-xs text-slate-400">{snippet}</p>}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  {documentId && <span>Doc: {documentId}</span>}
                  {parentDisplay && <span>Parent: {parentDisplay.slice(0, 10)}…</span>}
                  {cidDisplay && <span>CID: {cidDisplay.slice(0, 10)}…</span>}
                </div>
                {onSelectEntry && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-500/60 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20"
                    onClick={() => onSelectEntry(entry)}
                  >
                    Inspect Entry
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

