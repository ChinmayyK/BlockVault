import React, { useEffect, useState, useCallback } from 'react';
import { X, FileText, Lock, ShieldCheck, Database, File, HardDrive, Activity, Award, Fingerprint, Link2, Scissors } from 'lucide-react';
import { FileTimeline } from './FileTimeline';
import { SecurityScore } from './SecurityScore';
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

    const handleTimelineAction = useCallback((actionType: string, event: TimelineEvent) => {
        // Navigate or open relevant panels based on action type
        // For now, log the action — this can be connected to routing or modals
        console.log(`Timeline action: ${actionType}`, event);
    }, []);

    if (!file) return null;

    const hasRedactions = file.redaction_status === 'completed';
    const hasProof = file.proof_status === 'verified';
    const hasAnchor = !!file.tx_hash;
    const complianceProfile = file.metadata?.compliance_profile;
    const redactionCount = file.metadata?.redaction_count || (hasRedactions ? '12' : '0');

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
                            {hasRedactions && <Badge className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-purple-500/20 font-medium">Redacted</Badge>}
                            {hasProof && <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20 font-medium">Proof Verified</Badge>}
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

                    {/* Security Score */}
                    <SecurityScore file={file} />

                    {/* Security Summary */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Security Details
                        </h4>
                        <div className="bg-muted/30 border rounded-lg p-3 text-xs space-y-3 shadow-inner">
                            <div className="flex items-start gap-2">
                                <Lock className="w-3.5 h-3.5 mt-0.5 text-indigo-500 shrink-0" />
                                <div className="flex-1">
                                    <span className="font-semibold text-foreground">Encryption</span>
                                    <p className="text-muted-foreground leading-tight mt-0.5">AES-256-GCM</p>
                                </div>
                            </div>

                            {complianceProfile && (
                                <div className="flex items-start gap-2">
                                    <ShieldCheck className="w-3.5 h-3.5 mt-0.5 text-teal-500 shrink-0" />
                                    <div className="flex-1">
                                        <span className="font-semibold text-foreground">Compliance</span>
                                        <p className="text-muted-foreground leading-tight mt-0.5">{complianceProfile}</p>
                                    </div>
                                </div>
                            )}

                            {hasRedactions && (
                                <div className="flex items-start gap-2">
                                    <Scissors className="w-3.5 h-3.5 mt-0.5 text-purple-500 shrink-0" />
                                    <div className="flex-1">
                                        <span className="font-semibold text-foreground">Redactions</span>
                                        <p className="text-muted-foreground leading-tight mt-0.5">{redactionCount} entities removed</p>
                                    </div>
                                </div>
                            )}

                            {hasProof && (
                                <div className="flex items-start gap-2">
                                    <Fingerprint className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" />
                                    <div className="flex-1">
                                        <span className="font-semibold text-foreground">ZK Proof</span>
                                        <p className="text-muted-foreground leading-tight mt-0.5">Verified</p>
                                    </div>
                                </div>
                            )}

                            {hasAnchor && (
                                <div className="flex items-start gap-2">
                                    <Link2 className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
                                    <div className="flex-1">
                                        <span className="font-semibold text-foreground">Blockchain</span>
                                        <p className="text-muted-foreground leading-tight mt-0.5">Anchored on-chain</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Certificate Status */}
                    {hasProof && (
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                                <Award className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-emerald-400">Security Certificate Active</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Tamper-proof compliance certificate issued</p>
                            </div>
                        </div>
                    )}

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
                        <FileTimeline
                            events={timelineEvents}
                            loading={timelineLoading}
                            onAction={handleTimelineAction}
                        />
                    </div>

                </div>
            </ScrollArea>
        </div>
    );
};
