import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  ShieldCheck,
  Scissors,
  FileText,
  Fingerprint,
  Link2,
  HardDrive,
  Users,
  Activity,
  Download,
  Upload,
  Settings,
  AlertTriangle,
  Award
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { saasService } from '@/api/services/saas.service';
import type { AnalyticsSummary, StorageUsage, TeamActivity } from '@/types/saas';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [activity, setActivity] = useState<TeamActivity[]>([]);
  const [chartData, setChartData] = useState<{ date: string; documents: number }[]>([]);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        const [sum, stor, act, chart] = await Promise.all([
          saasService.getAnalyticsSummary(),
          saasService.getStorageUsage(),
          saasService.getTeamActivity(),
          saasService.getDailyChartData(),
        ]);

        if (mounted) {
          setSummary(sum);
          setStorage(stor);
          setActivity(act);
          setChartData(chart);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load analytics', err);
        if (mounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground animate-pulse text-sm">Loading organization analytics...</p>
        </div>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? 'Unlimited' : `${gb.toFixed(1)} GB`;
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'upload': return <Upload className="w-3.5 h-3.5 text-blue-500" />;
      case 'redact': return <Scissors className="w-3.5 h-3.5 text-purple-500" />;
      case 'proof': return <Fingerprint className="w-3.5 h-3.5 text-emerald-500" />;
      case 'certificate': return <Download className="w-3.5 h-3.5 text-amber-500" />;
      default: return <Activity className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const maxChartValue = Math.max(...chartData.map(d => d.documents), 1);

  return (
    <div className="max-w-[1400px] mx-auto py-8 px-4 sm:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Acme Legal</Badge>
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pro Plan</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            Usage Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time security operating metrics for your organization.
          </p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0">
          <Download className="w-4 h-4" /> Export Report
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex flex-col justify-between hover:border-primary/50 transition-colors bg-card/60 backdrop-blur shadow-sm">
          <div className="flex items-start justify-between text-muted-foreground mb-4">
            <h3 className="text-sm font-medium">Documents Protected</h3>
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{summary?.documentsProtected.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">+12% from last month</p>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between hover:border-purple-500/50 transition-colors bg-card/60 backdrop-blur shadow-sm">
          <div className="flex items-start justify-between text-muted-foreground mb-4">
            <h3 className="text-sm font-medium">Redactions Applied</h3>
            <Scissors className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{summary?.redactionsApplied.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 text-purple-400/80">Sensitive entities removed</p>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-colors bg-card/60 backdrop-blur shadow-sm">
          <div className="flex items-start justify-between text-muted-foreground mb-4">
            <h3 className="text-sm font-medium">Zero-Knowledge Proofs</h3>
            <Fingerprint className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{summary?.proofsGenerated.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 text-emerald-400/80">100% verification rate</p>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between hover:border-amber-500/50 transition-colors bg-card/60 backdrop-blur shadow-sm">
          <div className="flex items-start justify-between text-muted-foreground mb-4">
            <h3 className="text-sm font-medium">Blockchain Anchors</h3>
            <Link2 className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{summary?.blockchainAnchors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 text-amber-400/80">Ethereum & Polygon</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Chart & Compliance */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Chart Section */}
          <Card className="p-6 bg-card/60 backdrop-blur shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> Activity Trend
                </h3>
                <p className="text-sm text-muted-foreground">Documents processed over the last 7 days</p>
              </div>
            </div>

            {/* Custom SVG Bar Chart */}
            <div className="h-48 flex items-end justify-between gap-2 px-2 pb-2 border-b border-border/50 relative">
              {/* Y-axis lines (decorative) */}
              <div className="absolute inset-x-2 bottom-0 top-0 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="border-t border-dashed w-full" />
                <div className="border-t border-dashed w-full" />
                <div className="border-t border-dashed w-full" />
              </div>

              {chartData.map((d, i) => {
                const heightPct = (d.documents / maxChartValue) * 100;
                return (
                  <div key={i} className="flex flex-col items-center flex-1 gap-2 group z-10 cursor-crosshair">
                    <div 
                      className="w-full max-w-[40px] bg-primary/20 hover:bg-primary/40 transition-all rounded-t-sm relative group"
                      style={{ height: `${heightPct}%`, minHeight: '4px' }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                        {d.documents} docs
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{d.date}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Compliance & Storage Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Storage Usage */}
            <Card className="p-6 bg-card/60 shadow-sm border-border/60">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <HardDrive className="w-4 h-4 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-foreground">Storage Usage</h3>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-2xl font-bold text-foreground">{formatBytes(storage?.usedBytes || 0)}</span>
                    <span className="text-sm text-muted-foreground ml-1">used</span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">of {formatBytes(storage?.limitBytes || 0)}</span>
                </div>
                
                <div className="space-y-1.5">
                  <Progress value={storage ? (storage.usedBytes / storage.limitBytes) * 100 : 0} className="h-2.5 bg-muted" />
                  {storage && (storage.usedBytes / storage.limitBytes > 0.8) && (
                    <p className="text-xs text-amber-500 flex items-center gap-1 mt-2">
                      <AlertTriangle className="w-3 h-3" /> Approaching storage limit
                    </p>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Documents</span>
                    <span className="font-semibold">2.8 GB</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Proofs/Certs</span>
                    <span className="font-semibold">0.4 GB</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Compliance Profile */}
            <Card className="p-6 bg-card/60 shadow-sm border-border/60">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-foreground">Compliance Profile</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Active Profile</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">{summary?.activeComplianceProfile}</span>
                    <CheckBadge />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Certificate Issuance Rate</p>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-emerald-500">{summary?.certificateRate}%</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${summary?.certificateRate}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

          </div>
        </div>

        {/* Right Column: Team Activity Feed */}
        <div className="lg:col-span-1">
          <Card className="p-0 bg-card/60 backdrop-blur shadow-sm border-border/60 h-full flex flex-col">
            <div className="p-5 border-b border-border/50 flex items-center justify-between bg-muted/10">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Team Activity</h3>
              </div>
              <Badge variant="secondary" className="font-normal text-xs">Live</Badge>
            </div>
            
            <div className="flex-1 p-5 overflow-y-auto">
              <div className="relative space-y-6 pb-4">
                {/* Vertical timeline line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/60" />

                {activity.map((evt) => (
                  <div key={evt.id} className="relative pl-10 flex flex-col group">
                    {/* Icon Node */}
                    <div className="absolute left-0 top-0.5 w-[30px] h-[30px] rounded-full bg-background border shadow-sm flex items-center justify-center z-10 group-hover:border-primary/50 transition-colors">
                      {getIcon(evt.iconType)}
                    </div>
                    
                    {/* Content */}
                    <div className="mb-0.5">
                      <span className="font-semibold text-sm text-foreground">{evt.user_name || evt.user_address}</span>
                      <span className="text-muted-foreground text-sm ml-1.5">{evt.action}</span>
                    </div>
                    
                    <div className="text-xs font-medium text-muted-foreground/80 mb-1">
                      {evt.target}
                    </div>

                    <div className="text-[10px] text-muted-foreground/50 font-mono">
                      {new Date(evt.timestamp).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))}

              </div>
              
              <Button variant="ghost" className="w-full mt-4 text-xs text-muted-foreground">
                View Full Audit Log
              </Button>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}

function CheckBadge() {
  return (
    <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-emerald-500">
        <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}
