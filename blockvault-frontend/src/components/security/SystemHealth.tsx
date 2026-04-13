import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Shield, Database, Cloud, Link, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';

export const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const fetchHealth = async () => {
    try {
      const [hRes, sRes] = await Promise.all([
        apiClient.get('/health', { skipNetworkToast: true } as any),
        apiClient.get('/status', { skipNetworkToast: true } as any)
      ]);
      setHealth(hRes.data);
      setStatus(sRes.data);
      setLastCheck(new Date());
    } catch (err) {
      console.error('Failed to fetch system health', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return (
      <div className="flex items-center space-x-2 text-muted-foreground animate-pulse p-4">
        <Activity className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">Initializing Pulse...</span>
      </div>
    );
  }

  const isHealthy = health?.status === 'healthy';
  const isDegraded = health?.status === 'degraded';

  return (
    <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm space-y-4 shadow-sm overflow-hidden relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <motion.div
            animate={{ 
              scale: isHealthy ? [1, 1.2, 1] : 1,
              opacity: isHealthy ? [1, 0.8, 1] : 1
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 2, 
              ease: "easeInOut" 
            }}
            className={cn(
              "h-2.5 w-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]",
              isHealthy ? "bg-emerald-500 shadow-emerald-500/50" : 
              isDegraded ? "bg-amber-500 shadow-amber-500/50" : "bg-red-500 shadow-red-500/50"
            )}
          />
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            System Pulse
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground/60 font-mono">
          Last check: {lastCheck.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* MongoDB Status */}
        <StatusItem 
          icon={<Database className="h-3.5 w-3.5" />}
          label="Database"
          status={health?.checks?.mongodb?.status}
          latency={health?.checks?.mongodb?.latency_ms}
        />
        
        {/* IPFS Status */}
        <StatusItem 
          icon={<Cloud className="h-3.5 w-3.5" />}
          label="IPFS Node"
          status={status?.ipfs_available ? 'ok' : 'error'}
          subtitle={status?.mode === 'hybrid' || status?.mode === 'ipfs' ? 'Active' : 'Offline'}
        />

        {/* Ethereum Status */}
        <StatusItem 
          icon={<Link className="h-3.5 w-3.5" />}
          label="Blockchain"
          status={status?.anchoring_enabled ? 'ok' : 'warning'}
          subtitle={status?.anchoring_enabled ? 'Connected' : 'Read-only'}
        />

        {/* Security / Crypto */}
        <StatusItem 
          icon={<Shield className="h-3.5 w-3.5" />}
          label="Crypto Engine"
          status={health?.checks?.crypto_daemon?.status || 'ok'}
          latency={health?.checks?.crypto_daemon?.latency_ms}
        />
      </div>

      <AnimatePresence>
        {!isHealthy && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="pt-2"
          >
            <div className="flex items-start space-x-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Some services are currently degraded. Performance may be impacted.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface StatusItemProps {
  icon: React.ReactNode;
  label: string;
  status: 'ok' | 'error' | 'warning' | string;
  latency?: number;
  subtitle?: string;
}

const StatusItem: React.FC<StatusItemProps> = ({ icon, label, status, latency, subtitle }) => {
  const isOk = status === 'ok';
  const isError = status === 'error';
  const isWarning = status === 'warning';

  return (
    <div className="flex flex-col space-y-1.5 bg-background/40 p-2 rounded-lg border border-border/50">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground">
          {icon}
        </div>
        {isOk ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        ) : isError ? (
          <AlertTriangle className="h-3 w-3 text-red-500" />
        ) : (
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        )}
      </div>
      <div>
        <p className="text-[10px] font-medium text-foreground/80 leading-none mb-1">{label}</p>
        <p className="text-[9px] text-muted-foreground font-mono leading-none">
          {latency ? `${latency}ms` : subtitle || status}
        </p>
      </div>
    </div>
  );
};
