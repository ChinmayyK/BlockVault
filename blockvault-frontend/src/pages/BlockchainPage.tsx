import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link2,
  FileText,
  Pen,
  Brain,
  CheckCircle,
  ExternalLink,
  Search,
  Shield,
  Activity,
  TrendingUp,
  Hash,
  Server,
  Eye,
  ChevronRight,
  BarChart3,
  Copy,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlowingSeparator } from "@/components/ui/glowing-separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { blockchainService } from "@/api/services/blockchain.service";
import type {
  BlockchainStats,
  BlockchainTransaction,
  ChainOfCustodyEntry,
  ChainOfCustodyEventType,
  ContractStatus,
  VerifyDocumentResponse,
} from "@/types/blockchain";

const DEFAULT_STATS: BlockchainStats = {
  totalDocuments: 0,
  totalTransactions: 0,
  chainEntries: 0,
  gasUsed: 0,
  lastActivity: new Date(0).toISOString(),
};

const ACTIVITY_MONTH_COUNT = 6;

type NormalizedEntry = {
  id: string;
  raw: ChainOfCustodyEntry;
  action: string;
  documentLabel: string;
  actor: string;
  hash?: string;
  txHash?: string;
  ipfs?: string;
  timestampText: string;
  relativeTime: string;
  verified: boolean;
  status?: string;
  searchValue: string;
};

type NormalizedTransaction = {
  id: string;
  raw: BlockchainTransaction;
  hash: string | null;
  hashDisplay: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timestampText: string;
  relativeTime: string;
  status: string;
  searchValue: string;
};

function getChainIcon(type: ChainOfCustodyEventType | undefined) {
  switch (type) {
    case "creation":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
          <FileText className="h-5 w-5 text-success" />
        </div>
      );
    case "transformation":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/20">
          <Link2 className="h-5 w-5 text-info" />
        </div>
      );
    case "signature":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
          <Pen className="h-5 w-5 text-warning" />
        </div>
      );
    case "analysis":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/20">
          <Brain className="h-5 w-5 text-info" />
        </div>
      );
    default:
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/80">
          <FileText className="h-5 w-5" />
        </div>
      );
  }
}

function abbreviate(value: string | undefined | null, prefix = 6, suffix = 4) {
  if (!value) return "—";
  if (value.length <= prefix + suffix + 1) return value;
  return `${value.slice(0, prefix)}…${value.slice(-suffix)}`;
}

function toDate(value: string | number | Date | undefined) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function formatDateTime(value: string | number | Date | undefined) {
  const date = toDate(value);
  if (!date) return "Unknown";
  return date.toLocaleString();
}

function formatRelativeTime(value: string | number | Date | undefined) {
  const date = toDate(value);
  if (!date) return "Unknown";
  const diff = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const DIVISORS: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "seconds"],
    [60, "minutes"],
    [24, "hours"],
    [7, "days"],
    [4.34524, "weeks"],
    [12, "months"],
    [Number.POSITIVE_INFINITY, "years"],
  ];

  let duration = diff / 1000;
  for (const [amount, unit] of DIVISORS) {
    if (Math.abs(duration) < amount || unit === "years") {
      return rtf.format(Math.round(duration), unit);
    }
    duration /= amount;
  }
  return "Unknown";
}

function stringifyDetails(details: unknown) {
  if (details == null) return "";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch (_error) {
    return String(details);
  }
}

function formatNumber(value: number | undefined | null) {
  if (value == null) return "0";
  return value.toLocaleString();
}

function getExplorerBaseUrl(network: string | undefined) {
  if (!network) return "https://etherscan.io";
  const normalized = network.toLowerCase();
  if (normalized.includes("sepolia")) return "https://sepolia.etherscan.io";
  if (normalized.includes("goerli")) return "https://goerli.etherscan.io";
  if (normalized.includes("holesky")) return "https://holesky.etherscan.io";
  if (normalized.includes("polygon")) return "https://polygonscan.com";
  if (normalized.includes("arbitrum")) return "https://arbiscan.io";
  if (normalized.includes("optimism")) return "https://optimistic.etherscan.io";
  if (normalized.includes("linea")) return "https://lineascan.build";
  return "https://etherscan.io";
}

function getStatusStyles(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("fail")) {
    return "border-destructive/40 text-destructive";
  }
  if (normalized.includes("pending")) {
    return "border-warning/40 text-warning";
  }
  return "border-success/30 text-success";
}

export default function BlockchainPage() {
  const { isAuthenticated } = useAuth();

  const [stats, setStats] = useState<BlockchainStats | null>(null);
  const [contractStatus, setContractStatus] = useState<ContractStatus | null>(null);
  const [chainEntries, setChainEntries] = useState<ChainOfCustodyEntry[]>([]);
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [verificationResult, setVerificationResult] = useState<VerifyDocumentResponse | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      if (!isAuthenticated) {
        setStats(null);
        setContractStatus(null);
        setChainEntries([]);
        setTransactions([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [statsResponse, contractResponse, custodyEntries, txs] = await Promise.all([
          blockchainService.getStats(),
          blockchainService.getContractStatus(),
          blockchainService.getChainOfCustody(),
          blockchainService.getTransactions(),
        ]);

        if (isCancelled) return;

        setStats(statsResponse ?? DEFAULT_STATS);
        setContractStatus(contractResponse ?? null);
        setChainEntries(custodyEntries ?? []);
        setTransactions(txs ?? []);
      } catch (err) {
        if (isCancelled) return;
        console.error("Failed to load blockchain explorer data", err);
        setError(err instanceof Error ? err.message : "Failed to load blockchain data");
        setStats(null);
        setContractStatus(null);
        setChainEntries([]);
        setTransactions([]);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  const normalizedEntries = useMemo<NormalizedEntry[]>(
    () =>
      chainEntries.map((entry, index) => {
        const id = entry.id?.toString() || entry.documentId || `entry-${index}`;
        const action = entry.action || (typeof entry.type === "string" ? entry.type : "Event Recorded");
        const documentLabel = entry.documentName || entry.documentId || "Unnamed Document";
        const actor = entry.actor || entry.user || entry.owner || "";
        const hash = entry.hash ? String(entry.hash) : undefined;
        const txHash = typeof entry.txHash === "string" ? entry.txHash : undefined;
        const ipfs = entry.ipfs || (typeof entry.cid === "string" ? entry.cid : undefined);
        const detailsString = stringifyDetails(entry.details);
        const timestampText = formatDateTime(entry.timestamp);
        const relativeTime = formatRelativeTime(entry.timestamp);
        const status = entry.status ? String(entry.status) : undefined;
        const searchValue = [
          documentLabel,
          entry.documentId,
          action,
          actor,
          hash,
          txHash,
          ipfs,
          detailsString,
          status,
          entry.type,
        ]
          .filter(Boolean)
        .join(" ")
        .toLowerCase();

        return {
          id,
          raw: entry,
          action,
          documentLabel,
          actor,
          hash,
          txHash,
          ipfs,
          timestampText,
          relativeTime,
          verified: Boolean(entry.verified),
          status,
          searchValue,
        };
      }),
    [chainEntries],
  );

  const normalizedTransactions = useMemo<NormalizedTransaction[]>(
    () =>
      transactions.map((tx, index) => {
        const rawHash = tx.txHash ?? tx.tx_hash ?? tx.id ?? null;
        const id = rawHash || `tx-${index}`;
        const from = tx.from ?? "";
        const to = tx.to ?? "";
        const value = (() => {
          if (typeof tx.amount === "number") return tx.amount.toString();
          if (typeof tx.amount === "string") return tx.amount;
          if (tx.metadata && typeof (tx.metadata as Record<string, unknown>).amount === "string") {
            return String((tx.metadata as Record<string, unknown>).amount);
          }
          return "—";
        })();
        const blockNumber = tx.blockNumber ?? tx.block_number;
        const status = tx.status ?? tx.txType ?? tx.tx_type ?? "Recorded";
        const timestampText = formatDateTime(tx.timestamp);
        const relativeTime = formatRelativeTime(tx.timestamp);
        const searchValue = [
          rawHash,
          from,
          to,
          value,
          blockNumber,
          status,
          timestampText,
          relativeTime,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return {
          id,
          raw: tx,
          hash: rawHash,
          hashDisplay: rawHash ? rawHash : "—",
          from: from || "—",
          to: to || "—",
          value,
          blockNumber: blockNumber != null ? String(blockNumber) : "—",
          timestampText,
          relativeTime,
          status: String(status),
          searchValue,
        };
      }),
    [transactions],
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEntries = useMemo(
    () =>
      normalizedQuery
        ? normalizedEntries.filter((entry) => entry.searchValue.includes(normalizedQuery))
        : normalizedEntries,
    [normalizedEntries, normalizedQuery],
  );

  const filteredTransactions = useMemo(
    () =>
      normalizedQuery
        ? normalizedTransactions.filter((tx) => tx.searchValue.includes(normalizedQuery))
        : normalizedTransactions,
    [normalizedTransactions, normalizedQuery],
  );

  const selectedEntry = useMemo(
    () => (selectedEntryId ? normalizedEntries.find((entry) => entry.id === selectedEntryId) : undefined),
    [normalizedEntries, selectedEntryId],
  );

  const selectedTransaction = useMemo(
    () =>
      selectedTransactionId
        ? normalizedTransactions.find((tx) => tx.id === selectedTransactionId)
        : undefined,
    [normalizedTransactions, selectedTransactionId],
  );

  const statsCards = useMemo(() => {
    const totals = stats ?? DEFAULT_STATS;
    return [
      { label: "Total Documents", value: formatNumber(totals.totalDocuments), icon: FileText, color: "text-accent-blue" },
      { label: "Chain Events", value: formatNumber(totals.chainEntries), icon: Activity, color: "text-accent-cyan" },
      { label: "Transactions", value: formatNumber(totals.totalTransactions), icon: CheckCircle, color: "text-success" },
      { label: "Gas Used", value: totals.gasUsed ? formatNumber(totals.gasUsed) : "—", icon: Server, color: "text-warning" },
    ];
  }, [stats]);

  const explorerBaseUrl = useMemo(() => getExplorerBaseUrl(contractStatus?.network), [contractStatus?.network]);
  const contractExplorerPath = contractStatus?.contractAddress ? `/address/${contractStatus.contractAddress}` : null;
  const lastActivity = stats?.lastActivity ? formatDateTime(stats.lastActivity) : "—";

  const activityData = useMemo(() => {
    if (!normalizedEntries.length) return [] as Array<{ month: string; events: number }>;

    const buckets = new Map<number, { label: string; events: number }>();

    normalizedEntries.forEach((entry) => {
      const date = toDate(entry.raw.timestamp);
      if (!date) return;
      const bucketKey = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const label = date.toLocaleString(undefined, { month: "short", year: "numeric" });
      const current = buckets.get(bucketKey);
      if (current) {
        current.events += 1;
      } else {
        buckets.set(bucketKey, { label, events: 1 });
      }
    });

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(-ACTIVITY_MONTH_COUNT)
      .map(([, value]) => value);
  }, [normalizedEntries]);

  const actionDistribution = useMemo(() => {
    if (!normalizedEntries.length) return [] as Array<{ label: string; count: number; percent: number }>;

    const counts = new Map<string, number>();
    normalizedEntries.forEach((entry) => {
      const key = entry.raw.type || entry.action || "Other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
    if (!total) return [];

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count, percent: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [normalizedEntries]);

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setVerifying(true);
    setVerificationResult(null);

    try {
      const response = await blockchainService.verifyDocument(query);
      setVerificationResult(response);
    } catch (err) {
      console.error("Document verification failed", err);
    setVerificationResult({
        verified: false,
        documentHash: query,
        message: err instanceof Error ? err.message : "Unable to verify document",
      });
    } finally {
      setVerifying(false);
    }
  }, [searchQuery]);

  const handleOpenExplorer = useCallback(
    (path: string | null | undefined) => {
      if (!path || typeof window === "undefined") return;
      window.open(`${explorerBaseUrl}${path}`, "_blank", "noopener,noreferrer");
    },
    [explorerBaseUrl],
  );

  const handleCopy = useCallback((value: string | undefined | null) => {
    if (!value || typeof navigator === "undefined") return;
    navigator.clipboard?.writeText(value).catch(() => {});
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md border-accent-blue/30 bg-background/80 p-8 text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-accent-blue" />
              Connect Your Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Please sign in with your wallet to access the blockchain explorer.
          </CardContent>
        </Card>
      </div>
    );
  }

  const verificationSuccess = verificationResult?.verified ?? false;
  const verificationHeading = verificationSuccess ? "Document Verified" : "Document Not Found";
  const verificationIcon = verificationSuccess ? (
    <CheckCircle className="h-5 w-5 text-success" />
  ) : (
    <AlertTriangle className="h-5 w-5 text-destructive" />
  );
  const verificationClasses = verificationSuccess
    ? "border-success/30 bg-success/10 text-success"
    : "border-destructive/40 bg-destructive/10 text-destructive";

  const maxActivityEvents = activityData.reduce((max, item) => Math.max(max, item.events), 0) || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <div className="rounded-xl border border-accent-blue/30 bg-gradient-to-br from-accent-blue/20 to-accent-blue-glow/20 p-2">
              <Shield className="h-6 w-6 text-accent-blue" />
            </div>
            Blockchain Explorer
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete audit trail and blockchain verification for every legal workflow.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 transition-all hover:border-accent-blue/50"
          disabled={!contractExplorerPath}
          onClick={() => handleOpenExplorer(contractExplorerPath)}
        >
          <ExternalLink className="h-4 w-4" />
          {contractExplorerPath ? "View on Explorer" : "No Explorer Link"}
        </Button>
      </div>

      <GlowingSeparator />

      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-accent-blue/30 bg-accent-blue/5 px-4 py-3 text-sm text-accent-blue">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading blockchain data…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {statsCards.map((stat) => (
          <Card
            key={stat.label}
            className="group overflow-hidden border-accent-blue/20 transition-all duration-300 hover:border-accent-blue/40"
          >
            <CardContent className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-xl border border-accent-blue/20 bg-gradient-to-br from-accent-blue/10 to-accent-blue-glow/10 p-3 transition-transform group-hover:scale-110">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <Badge variant="outline" className="border-success/30 text-xs text-success">
                  Live
                </Badge>
              </div>
              <p className="mb-1 text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border-accent-blue/20">
        <CardHeader className="border-accent-blue/10 border-b bg-gradient-to-r from-accent-blue/5 to-accent-blue-glow/5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5 text-accent-blue" />
            Smart Contract Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Contract Address</p>
              <p className="font-mono text-sm font-semibold">
                {contractStatus?.contractAddress ? contractStatus.contractAddress : "—"}
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Network</p>
              <Badge variant="outline" className="border-accent-blue/30 text-accent-blue">
                {contractStatus?.network ?? "Unknown"}
              </Badge>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Status</p>
              <Badge
                variant="outline"
                className={contractStatus?.paused ? "border-warning/40 text-warning" : "border-success/30 text-success"}
              >
                <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-current" />
                {contractStatus?.paused ? "Paused" : "Active"}
              </Badge>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Owner</p>
              <p className="font-mono text-sm">{abbreviate(contractStatus?.owner) ?? "—"}</p>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Version</p>
              <p className="text-sm font-semibold">{contractStatus?.version ?? "—"}</p>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Last Activity</p>
              <p className="text-sm">{lastActivity}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-accent-blue/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-accent-blue" />
            Document Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter document hash, transaction hash, or IPFS CID to verify..."
              className="border-accent-blue/20 bg-background focus:border-accent-blue"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearch();
                }
              }}
            />
            <Button
              onClick={handleSearch}
              className="shrink-0"
              disabled={verifying || !searchQuery.trim()}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
              <Search className="mr-2 h-4 w-4" />
              Verify
                </>
              )}
            </Button>
          </div>

          {verificationResult && (
            <div className={`animate-in fade-in slide-in-from-top-2 duration-300 rounded-lg border p-4 ${verificationClasses}`}>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {verificationIcon}
                <span>{verificationHeading}</span>
              </div>
              <div className="space-y-1 text-sm text-foreground">
                <p>
                  <span className="text-muted-foreground">Document Hash:</span>{" "}
                  <span className="font-mono">{verificationResult.documentHash}</span>
                </p>
                {verificationResult.owner && (
                  <p>
                    <span className="text-muted-foreground">Owner:</span> {verificationResult.owner}
                  </p>
                )}
                {verificationResult.timestamp && (
                  <p>
                    <span className="text-muted-foreground">Timestamp:</span> {formatDateTime(verificationResult.timestamp)}
                  </p>
                )}
                {verificationResult.status && (
                  <p>
                    <span className="text-muted-foreground">Status:</span> {verificationResult.status}
                  </p>
                )}
                {verificationResult.message && (
                  <p className="text-muted-foreground">{verificationResult.message}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="custody" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
          <TabsTrigger value="custody" className="data-[state=active]:bg-accent-blue/20">
            <Activity className="mr-2 h-4 w-4" />
            Chain of Custody
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-accent-blue/20">
            <Hash className="mr-2 h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-accent-blue/20">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="custody" className="space-y-4">
          <Card className="border-accent-blue/20">
            <CardHeader className="bg-gradient-to-r from-card to-card/50">
              <CardTitle className="text-lg">Latest Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {filteredEntries.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No chain of custody events found.
                </div>
              ) : (
              <div className="space-y-4">
                  {filteredEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="group relative cursor-pointer rounded-lg border border-border/50 p-4 transition-all duration-200 hover:border-accent-blue/40"
                      onClick={() => setSelectedEntryId(entry.id)}
                  >
                      {index !== filteredEntries.length - 1 && (
                      <div className="absolute left-[30px] top-[60px] h-full w-0.5 bg-border/40" />
                    )}
                    <div className="flex gap-4">
                        {getChainIcon(entry.raw.type)}
                      <div className="flex-1">
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <h4 className="font-semibold transition-colors group-hover:text-accent-blue">{entry.action}</h4>
                              {entry.verified && <CheckCircle className="h-4 w-4 text-success" />}
                            </div>
                              <p className="text-sm text-muted-foreground">{entry.documentLabel}</p>
                          </div>
                            <div className="flex flex-col items-end gap-1 text-right">
                              <span className="whitespace-nowrap text-xs text-muted-foreground">{entry.timestampText}</span>
                              <span className="text-xs text-muted-foreground/80">{entry.relativeTime}</span>
                            <Button variant="ghost" size="sm" className="opacity-0 transition-opacity group-hover:opacity-100">
                              <Eye className="mr-1 h-3 w-3" />
                              Details
                            </Button>
                          </div>
                        </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {entry.actor && (
                              <Badge variant="outline" className="border-accent-blue/30">
                                Actor: {abbreviate(entry.actor)}
                          </Badge>
                            )}
                            {entry.hash && (
                              <Badge variant="outline" className="border-accent-blue/30">
                                Hash: {abbreviate(entry.hash)}
                          </Badge>
                            )}
                            {entry.txHash && (
                              <Badge variant="outline" className="border-accent-blue/30">
                                Tx: {abbreviate(entry.txHash)}
                              </Badge>
                            )}
                            {entry.ipfs && (
                              <Badge variant="outline" className="border-accent-blue/30">
                                IPFS: {abbreviate(entry.ipfs)}
                              </Badge>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card className="border-accent-blue/20">
            <CardHeader className="bg-gradient-to-r from-card to-card/50">
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTransactions.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No transactions found.
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction Hash</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Block</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow
                        key={tx.id}
                      className="cursor-pointer hover:bg-accent-blue/5"
                        onClick={() => setSelectedTransactionId(tx.id)}
                      >
                        <TableCell className="font-mono text-xs">{tx.hashDisplay}</TableCell>
                        <TableCell className="font-mono text-xs">{abbreviate(tx.from)}</TableCell>
                        <TableCell className="font-mono text-xs">{abbreviate(tx.to)}</TableCell>
                      <TableCell className="text-xs font-semibold">{tx.value}</TableCell>
                      <TableCell className="text-xs">{tx.blockNumber}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tx.relativeTime}</TableCell>
                      <TableCell>
                          <Badge variant="outline" className={`${getStatusStyles(tx.status)} text-xs`}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="border-accent-blue/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-accent-blue" />
                  Activity Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activityData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Activity data will appear once events are recorded.</p>
                ) : (
                <div className="space-y-4">
                  {activityData.map((data) => (
                    <div key={data.month}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{data.month}</span>
                        <span className="font-semibold">{data.events} events</span>
                      </div>
                        <Progress value={(data.events / maxActivityEvents) * 100} className="h-2" />
                    </div>
                  ))}
                </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-accent-blue/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-accent-blue" />
                  Action Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {actionDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
                ) : (
                <div className="space-y-4">
                    {actionDistribution.map((item) => (
                      <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{item.label}</span>
                          <span className="font-semibold">{item.percent}%</span>
                    </div>
                        <Progress value={item.percent} className="h-2" />
                  </div>
                    ))}
                    </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedEntry)} onOpenChange={() => setSelectedEntryId(null)}>
        <DialogContent className="max-w-2xl border-accent-blue/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent-blue" />
              Chain of Custody Details
            </DialogTitle>
            <DialogDescription>
              Complete history for {selectedEntry?.documentLabel ?? "the selected document"}
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Action Type</p>
                  <div className="flex items-center gap-2">
                    {getChainIcon(selectedEntry.raw.type)}
                    <p className="font-semibold capitalize">{selectedEntry.action}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                  <Badge variant="outline" className={`${getStatusStyles(selectedEntry.status ?? "Recorded")} text-xs`}>
                    {selectedEntry.status ?? (selectedEntry.verified ? "Verified" : "Recorded")}
                  </Badge>
                </div>
              </div>

              <GlowingSeparator />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Document ID</p>
                  <p className="font-mono text-sm rounded bg-muted/30 p-2">
                    {selectedEntry.raw.documentId ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Document Hash</p>
                  <p className="font-mono text-sm rounded bg-muted/30 p-2">{selectedEntry.hash ?? "—"}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Transaction Hash</p>
                  <p className="font-mono text-sm rounded bg-muted/30 p-2">{selectedEntry.txHash ?? "—"}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">IPFS CID</p>
                  <p className="font-mono text-sm rounded bg-muted/30 p-2">{selectedEntry.ipfs ?? "—"}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Actor</p>
                  <p className="font-mono text-sm rounded bg-muted/30 p-2">{selectedEntry.actor || "—"}</p>
                </div>
                  <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Timestamp</p>
                  <p className="rounded bg-muted/30 p-2 text-sm">{selectedEntry.timestampText}</p>
                </div>
                {selectedEntry.raw.parentHash && (
                  <div className="md:col-span-2">
                    <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Parent Hash</p>
                    <p className="font-mono text-sm rounded bg-muted/30 p-2">{selectedEntry.raw.parentHash}</p>
                  </div>
                )}
                <div className="md:col-span-2">
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Details</p>
                  <p className="rounded bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                    {stringifyDetails(selectedEntry.raw.details) || "No additional details provided."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 md:flex-row">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!selectedEntry.txHash}
                  onClick={() => handleOpenExplorer(selectedEntry.txHash ? `/tx/${selectedEntry.txHash}` : null)}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Transaction
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!selectedEntry.hash}
                  onClick={() => handleCopy(selectedEntry.hash)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Hash
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedTransaction)} onOpenChange={() => setSelectedTransactionId(null)}>
        <DialogContent className="max-w-2xl border-accent-blue/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-accent-blue" />
              Transaction Details
            </DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                  <Badge variant="outline" className={`${getStatusStyles(selectedTransaction.status)} text-xs`}>
                    {selectedTransaction.status}
                  </Badge>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Value</p>
                  <p className="text-lg font-semibold">{selectedTransaction.value}</p>
                </div>
              </div>

              <GlowingSeparator />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Transaction Hash</p>
                  <p className="font-mono text-sm rounded bg-muted/30 p-2">{selectedTransaction.hashDisplay}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Block Number</p>
                  <p className="font-mono text-sm rounded bg-muted/30 p-2">{selectedTransaction.blockNumber}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">From Address</p>
                  <p className="font-mono text-sm rounded bg-muted/30 p-2">{selectedTransaction.from}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">To Address</p>
                  <p className="font-mono text-sm rounded bg-muted/30 p-2">{selectedTransaction.to}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Timestamp</p>
                  <p className="rounded bg-muted/30 p-2 text-sm">{selectedTransaction.timestampText}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Relative Time</p>
                  <p className="rounded bg-muted/30 p-2 text-sm">{selectedTransaction.relativeTime}</p>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                disabled={!selectedTransaction.hash}
                onClick={() => handleOpenExplorer(selectedTransaction.hash ? `/tx/${selectedTransaction.hash}` : null)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Explorer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


