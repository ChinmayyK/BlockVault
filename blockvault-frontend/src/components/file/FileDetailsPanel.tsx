import React, { useEffect, useState } from 'react';
import { X, FileText, Lock, ShieldCheck, Database, File, HardDrive, Activity } from 'lucide-react';
import { FileTimeline } from './FileTimeline';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fileService } from '@/api/services/file.service';
import type { TimelineEvent } from '@/types/timeline';

interface FileDetailsPanelProps {
    file: any | null;
    onClose: () => void;
}

const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FileDetailsPanel: React.FC<FileDetailsPanelProps> = ({ file, onClose }) => {
    const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);

    useEffect(() => {
        if (!file?.id) {
            setTimelineEvents([]);
            return;
        }

        let cancelled = false;
        setTimelineLoading(true);

        fileService
            .getFileActivity(file.id, file)
            .then((events) => {
                if (!cancelled) setTimelineEvents(events);
            })
            .catch(() => {
                if (!cancelled) setTimelineEvents([]);
            })
            .finally(() => {
                if (!cancelled) setTimelineLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [file?.id]);

    if (!file) return null;

    return (
        <div className="h-full flex flex-col bg-card border-l shadow-2xl animate-in slide-in-from-right-8 duration-300 w-80 sm:w-96 shrink-0 z-40 fixed md:relative right-0 top-0 bottom-0 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-muted/10">
                <h2 className="font-semibold flex items-center gap-2 text-foreground">
                    <FileText className="w-4 h-4" />
                    File Details
                </h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 rounded-full text-muted-foreground hover:bg-muted">
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1 p-5">
                <div className="space-y-6">
                    
                    {/* Basic Meta */}
                    <div className="space-y-3">
                        <h3 className="text-xl font-bold break-words leading-tight text-foreground">{file.name}</h3>
                        <div className="flex flex-wrap gap-2">
                            {file.encrypted && <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20 font-medium">Encrypted</Badge>}
                            {file.redaction_status === 'completed' && <Badge className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-purple-500/20 font-medium">Redacted</Badge>}
                            {file.proof_status === 'verified' && <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20 font-medium">Proof Verified</Badge>}
                        </div>
                        <div className="text-sm border rounded-lg p-3 space-y-2 bg-muted/5 shadow-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-1.5"><File className="w-3.5 h-3.5" /> Size:</span>
                                <span>{formatBytes(file.size)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> Type:</span>
                                <span>{file.mime_type || 'application/pdf'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Uploaded:</span>
                                <span>{new Date(file.upload_date).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Security Transparency */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Security Guarantees
                        </h4>
                        <div className="bg-muted/30 border rounded-lg p-3 text-xs space-y-3 shadow-inner">
                            <div className="flex items-start gap-2">
                                <Lock className="w-3.5 h-3.5 mt-0.5 text-indigo-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">Client-Side Encryption</span>
                                    <p className="text-muted-foreground leading-tight mt-0.5">AES-256-GCM encrypted locally in browser.</p>
                                </div>
                            </div>
                            {file.proof_status === 'verified' && (
                                <div className="flex items-start gap-2">
                                    <ShieldCheck className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" />
                                    <div>
                                        <span className="font-semibold text-foreground">Zero-Knowledge Proof</span>
                                        <p className="text-muted-foreground leading-tight mt-0.5">Cryptographic guarantee of accurate redaction.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Storage IDs */}
                    {(file.ipfs_cid || file.tx_hash) && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Identifiers</h4>
                            <div className="text-[10px] space-y-1.5 opacity-70">
                                {file.ipfs_cid && (
                                    <div className="flex flex-col">
                                        <span className="font-mono text-muted-foreground mb-0.5">IPFS CID</span>
                                        <span className="bg-muted p-1.5 rounded truncate font-mono text-foreground">{file.ipfs_cid}</span>
                                    </div>
                                )}
                                {file.tx_hash && (
                                    <div className="flex flex-col">
                                        <span className="font-mono text-muted-foreground mb-0.5">TX Hash</span>
                                        <span className="bg-muted p-1.5 rounded truncate font-mono text-foreground">{file.tx_hash}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Document Activity Timeline */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Activity className="w-4 h-4" /> Document Activity
                        </h4>
                        <FileTimeline events={timelineEvents} loading={timelineLoading} />
                    </div>

                </div>
            </ScrollArea>
        </div>
    );
};
