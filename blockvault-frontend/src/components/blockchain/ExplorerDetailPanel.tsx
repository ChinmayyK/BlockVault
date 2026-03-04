import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { ChainOfCustodyEntry, BlockchainTransaction } from '@/types/blockchain';
import { Clipboard, ExternalLink, Link2, TerminalSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type DetailItem = {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  copyValue?: string;
  link?: string;
  emphasize?: boolean;
};

const formatTimestamp = (timestamp: ChainOfCustodyEntry['timestamp'] | BlockchainTransaction['timestamp']) => {
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
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return 'Unknown';
  }
};

const truncateValue = (value: string, size = 12) => {
  if (!value) return value;
  if (value.length <= size) return value;
  return `${value.slice(0, Math.floor(size / 2))}…${value.slice(-Math.floor(size / 2))}`;
};

const explorerBaseUrls: Record<string, string> = {
  mainnet: 'https://etherscan.io',
  ethereum: 'https://etherscan.io',
  sepolia: 'https://sepolia.etherscan.io',
  goerli: 'https://goerli.etherscan.io',
  polygon: 'https://polygonscan.com',
  mumbai: 'https://mumbai.polygonscan.com',
  optimism: 'https://optimistic.etherscan.io',
  arbitrum: 'https://arbiscan.io',
};

interface ExplorerDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ChainOfCustodyEntry | BlockchainTransaction | null;
  kind: 'chain' | 'transaction';
  network?: string;
  explorerBaseUrl?: string;
}

export function ExplorerDetailPanel({
  open,
  onOpenChange,
  item,
  kind,
  network,
  explorerBaseUrl,
}: ExplorerDetailPanelProps) {
  const resolvedExplorerBaseUrl = useMemo(() => {
    if (explorerBaseUrl) {
      return explorerBaseUrl;
    }
    if (!network) {
      return undefined;
    }
    return explorerBaseUrls[network.toLowerCase()];
  }, [explorerBaseUrl, network]);

  const detailItems = useMemo<DetailItem[]>(() => {
    if (!item) return [];

    if (kind === 'chain') {
      const entry = item as ChainOfCustodyEntry;
      const safeString = (v: unknown) => (typeof v === 'string' ? v : v ? String(v) : null);
      const items: DetailItem[] = [
        { label: 'Action', value: safeString(entry.action), emphasize: true },
        { label: 'Document Name', value: safeString(entry.documentName) },
        { label: 'Document ID', value: safeString(entry.documentId), mono: true, copyValue: safeString(entry.documentId) || undefined },
        { label: 'Event Type', value: safeString(entry.type) },
        { label: 'Performed By', value: safeString(entry.user || entry.actor), mono: true },
        { label: 'Timestamp', value: formatTimestamp(entry.timestamp) },
      ];

      if (entry.status) {
        items.push({ label: 'Status', value: safeString(entry.status) });
      }

      if (entry.hash) {
        const hashStr = safeString(entry.hash);
        if (hashStr) {
          items.push({
            label: 'Document Hash',
            value: truncateValue(hashStr),
            mono: true,
            copyValue: hashStr,
          });
        }
      }

      if (entry.parentHash) {
        const parentHashStr = safeString(entry.parentHash);
        if (parentHashStr) {
          items.push({
            label: 'Parent Hash',
            value: truncateValue(parentHashStr),
            mono: true,
            copyValue: parentHashStr,
          });
        }
      }

      if (entry.cid) {
        const cidStr = safeString(entry.cid);
        if (cidStr) {
          items.push({
            label: 'IPFS CID',
            value: truncateValue(cidStr),
            mono: true,
            copyValue: cidStr,
            link: `https://ipfs.io/ipfs/${cidStr}`,
          });
        }
      }

      if (entry.details) {
        const detailText =
          typeof entry.details === 'string'
            ? entry.details
            : JSON.stringify(entry.details, null, 2);
        items.push({
          label: 'Details',
          value: detailText,
        });
      }

      return items;
    }

    const tx = item as BlockchainTransaction;
    const safeString = (v: unknown) => (typeof v === 'string' ? v : v ? String(v) : null);
    const rawTxHash = tx.txHash || tx.tx_hash;
    const txHash = safeString(rawTxHash);
    const link =
      resolvedExplorerBaseUrl && txHash && txHash.startsWith('0x')
        ? `${resolvedExplorerBaseUrl}/tx/${txHash}`
        : undefined;

    const items: DetailItem[] = [
      { label: 'Transaction Type', value: safeString(tx.txType || tx.tx_type) || 'Unknown', emphasize: true },
      { label: 'Status', value: safeString(tx.status) || 'Pending' },
      { label: 'Timestamp', value: formatTimestamp(tx.timestamp) },
    ];

    if (txHash) {
      items.push({
        label: 'Transaction Hash',
        value: truncateValue(txHash),
        mono: true,
        copyValue: txHash,
        link,
      });
    }

    if (tx.blockNumber ?? tx.block_number) {
      items.push({
        label: 'Block Number',
        value: String(tx.blockNumber ?? tx.block_number),
        mono: true,
      });
    }

    if (tx.from) {
      const fromStr = safeString(tx.from);
      if (fromStr) {
        items.push({
          label: 'From',
          value: truncateValue(fromStr),
          mono: true,
          copyValue: fromStr,
        });
      }
    }

    if (tx.to) {
      const toStr = safeString(tx.to);
      if (toStr) {
        items.push({
          label: 'To',
          value: truncateValue(toStr),
          mono: true,
          copyValue: toStr,
        });
      }
    }

    if (tx.fileId || tx.file_id) {
      const fileId = tx.fileId || tx.file_id;
      const fileIdStr = typeof fileId === 'string' ? fileId : String(fileId ?? '');
      if (fileIdStr) {
        items.push({
          label: 'Document ID',
          value: fileIdStr,
          mono: true,
          copyValue: fileIdStr,
        });
      }
    }

    if (tx.gasUsed || tx.gas_used) {
      const gas = tx.gasUsed ?? tx.gas_used;
      items.push({
        label: 'Gas Used',
        value: gas ? gas.toLocaleString() : undefined,
      });
    }

    if (tx.amount) {
      const amountStr = safeString(tx.amount);
      if (amountStr) {
        items.push({
          label: 'Amount',
          value: amountStr,
        });
      }
    }

    if (tx.network) {
      const networkStr = safeString(tx.network);
      if (networkStr) {
        items.push({
          label: 'Network',
          value: networkStr,
        });
      }
    }

    if (tx.metadata && typeof tx.metadata === 'object') {
      items.push({
        label: 'Metadata',
        value: JSON.stringify(tx.metadata, null, 2),
      });
    }

    return items;
  }, [item, kind, resolvedExplorerBaseUrl]);

  const title = kind === 'chain' ? 'Chain of Custody Entry' : 'Blockchain Transaction';
  const description =
    kind === 'chain'
      ? 'Complete provenance and blockchain evidence for the selected document event.'
      : 'Raw transaction data pulled from on-chain records for forensic analysis.';

  const renderDetailValue = (detail: DetailItem) => {
    if (!detail.value) {
      return <span className="text-slate-500">Unavailable</span>;
    }

    const content = (
      <span
        className={cn(
          'text-sm text-slate-200',
          detail.mono && 'font-mono',
          detail.emphasize && 'text-white font-semibold',
        )}
      >
        {detail.value}
      </span>
    );

    if (detail.link) {
      return (
        <a
          href={detail.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"
        >
          {content}
          <ExternalLink className="h-4 w-4" />
        </a>
      );
    }

    return content;
  };

  const handleCopy = (value?: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value).catch(() => {
      /* swallow */
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-l border-slate-800/70 bg-slate-950/90 p-0 shadow-[0_25px_80px_-25px_rgba(45,212,191,0.30)] sm:max-w-xl"
      >
        <SheetHeader className="border-b border-slate-800/70 bg-slate-900/70 px-6 py-5 text-left">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <TerminalSquare className="h-5 w-5 text-blue-300" />
            {title}
          </SheetTitle>
          <SheetDescription className="text-sm text-slate-400">{description}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)] px-6 py-6">
          {!item && (
            <Card className="border border-dashed border-slate-700/70 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
              Select a chain entry or transaction to inspect its provenance.
            </Card>
          )}

          {item && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant="outline"
                  className="border-blue-500/40 bg-blue-500/10 text-[11px] uppercase tracking-[0.24em] text-blue-200"
                >
                  {kind === 'chain' ? 'CHAIN ENTRY' : 'TRANSACTION'}
                </Badge>
                {'verified' in item && item.verified && (
                  <Badge className="bg-emerald-500/20 text-emerald-200">Verified</Badge>
                )}
              </div>

              <div className="space-y-4">
                {detailItems.map((detail) => (
                  <div key={detail.label} className="space-y-1 rounded-lg border border-slate-800/70 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        {detail.label}
                      </span>
                      {detail.copyValue && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-slate-400 hover:text-blue-200"
                          onClick={() => handleCopy(detail.copyValue)}
                        >
                          <Clipboard className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {renderDetailValue(detail)}
                  </div>
                ))}
              </div>

              {kind === 'transaction' && item && resolvedExplorerBaseUrl && (item.txHash || item.tx_hash) && (
                <Button
                  className="w-full border border-blue-500/40 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20"
                  variant="outline"
                  onClick={() => {
                    const txHash = (item as BlockchainTransaction).txHash || (item as BlockchainTransaction).tx_hash;
                    if (!txHash) return;
                    const url = `${resolvedExplorerBaseUrl}/tx/${txHash}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  View on Explorer
                </Button>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

