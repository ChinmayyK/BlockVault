/**
 * Tests for contract helper utilities.
 *
 * Tests the pure helper functions and ContractService initialization.
 * Actual blockchain interactions are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock react-hot-toast before importing the module under test
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ethers to avoid pulling the full library in tests
vi.mock('ethers', () => ({
  ethers: {
    Contract: vi.fn().mockImplementation(() => ({
      paused: vi.fn(),
      getDocument: vi.fn(),
      getEscrowAmount: vi.fn(),
      hasPermission: vi.fn(),
      connect: vi.fn(),
    })),
    BrowserProvider: vi.fn(),
    formatEther: vi.fn((v: bigint) => v.toString()),
  },
}));

import { ContractService, formatDocHash } from '@/utils/contractHelpers';

// ---------------------------------------------------------------------------
// formatDocHash
// ---------------------------------------------------------------------------
describe('formatDocHash', () => {
  it('returns hash unchanged if already 0x-prefixed', () => {
    const hash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    expect(formatDocHash(hash)).toBe(hash);
  });

  it('adds 0x prefix to bare hex hash', () => {
    const hash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    expect(formatDocHash(hash)).toBe('0x' + hash);
  });

  it('handles empty string', () => {
    expect(formatDocHash('')).toBe('0x');
  });
});

// ---------------------------------------------------------------------------
// ContractService
// ---------------------------------------------------------------------------
describe('ContractService', () => {
  let service: ContractService;

  beforeEach(() => {
    service = new ContractService();
  });

  describe('uninitialized state', () => {
    it('isPaused returns false when not initialized', async () => {
      const result = await service.isPaused();
      expect(result).toBe(false);
    });

    it('getEscrowAmount returns 0 when not initialized', async () => {
      const result = await service.getEscrowAmount('0x1234');
      expect(result).toBe(BigInt(0));
    });

    it('hasPermission returns false when not initialized', async () => {
      const result = await service.hasPermission('0x1234', '0xabc');
      expect(result).toBe(false);
    });

    it('getDocument throws when not initialized', async () => {
      await expect(service.getDocument('0x1234')).rejects.toThrow(
        'Contract not initialized'
      );
    });

    it('revokeAccess throws when not initialized', async () => {
      await expect(
        service.revokeAccess('0x1234', '0xabc', {} as any)
      ).rejects.toThrow('Contract not initialized');
    });

    it('revokeDocument throws when not initialized', async () => {
      await expect(
        service.revokeDocument('0x1234', {} as any)
      ).rejects.toThrow('Contract not initialized');
    });

    it('cancelSignatureRequest throws when not initialized', async () => {
      await expect(
        service.cancelSignatureRequest('0x1234', {} as any)
      ).rejects.toThrow('Contract not initialized');
    });
  });

  describe('initialization', () => {
    it('returns true with valid mock provider', async () => {
      const mockProvider = {} as any;
      const result = await service.initialize('0x1234567890abcdef1234567890abcdef12345678', mockProvider);
      expect(result).toBe(true);
    });
  });
});
