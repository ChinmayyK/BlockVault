import React from 'react';
import { Upload, Lock, Eraser, Fingerprint, Network, FileKey, ShieldCheck, CheckCircle2, Clock, XCircle, FileSignature } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TimelineEvent {
    id: string;
    timestamp: Date;
    action: string;
    description?: string;
    actor?: string;
    status: 'success' | 'pending' | 'failed';
    type: 'upload' | 'encrypt' | 'redact' | 'proof' | 'anchor' | 'share';
}

interface FileTimelineProps {
    events: TimelineEvent[];
}

const getEventStyles = (type: string, status: string) => {
    if (status === 'failed') return { icon: <XCircle className="w-4 h-4 text-rose-500" />, bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
    
    switch (type) {
        case 'upload': return { icon: <Upload className="w-4 h-4" />, bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400' };
        case 'encrypt': return { icon: <Lock className="w-4 h-4" />, bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-400' };
        case 'redact': return { icon: <Eraser className="w-4 h-4" />, bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400' };
        case 'proof': return { icon: <Fingerprint className="w-4 h-4" />, bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' };
        case 'anchor': return { icon: <Network className="w-4 h-4" />, bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400' };
        case 'share': return { icon: <FileKey className="w-4 h-4" />, bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' };
        default: return { icon: <CheckCircle2 className="w-4 h-4" />, bg: 'bg-slate-500/15', border: 'border-slate-500/30', text: 'text-slate-400' };
    }
};

const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

export const FileTimeline: React.FC<FileTimelineProps> = ({ events }) => {
    if (!events || events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/5 rounded-xl border border-dashed border-border/60">
                <Clock className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No activity history.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Events will appear here as the file is processed.</p>
            </div>
        );
    }

    // Sort by timestamp descending
    const sortedEvents = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return (
        <div className="relative space-y-0 before:absolute before:inset-0 before:ml-[1.125rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border/50 before:to-transparent">
            {sortedEvents.map((event, index) => {
                const styles = getEventStyles(event.type, event.status);
                const isLatest = index === 0;

                return (
                    <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active pb-6 last:pb-0">
                        
                        {/* Event Icon/Dot */}
                        <div className={cn("flex items-center justify-center w-9 h-9 rounded-full border-2 bg-card shadow-sm shrink-0 z-10 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2", styles.border, isLatest ? 'ring-4 ring-background shadow-[0_0_15px_rgba(0,0,0,0.2)]' : '')}>
                            <div className={cn("w-full h-full rounded-full flex items-center justify-center", styles.bg, styles.text)}>
                                {styles.icon}
                            </div>
                        </div>

                        {/* Event Card */}
                        <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card/50 shadow-sm hover:shadow-md transition-all duration-300 hover:bg-muted/10">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-foreground leading-tight">{event.action}</span>
                                        <span className="text-[11px] font-medium text-muted-foreground mt-0.5 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatDate(event.timestamp)} at {formatTime(event.timestamp)}
                                        </span>
                                    </div>
                                    {event.status === 'failed' && (
                                        <Badge variant="destructive" className="h-5 text-[10px] px-1.5 rounded-sm shrink-0 shadow-sm leading-none">Failed</Badge>
                                    )}
                                    {event.status === 'pending' && (
                                        <Badge variant="secondary" className="h-5 text-[10px] px-1.5 rounded-sm shrink-0 shadow-sm font-semibold text-amber-500 bg-amber-500/10 border-amber-500/20 leading-none">Processing...</Badge>
                                    )}
                                </div>
                                
                                {event.description && (
                                    <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2" title={event.description}>
                                        {event.description}
                                    </p>
                                )}
                                
                                {event.actor && (
                                    <div className="flex justify-start mt-2 pt-2 border-t border-border/40">
                                        <div className="flex items-center gap-1.5 bg-muted/40 rounded px-2 py-1">
                                            <div className="w-3.5 h-3.5 rounded-full bg-primary/20 flex items-center justify-center">
                                                <ShieldCheck className="w-2.5 h-2.5 text-primary" />
                                            </div>
                                            <span className="text-[10px] text-foreground font-mono tracking-wider">
                                                {event.actor}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                );
            })}
        </div>
    );
};
