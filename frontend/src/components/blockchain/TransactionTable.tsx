import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BlockchainTransaction } from '@/types/blockchain';
import { ArrowDownUp, ArrowUp, ArrowDown, ExternalLink, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';
type SortKey = 'timestamp' | 'type' | 'status' | 'gas' | 'hash';

interface TransactionTableProps {
  transactions: BlockchainTransaction[];
  loading?: boolean;
  onSelectTransaction?: (tx: BlockchainTransaction) => void;
  emptyMessage?: string;
  explorerBaseUrl?: string;
}

const formatTimestamp = (timestamp: BlockchainTransaction['timestamp']) => {
  if (!timestamp) return 'Unknown';

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

    if (!date) return 'Unknown';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'Unknown';
  }
};

const truncateHash = (hash?: string | null, size = 10) => {
  if (!hash) return '—';
  const normalized = String(hash);
  if (!normalized) return '—';
  if (normalized.length <= size) return normalized;
  return `${normalized.slice(0, Math.floor(size / 2))}…${normalized.slice(-Math.floor(size / 2))}`;
};

const getTimestampValue = (timestamp: BlockchainTransaction['timestamp']) => {
  if (!timestamp) return 0;
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === 'number') return timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getNumeric = (value?: number | string | null) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const toDisplayString = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      if (!json || json === '{}') {
        return fallback || '[object]';
      }
      return json;
    } catch {
      return fallback || '[object]';
    }
  }
  return String(value);
};

const normalizeTxType = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed.toLowerCase() : 'unknown';
  }
  if (value == null) {
    return 'unknown';
  }
  try {
    const stringified = String(value).trim();
    if (!stringified || stringified === '[object Object]') {
      return 'unknown';
    }
    return stringified.toLowerCase();
  } catch {
    return 'unknown';
  }
};

const getTxType = (tx: BlockchainTransaction) => {
  if (typeof tx.txType === 'string' && tx.txType.trim()) {
    return tx.txType.trim().toLowerCase();
  }
  if (typeof tx.tx_type === 'string' && tx.tx_type.trim()) {
    return tx.tx_type.trim().toLowerCase();
  }
  return normalizeTxType(tx.txType ?? tx.tx_type);
};

export function TransactionTable({
  transactions,
  loading,
  onSelectTransaction,
  emptyMessage,
  explorerBaseUrl,
}: TransactionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedTransactions = useMemo(() => {
    const txs = [...(transactions ?? [])];

    txs.sort((a, b) => {
      if (sortKey === 'timestamp') {
        const diff = getTimestampValue(a.timestamp) - getTimestampValue(b.timestamp);
        return sortDirection === 'asc' ? diff : -diff;
      }
      if (sortKey === 'gas') {
        const diff = getNumeric(a.gasUsed ?? a.gas_used) - getNumeric(b.gasUsed ?? b.gas_used);
        return sortDirection === 'asc' ? diff : -diff;
      }
      if (sortKey === 'type') {
        const aType = getTxType(a).toLowerCase();
        const bType = getTxType(b).toLowerCase();
        const diff = aType.localeCompare(bType);
        return sortDirection === 'asc' ? diff : -diff;
      }
      if (sortKey === 'status') {
        const aStatus = (typeof a.status === 'string' ? a.status : '').toLowerCase();
        const bStatus = (typeof b.status === 'string' ? b.status : '').toLowerCase();
        const diff = aStatus.localeCompare(bStatus);
        return sortDirection === 'asc' ? diff : -diff;
      }
      if (sortKey === 'hash') {
        const aHash = (typeof (a.txHash ?? a.tx_hash) === 'string'
          ? (a.txHash ?? a.tx_hash)
          : ''
        ).toLowerCase();
        const bHash = (typeof (b.txHash ?? b.tx_hash) === 'string'
          ? (b.txHash ?? b.tx_hash)
          : ''
        ).toLowerCase();
        const diff = aHash.localeCompare(bHash);
        return sortDirection === 'asc' ? diff : -diff;
      }
      return 0;
    });

    return txs;
  }, [transactions, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowDownUp className="ml-1 h-3.5 w-3.5 text-slate-500" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 text-blue-300" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 text-blue-300" />
    );
  };

  if (loading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Timestamp</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Transaction</TableHead>
            <TableHead>Document</TableHead>
            <TableHead className="text-right">Gas</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={`tx-skeleton-${index}`}>
              <TableCell>
                <Skeleton className="h-3 w-24 bg-slate-800/70" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-20 bg-slate-800/70" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-28 bg-slate-800/70" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-24 bg-slate-800/70" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-3 w-16 bg-slate-800/70" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full bg-slate-800/70" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (!sortedTransactions.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
        {emptyMessage ?? 'No blockchain transactions have been recorded yet.'}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-slate-800/50">
          <TableHead className="w-[160px]">
            <button
              type="button"
              className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-400"
              onClick={() => toggleSort('timestamp')}
            >
              Timestamp
              {renderSortIcon('timestamp')}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-400"
              onClick={() => toggleSort('type')}
            >
              Type
              {renderSortIcon('type')}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-400"
              onClick={() => toggleSort('hash')}
            >
              Transaction
              {renderSortIcon('hash')}
            </button>
          </TableHead>
          <TableHead>
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Document
            </span>
          </TableHead>
          <TableHead className="text-right">
            <button
              type="button"
              className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-400"
              onClick={() => toggleSort('gas')}
            >
              Gas
              {renderSortIcon('gas')}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-400"
              onClick={() => toggleSort('status')}
            >
              Status
              {renderSortIcon('status')}
            </button>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedTransactions.map((tx, index) => {
          const rawHash = tx.txHash ?? tx.tx_hash;
          const txHash =
            typeof rawHash === 'string'
              ? rawHash
              : toDisplayString(rawHash, '');
          const docId = toDisplayString(tx.fileId ?? tx.file_id, '—');
          const txType = getTxType(tx);
          const txTypeLabel = txType
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
          const rawStatus =
            typeof tx.status === 'string' && tx.status.trim() ? tx.status.trim() : 'pending';
          const statusLower = rawStatus.toLowerCase();
          const statusLabel = rawStatus
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
          const gas = tx.gasUsed ?? tx.gas_used;
          const explorerLink =
            explorerBaseUrl && txHash && txHash.startsWith('0x')
              ? `${explorerBaseUrl}/tx/${txHash}`
              : undefined;

          return (
            <TableRow
              key={String(tx.id ?? txHash ?? docId ?? `${txType}-${getTimestampValue(tx.timestamp)}-${index}`)}
              className="cursor-pointer border-slate-800/40 bg-transparent transition hover:bg-blue-500/5"
              onClick={() => onSelectTransaction?.(tx)}
            >
              <TableCell className="font-mono text-xs text-slate-400">
                {formatTimestamp(tx.timestamp)}
              </TableCell>
              <TableCell className="text-sm font-medium text-slate-200">
                {txTypeLabel}
              </TableCell>
              <TableCell className="text-sm text-blue-300">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{truncateHash(txHash)}</span>
                  {explorerLink && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-blue-300 hover:text-blue-200"
                      onClick={(event) => {
                        event.stopPropagation();
                        window.open(explorerLink, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-xs text-slate-400">
                <div className="inline-flex items-center gap-1">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="font-mono text-[11px]">{truncateHash(docId, 12)}</span>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-slate-300">
                {gas ? gas.toLocaleString() : '—'}
              </TableCell>
              <TableCell>
                <Badge
                  className={cn(
                    'bg-slate-800/60 text-xs capitalize',
                    statusLower.includes('success') && 'bg-emerald-500/20 text-emerald-200',
                    statusLower.includes('fail') && 'bg-rose-500/20 text-rose-200',
                    statusLower.includes('pending') && 'bg-amber-500/20 text-amber-200',
                  )}
                >
                  {statusLabel}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

