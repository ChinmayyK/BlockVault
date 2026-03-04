import apiClient from '../client';
import type {
  BlockchainStats,
  BlockchainTransaction,
  ChainOfCustodyEntry,
  ContractStatus,
  VerifyDocumentResponse,
} from '@/types/blockchain';
import { logger } from '@/utils/logger';
import { env } from '@/config/env';

const hasJwt = (): boolean => {
  try {
    const stored = localStorage.getItem(env.authStorageKey);
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return Boolean(parsed?.jwt);
  } catch (error) {
    logger.warn('Failed to read stored user for blockchain auth check', error);
    return false;
  }
};

const resolvedEmptyStats = (): BlockchainStats => ({
  totalDocuments: 0,
  totalTransactions: 0,
  chainEntries: 0,
  gasUsed: 0,
  lastActivity: new Date().toISOString(),
});

const resolvedEmptyContract = (): ContractStatus => ({
  contractAddress: '',
  network: '',
  paused: false,
  owner: '',
  version: '',
});

async function safeRequest<T>(request: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await request();
  } catch (error: any) {
    if (error?.response?.status === 401) {
      logger.debug('[blockchainService] skipping unauthorized response');
      return fallback;
    }
    if (!error?.response) {
      logger.error('Blockchain network error', error);
      return fallback;
    }
    throw error;
  }
}

export const blockchainService = {
  async getChainOfCustody(): Promise<ChainOfCustodyEntry[]> {
    if (!hasJwt()) {
      return [];
    }
    return safeRequest(
      async () => {
        const response = await apiClient.get<{ entries: ChainOfCustodyEntry[] }>('/blockchain/chain-of-custody', {
          skipAuthToast: true,
          skipAuthRedirect: true,
        });
        return response.data.entries;
      },
      [],
    );
  },

  async getDocumentChain(documentId: string): Promise<ChainOfCustodyEntry[]> {
    if (!hasJwt()) {
      return [];
    }
    return safeRequest(
      async () => {
        const response = await apiClient.get<{ entries: ChainOfCustodyEntry[] }>(
          `/blockchain/chain-of-custody/${encodeURIComponent(documentId)}`,
          {
            skipAuthToast: true,
            skipAuthRedirect: true,
          },
        );
        return response.data.entries;
      },
      [],
    );
  },

  async verifyDocument(documentHash: string): Promise<VerifyDocumentResponse> {
    const fallback: VerifyDocumentResponse = {
      found: false,
      match: false,
      documentId: null,
      documentName: null,
      transactions: [],
    };
    if (!hasJwt()) {
      return fallback;
    }
    return safeRequest(
      async () => {
        const response = await apiClient.get<VerifyDocumentResponse>(
          `/blockchain/verify/${encodeURIComponent(documentHash)}`,
          {
            skipAuthToast: true,
            skipAuthRedirect: true,
          },
        );
        return response.data;
      },
      fallback,
    );
  },

  async getTransactions(): Promise<BlockchainTransaction[]> {
    if (!hasJwt()) {
      return [];
    }
    return safeRequest(
      async () => {
        const response = await apiClient.get<{ transactions: BlockchainTransaction[] }>('/blockchain/transactions', {
          skipAuthToast: true,
          skipAuthRedirect: true,
        });
        return response.data.transactions;
      },
      [],
    );
  },

  async getContractStatus(): Promise<ContractStatus> {
    if (!hasJwt()) {
      return resolvedEmptyContract();
    }
    return safeRequest(
      async () => {
        const response = await apiClient.get<ContractStatus>('/blockchain/contract/status', {
          skipAuthToast: true,
          skipAuthRedirect: true,
        });
        return response.data;
      },
      resolvedEmptyContract(),
    );
  },

  async getStats(): Promise<BlockchainStats> {
    if (!hasJwt()) {
      return resolvedEmptyStats();
    }
    return safeRequest(
      async () => {
        const response = await apiClient.get<BlockchainStats>('/blockchain/stats', {
          skipAuthToast: true,
          skipAuthRedirect: true,
        });
        return response.data;
      },
      resolvedEmptyStats(),
    );
  },
};