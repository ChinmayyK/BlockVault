import React from 'react';
import {
  Upload,
  Lock,
  ShieldAlert,
  Search,
  ClipboardCheck,
  Scissors,
  Fingerprint,
  Link2,
  ShieldCheck,
  Award,
  Users,
  Download,
  Clock,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { TimelineEvent, TimelineEventType } from '@/types/timeline';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface FileTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Visual config per event type                                       */
/* ------------------------------------------------------------------ */

interface EventStyle {
  icon: React.ReactNode;
  bg: string;
  border: string;
  text: string;
  glow: string;
}

const EVENT_STYLES: Record<TimelineEventType, EventStyle> = {
  upload:       { icon: <Upload className="w-3.5 h-3.5" />,       bg: 'bg-blue-500/15',    border: 'border-blue-500/30',    text: 'text-blue-400',    glow: 'shadow-blue-500/20' },
  encrypt:      { icon: <Lock className="w-3.5 h-3.5" />,         bg: 'bg-indigo-500/15',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  glow: 'shadow-indigo-500/20' },
  scan:         { icon: <Search className="w-3.5 h-3.5" />,       bg: 'bg-cyan-500/15',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/20' },
  detect:       { icon: <ShieldAlert className="w-3.5 h-3.5" />,  bg: 'bg-orange-500/15',  border: 'border-orange-500/30',  text: 'text-orange-400',  glow: 'shadow-orange-500/20' },
  redact_review:{ icon: <ClipboardCheck className="w-3.5 h-3.5" />,bg: 'bg-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-400', glow: 'shadow-violet-500/20' },
  redact:       { icon: <Scissors className="w-3.5 h-3.5" />,     bg: 'bg-purple-500/15',  border: 'border-purple-500/30',  text: 'text-purple-400',  glow: 'shadow-purple-500/20' },
  proof:        { icon: <Fingerprint className="w-3.5 h-3.5" />,  bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  anchor:       { icon: <Link2 className="w-3.5 h-3.5" />,        bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-400',   glow: 'shadow-amber-500/20' },
  compliance:   { icon: <ShieldCheck className="w-3.5 h-3.5" />,  bg: 'bg-teal-500/15',    border: 'border-teal-500/30',    text: 'text-teal-400',    glow: 'shadow-teal-500/20' },
  certificate:  { icon: <Award className="w-3.5 h-3.5" />,        bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    text: 'text-rose-400',    glow: 'shadow-rose-500/20' },
  share:        { icon: <Users className="w-3.5 h-3.5" />,        bg: 'bg-sky-500/15',     border: 'border-sky-500/30',     text: 'text-sky-400',     glow: 'shadow-sky-500/20' },
  download:     { icon: <Download className="w-3.5 h-3.5" />,     bg: 'bg-lime-500/15',    border: 'border-lime-500/30',    text: 'text-lime-400',    glow: 'shadow-lime-500/20' },
};

const FAILED_STYLE: EventStyle = {
  icon: <XCircle className="w-3.5 h-3.5" />,
  bg: 'bg-rose-500/15',
  border: 'border-rose-500/40',
  text: 'text-rose-400',
  glow: 'shadow-rose-500/20',
};

const getStyle = (type: TimelineEventType, status: string): EventStyle => {
  if (status === 'failed') return FAILED_STYLE;
  return EVENT_STYLES[type] ?? EVENT_STYLES.upload;
};

/* ------------------------------------------------------------------ */
/*  Time formatting                                                    */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;

  if (diff < 0) return 'just now';

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

function exactTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso));
}

/* ------------------------------------------------------------------ */
/*  Skeleton Loader                                                    */
/* ------------------------------------------------------------------ */

const TimelineSkeleton: React.FC = () => (
  <div className="space-y-4" role="status" aria-label="Loading activity timeline">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-start gap-3">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <Skeleton className="h-3.5 w-3/4 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-2.5 w-1/3 rounded" />
        </div>
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */

const TimelineEmpty: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-10 text-center bg-muted/5 rounded-xl border border-dashed border-border/50">
    <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center mb-3">
      <Clock className="w-5 h-5 text-muted-foreground/40" />
    </div>
    <p className="text-sm text-muted-foreground font-medium">No additional activity yet.</p>
    <p className="text-xs text-muted-foreground/50 mt-1 max-w-[200px] leading-relaxed">
      Security events will appear here as the document is processed.
    </p>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Metadata Row                                                       */
/* ------------------------------------------------------------------ */

const MetadataRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const isHash = value.startsWith('0x') || value.length > 30;
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 bg-muted/30 rounded px-2 py-1 font-mono">
      <span className="text-muted-foreground/50 capitalize">{label}:</span>
      <span className={cn("text-foreground/80", isHash && "truncate max-w-[140px]")} title={value}>
        {isHash ? `${value.substring(0, 10)}...${value.substring(value.length - 6)}` : value}
      </span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export const FileTimeline: React.FC<FileTimelineProps> = ({ events, loading = false }) => {
  if (loading) return <TimelineSkeleton />;

  if (!events || events.length === 0) return <TimelineEmpty />;

  // Only upload event = show empty state
  if (events.length === 1 && events[0].type === 'upload') {
    return (
      <>
        <TimelineEventRow event={events[0]} index={0} isLast />
        <div className="mt-4">
          <p className="text-xs text-muted-foreground/60 text-center italic">
            This document has no additional activity yet.
          </p>
        </div>
      </>
    );
  }

  // Sort chronologically (oldest first = top-to-bottom flow)
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <TooltipProvider delayDuration={300}>
      <ol
        className="relative space-y-0"
        aria-label="Document activity timeline"
      >
        {/* Vertical connecting line */}
        <div
          className="absolute left-[15px] top-4 bottom-4 w-px"
          style={{
            background: 'linear-gradient(to bottom, hsl(var(--border)) 0%, hsl(var(--border) / 0.3) 100%)',
          }}
          aria-hidden="true"
        />

        {sorted.map((event, index) => (
          <TimelineEventRow
            key={event.id}
            event={event}
            index={index}
            isLast={index === sorted.length - 1}
          />
        ))}
      </ol>
    </TooltipProvider>
  );
};

/* ------------------------------------------------------------------ */
/*  Single Event Row                                                   */
/* ------------------------------------------------------------------ */

interface TimelineEventRowProps {
  event: TimelineEvent;
  index: number;
  isLast: boolean;
}

const TimelineEventRow: React.FC<TimelineEventRowProps> = ({ event, index, isLast }) => {
  const style = getStyle(event.type, event.status);
  const metaEntries = event.metadata ? Object.entries(event.metadata).filter(([, v]) => v) : [];

  return (
    <li
      className={cn(
        'relative flex items-start gap-3 group',
        !isLast && 'pb-5',
        'timeline-event-enter'
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Icon node */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full border shrink-0 z-10 transition-all duration-200',
              style.bg,
              style.border,
              style.text,
              'group-hover:shadow-md',
              `group-hover:${style.glow}`,
            )}
            aria-hidden="true"
          >
            {event.status === 'pending' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              style.icon
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {event.type.replace('_', ' ')}
        </TooltipContent>
      </Tooltip>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-semibold text-foreground leading-tight">
            {event.action}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {event.status === 'failed' && (
              <Badge variant="destructive" className="h-4 text-[9px] px-1.5 rounded-sm leading-none font-semibold">
                Failed
              </Badge>
            )}
            {event.status === 'pending' && (
              <Badge className="h-4 text-[9px] px-1.5 rounded-sm leading-none font-semibold text-amber-500 bg-amber-500/10 border-amber-500/20">
                Processing
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Metadata chips */}
        {metaEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {metaEntries.map(([key, value]) => (
              <MetadataRow key={key} label={key} value={value} />
            ))}
          </div>
        )}

        {/* Timestamp + Actor */}
        <div className="flex items-center gap-2 mt-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 cursor-default">
                <Clock className="w-2.5 h-2.5" />
                {relativeTime(event.timestamp)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-mono">
              {exactTime(event.timestamp)}
            </TooltipContent>
          </Tooltip>

          {event.actor && (
            <span className="text-[10px] text-muted-foreground/50 font-mono truncate max-w-[120px]" title={event.actor}>
              by {event.actor}
            </span>
          )}
        </div>
      </div>
    </li>
  );
};
