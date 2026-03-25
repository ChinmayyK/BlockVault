import React, { useState } from 'react';
import { FileText, ShieldAlert, CheckCircle2, XCircle, Search, Hash, Server, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/permissions';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { getApiBase } from '@/lib/getApiBase';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

async function sha256hex(str: string): Promise<string> {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminAudit() {
  const { user } = useAuth();
  const [verifyingHash, setVerifyingHash] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<Record<string, { valid: boolean, calculatedRoot: string }>>({});

  const { data: rootData } = useQuery({
    queryKey: ['auditRoot'],
    queryFn: async () => {
      const res = await apiClient.get('/audit/root');
      return res.data;
    },
    refetchInterval: 10000,
  });

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      const res = await apiClient.get('/audit/logs');
      return res.data;
    },
    refetchInterval: 10000,
  });

  const handleVerify = async (entryHash: string) => {
    try {
      setVerifyingHash(entryHash);
      const res = await apiClient.get(`/audit/proof/${entryHash}`);
      const { proof } = res.data;
      
      let currentHash = entryHash;
      for (const step of proof) {
        if (step.direction === 'left') {
           currentHash = await sha256hex(step.hash + currentHash);
        } else {
           currentHash = await sha256hex(currentHash + step.hash);
        }
      }

      setVerificationResult(prev => ({
        ...prev,
        [entryHash]: {
          valid: currentHash === rootData?.root,
          calculatedRoot: currentHash
        }
      }));
    } catch (err) {
      console.error("Proof verification failed", err);
      setVerificationResult(prev => ({
        ...prev,
        [entryHash]: { valid: false, calculatedRoot: 'error' }
      }));
    } finally {
      setVerifyingHash(null);
    }
  };

  if (!isAdmin(user?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view the immutable audit logs.</p>
      </div>
    );
  }

  const logs = logsData?.events || [];
  const systemRoot = rootData?.root || 'Calculating...';

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
          <Server className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">System Audit & Integrity</h1>
          <p className="text-muted-foreground">Immutable append-only Merkle tree logs</p>
        </div>
      </div>

      <Card variant="premium" className="p-6 bg-muted/30 border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Hash className="w-5 h-5 text-primary" />
               </div>
               <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Global Merkle Root</h3>
                  <div className="font-mono text-sm break-all font-bold text-foreground bg-background px-3 py-1.5 rounded border border-border">
                     {systemRoot}
                  </div>
               </div>
            </div>
            <div className="text-right shrink-0">
               <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Verified Logs</p>
               <p className="text-2xl font-bold tabular-nums">{logs.length}+</p>
            </div>
        </div>
      </Card>

      <Card variant="premium" className="overflow-hidden">
         <div className="border-b border-border/60 bg-muted/50 p-4 px-6 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
               <Activity className="w-4 h-4 text-primary" />
               Recent Security Events
            </div>
         </div>
         {isLoading ? (
             <div className="p-12 text-center text-muted-foreground animate-pulse">Synchronizing Merkle logs...</div>
         ) : (
            <div className="divide-y divide-border/60">
              {logs.map((log: any) => {
                 const result = verificationResult[log.entry_hash];
                 const isVerifying = verifyingHash === log.entry_hash;
                 
                 return (
                    <div key={log._id} className="p-5 hover:bg-muted/30 transition-colors flex flex-col md:flex-row gap-6 md:items-center justify-between">
                       <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                             <span className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-primary/10 text-primary border border-primary/20">
                               {log.action}
                             </span>
                             <span className="text-xs text-muted-foreground">
                               {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                             </span>
                             {log.leaf_index !== undefined && (
                               <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                 IDX:{log.leaf_index}
                               </span>
                             )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                             <div><span className="text-muted-foreground">User:</span> {log.user_id || 'System'}</div>
                             <div><span className="text-muted-foreground">IP:</span> {log.ip_address || 'Internal'}</div>
                             {log.target_id && <div className="col-span-2"><span className="text-muted-foreground">Target:</span> <span className="font-mono text-xs">{log.target_id}</span></div>}
                          </div>
                          
                          <div className="pt-2">
                             <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <Hash className="w-3 h-3" />
                                <span className="font-mono truncate max-w-[300px] md:max-w-md">{log.entry_hash}</span>
                             </div>
                          </div>
                       </div>
                       
                       <div className="shrink-0 flex flex-col items-end justify-center min-w-[140px]">
                          {result ? (
                             result.valid ? (
                                <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded border border-emerald-500/20">
                                   <CheckCircle2 className="w-4 h-4" />
                                   <span className="text-sm font-semibold">Integrity Verified</span>
                                </div>
                             ) : (
                                <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-1.5 rounded border border-destructive/20">
                                   <XCircle className="w-4 h-4" />
                                   <span className="text-sm font-semibold">Tampered</span>
                                </div>
                             )
                          ) : (
                             <Button 
                                variant="outline" 
                                size="sm"
                                disabled={isVerifying}
                                className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
                                onClick={() => handleVerify(log.entry_hash)}
                             >
                                {isVerifying ? (
                                  <><Activity className="w-3.5 h-3.5 animate-spin" /> Proving...</>
                                ) : (
                                  <><ShieldAlert className="w-3.5 h-3.5" /> Verify Proof</>
                                )}
                             </Button>
                          )}
                       </div>
                    </div>
                 );
              })}
              {logs.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">No audit logs recorded yet.</div>
              )}
            </div>
         )}
      </Card>
    </div>
  );
}
