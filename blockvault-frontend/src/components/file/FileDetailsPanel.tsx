import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, FileText, Lock, ShieldCheck, Database, File, HardDrive, Activity, Award, Fingerprint, Link2, Scissors, Download, Eye, ExternalLink, Copy, Check } from 'lucide-react';
import { FileTimeline } from './FileTimeline';
import { SecurityScore } from './SecurityScore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fileService } from '@/api/services/file.service';
import { useAuth } from '@/contexts/AuthContext';
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

const formatDate = (dateStr: string) => {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

const CopyableId: React.FC<{ label: string; value: string }> = ({ label, value }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <div className="flex flex-col gap-1">
            <span className="font-mono text-muted-foreground text-[10px] uppercase tracking-wider">{label}</span>
            <div className="flex items-center gap-1.5 group">
                <span className="bg-muted p-1.5 rounded truncate font-mono text-[10px] text-foreground flex-1">{value}</span>
                <button
                    onClick={handleCopy}
                    className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    title="Copy"
                >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
            </div>
        </div>
    );
};

export const FileDetailsPanel: React.FC<FileDetailsPanelProps> = ({ file, onClose }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
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
        // TODO: Connect to routing or modals when implemented
    }, []);

    if (!file) return null;

    const hasRedactions = file.redaction_status === 'completed';
    const hasProof = file.proof_status === 'verified';
    const hasAnchor = !!file.tx_hash;
    const complianceProfile = file.metadata?.compliance_profile;
    const redactionCount = file.metadata?.redaction_count || (hasRedactions ? '12' : '0');
    const fileId = file.file_id || file.id || file._id;

    // Pipeline progress calculation
    const pipelineSteps = [
        { label: 'Encrypted', done: !!file.encrypted },
        { label: 'Scanned', done: hasRedactions || hasProof },
        { label: 'Redacted', done: hasRedactions },
        { label: 'Proof', done: hasProof },
        { label: 'Anchored', done: hasAnchor },
    ];
    const completedSteps = pipelineSteps.filter(s => s.done).length;
    const pipelinePercent = Math.round((completedSteps / pipelineSteps.length) * 100);

    return (
        <div className="h-full flex flex-col bg-transparent animate-in fade-in slide-in-from-right-8 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/10">
                <h2 className="font-semibold flex items-center gap-2 text-foreground text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    File Details
                </h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 rounded-full text-muted-foreground hover:bg-muted">
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-5 space-y-6">

                    {/* File Identity */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold break-words leading-tight text-foreground">{file.name || file.file_name || 'Untitled'}</h3>
                        <div className="flex flex-wrap gap-1.5">
                            {file.encrypted && <Badge className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/20 text-[10px] font-semibold"><Lock className="w-2.5 h-2.5 mr-1" />Encrypted</Badge>}
                            {hasRedactions && <Badge className="bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/20 text-[10px] font-semibold"><Scissors className="w-2.5 h-2.5 mr-1" />{redactionCount} Redacted</Badge>}
                            {hasProof && <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20 text-[10px] font-semibold"><Fingerprint className="w-2.5 h-2.5 mr-1" />Verified</Badge>}
                            {hasAnchor && <Badge className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20 text-[10px] font-semibold"><Link2 className="w-2.5 h-2.5 mr-1" />On-Chain</Badge>}
                        </div>
                    </div>

                    {/* File Metadata Card */}
                    <div className="border rounded-xl p-3.5 space-y-2.5 bg-muted/5 shadow-sm">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground flex items-center gap-1.5 text-xs"><File className="w-3.5 h-3.5" /> Size</span>
                            <span className="text-xs font-medium">{formatBytes(file.size || file.file_size)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground flex items-center gap-1.5 text-xs"><Database className="w-3.5 h-3.5" /> Format</span>
                            <span className="text-xs font-medium">{(file.mime_type || 'application/pdf').split('/').pop()?.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground flex items-center gap-1.5 text-xs"><HardDrive className="w-3.5 h-3.5" /> Uploaded</span>
                            <span className="text-xs font-medium">{formatDate(file.upload_date || file.created_at)}</span>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2.5">
                        <Button 
                            className="flex-1 text-xs h-9 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/30 transition-all shadow-sm"
                            onClick={() => navigate(user?.address === 'demo_user' ? `/demo/redact/${fileId}` : `/redact/${fileId}`)}
                        >
                            <Scissors className="w-3.5 h-3.5 mr-2" />
                            {hasRedactions ? 'View Redactions' : 'Redact'}
                        </Button>
                        <Button 
                            variant="secondary" 
                            className="flex-1 text-xs h-9 bg-muted/50 hover:bg-muted text-foreground border border-border/50 transition-all shadow-sm"
                            onClick={() => navigate(`/files/${fileId}`)}
                        >
                            <Eye className="w-3.5 h-3.5 mr-2" /> Preview
                        </Button>
                    </div>

                    {/* Security Score */}
                    <div className="pt-2">
                        <SecurityScore file={file} />
                    </div>

                    {/* Security Transparency Panel */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Security Transparency
                        </h4>
                        <div className="bg-muted/30 border rounded-lg divide-y divide-border/40 shadow-inner overflow-hidden">
                            {/* Encryption */}
                            <div className="flex items-start gap-3 p-3 transition-colors hover:bg-muted/20">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${file.encrypted ? 'bg-indigo-500/15' : 'bg-muted/40'}`}>
                                    <Lock className={`w-3.5 h-3.5 ${file.encrypted ? 'text-indigo-400' : 'text-muted-foreground/40'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-foreground">Encryption</span>
                                        {file.encrypted ? (
                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">✓ Active</span>
                                        ) : (
                                            <span className="inline-flex text-[9px] font-medium text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded-full">Pending</span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                        {file.encrypted ? 'AES-256-GCM protects at rest and in transit.' : 'Not yet encrypted.'}
                                    </p>
                                </div>
                            </div>

                            {/* Integrity Proof */}
                            <div className="flex items-start gap-3 p-3 transition-colors hover:bg-muted/20">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${hasProof ? 'bg-emerald-500/15' : 'bg-muted/40'}`}>
                                    <Fingerprint className={`w-3.5 h-3.5 ${hasProof ? 'text-emerald-400' : 'text-muted-foreground/40'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-foreground">Integrity Proof</span>
                                        {hasProof ? (
                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">✓ Verified</span>
                                        ) : (
                                            <span className="inline-flex text-[9px] font-medium text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded-full">Pending</span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                        {hasProof ? 'ZK proof confirms redactions are correct.' : 'Apply redactions to generate proof.'}
                                    </p>
                                </div>
                            </div>

                            {/* Blockchain Anchor */}
                            <div className="flex items-start gap-3 p-3 transition-colors hover:bg-muted/20">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${hasAnchor ? 'bg-amber-500/15' : 'bg-muted/40'}`}>
                                    <Link2 className={`w-3.5 h-3.5 ${hasAnchor ? 'text-amber-400' : 'text-muted-foreground/40'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-foreground">Blockchain</span>
                                        {hasAnchor ? (
                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">✓ Anchored</span>
                                        ) : (
                                            <span className="inline-flex text-[9px] font-medium text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded-full">Pending</span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                        {hasAnchor ? 'Hash recorded on Ethereum.' : 'Complete the pipeline to anchor.'}
                                    </p>
                                </div>
                            </div>

                            {/* Compliance */}
                            <div className="flex items-start gap-3 p-3 transition-colors hover:bg-muted/20">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${complianceProfile ? 'bg-teal-500/15' : 'bg-muted/40'}`}>
                                    <ShieldCheck className={`w-3.5 h-3.5 ${complianceProfile ? 'text-teal-400' : 'text-muted-foreground/40'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-foreground">Compliance</span>
                                        {complianceProfile ? (
                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">✓ {complianceProfile}</span>
                                        ) : (
                                            <span className="inline-flex text-[9px] font-medium text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded-full">None</span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                        {complianceProfile ? `${complianceProfile} actively enforced.` : 'No profile assigned.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Certificate Status */}
                    {hasProof && (
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20 animate-fade-up">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                                <Award className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-emerald-400">Security Certificate Active</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Tamper-proof compliance certificate issued</p>
                            </div>
                        </div>
                    )}

                    {/* Storage Identifiers */}
                    {(file.ipfs_cid || file.tx_hash) && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <ExternalLink className="w-3.5 h-3.5" /> Identifiers
                            </h4>
                            <div className="space-y-2">
                                {file.ipfs_cid && <CopyableId label="IPFS CID" value={file.ipfs_cid} />}
                                {file.tx_hash && <CopyableId label="TX Hash" value={file.tx_hash} />}
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
