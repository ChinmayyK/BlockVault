export type ChainOfCustodyEventType =
  | 'creation'
  | 'transformation'
  | 'signature'
  | 'analysis'
  | 'access'
  | 'sharing'
  | 'revocation'
  | 'notarization'
  | string;

export interface ChainOfCustodyEntry {
  id: string;
  documentId: string;
  documentName?: string;
  action: string;
  timestamp: string | number | Date;
  user?: string;
  owner?: string;
  actor?: string;
  type: ChainOfCustodyEventType;
  details?: string | Record<string, unknown>;
  hash?: string;
  parentHash?: string;
  originalDocumentId?: string;
  cid?: string;
  ipfs?: string;
  verified?: boolean;
  status?: string;
  [key: string]: unknown;
}

export interface BlockchainTransaction {
  id: string;
  tx_hash?: string;
  txHash?: string;
  tx_type?: string;
  txType?: string;
  status?: string;
  timestamp: string | number | Date;
  block_number?: number;
  blockNumber?: number;
  from?: string;
  to?: string;
  file_id?: string;
  fileId?: string;
  gas_used?: number;
  gasUsed?: number;
  network?: string;
  amount?: number | string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BlockchainStats {
  totalDocuments: number;
  totalTransactions: number;
  chainEntries: number;
  gasUsed: number;
  lastActivity: string;
}

export interface ContractStatus {
  contractAddress: string;
  network: string;
  paused: boolean;
  owner: string;
  version: string;
}

export interface VerifyDocumentResponse {
  verified: boolean;
  documentHash: string;
  owner?: string;
  timestamp?: string;
  status?: string;
  message?: string;
  [key: string]: unknown;
}





