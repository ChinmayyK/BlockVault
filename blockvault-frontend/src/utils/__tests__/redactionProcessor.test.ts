/**
 * Tests for redaction processor pure utility functions.
 *
 * Tests buildRedactionSummary, convertRedactionsToChunks,
 * validateRedactions, and createRedactedFile.
 *
 * The worker-based processDocumentRedactions is NOT tested here
 * because it depends on Vite's ?worker import syntax.
 */
import { describe, it, expect, vi } from 'vitest';
import type { RedactionMatch } from '@/utils/redactionPatterns';

// Mock the worker import BEFORE importing the module under test
vi.mock('@/workers/redactionWorker?worker', () => {
  return { default: vi.fn() };
});

vi.mock('@/utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Now import the module under test
const {
  buildRedactionSummary,
  convertRedactionsToChunks,
  validateRedactions,
  createRedactedFile,
} = await import('@/utils/redactionProcessor');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMatch(
  text: string,
  start: number,
  type: string = 'PII'
): RedactionMatch {
  return {
    text,
    start,
    end: start + text.length,
    type,
    replacement: `[${type} REDACTED]`,
    confidence: 0.95,
    normalizedKey: text.trim().toLowerCase(),
  };
}

// ---------------------------------------------------------------------------
// buildRedactionSummary
// ---------------------------------------------------------------------------
describe('buildRedactionSummary', () => {
  it('returns correct counts for multiple matches', () => {
    const text = 'Hello John Doe, your SSN is 123-45-6789. Contact John Doe at john@example.com';
    const matches: RedactionMatch[] = [
      makeMatch('John Doe', 6, 'PERSON'),
      makeMatch('123-45-6789', 27, 'SSN'),
      makeMatch('John Doe', 49, 'PERSON'),
      makeMatch('john@example.com', 61, 'EMAIL'),
    ];

    const summary = buildRedactionSummary(text, matches);

    expect(summary.totalMatches).toBe(4);
    expect(summary.uniqueMatches).toBe(3); // "John Doe" appears twice
    expect(summary.uniqueTypes).toBe(3); // PERSON, SSN, EMAIL
    expect(summary.previews.length).toBe(4);
    expect(summary.matchedTexts).toContain('John Doe');
    expect(summary.matchedTexts).toContain('123-45-6789');
    expect(summary.matchedTexts).toContain('john@example.com');
  });

  it('handles empty matches', () => {
    const summary = buildRedactionSummary('some text', []);

    expect(summary.totalMatches).toBe(0);
    expect(summary.uniqueMatches).toBe(0);
    expect(summary.uniqueTypes).toBe(0);
    expect(summary.previews).toEqual([]);
    expect(summary.matchedTexts).toEqual([]);
  });

  it('limits previews to 50 items', () => {
    const text = 'a'.repeat(10000);
    const matches: RedactionMatch[] = [];
    for (let i = 0; i < 60; i++) {
      matches.push(makeMatch('a', i, `TYPE_${i}`));
    }

    const summary = buildRedactionSummary(text, matches);

    expect(summary.totalMatches).toBe(60);
    expect(summary.previews.length).toBe(50);
  });

  it('generates context snippets around matches', () => {
    const text = 'The password for account X is secret123 and should be changed';
    const matches: RedactionMatch[] = [
      makeMatch('secret123', 29, 'PASSWORD'),
    ];

    const summary = buildRedactionSummary(text, matches);

    expect(summary.previews[0].context).toContain('secret123');
    expect(summary.previews[0].type).toBe('PASSWORD');
  });
});

// ---------------------------------------------------------------------------
// convertRedactionsToChunks
// ---------------------------------------------------------------------------
describe('convertRedactionsToChunks', () => {
  it('maps matches to chunk indices', () => {
    const text = 'a'.repeat(1024);
    const matches: RedactionMatch[] = [
      makeMatch('abc', 0, 'PII'),  // chunk 0
      makeMatch('def', 200, 'PII'),  // chunk 1 (128*1 = 128..255)
    ];

    const chunks = convertRedactionsToChunks(text, matches, 128);

    expect(chunks).toContain(0);
    expect(chunks).toContain(1);
  });

  it('handles matches spanning multiple chunks', () => {
    const text = 'a'.repeat(1024);
    // Match starts in chunk 0 (byte 120) and ends in chunk 1 (byte 140)
    const matches: RedactionMatch[] = [
      makeMatch('a'.repeat(20), 120, 'PII'),
    ];

    const chunks = convertRedactionsToChunks(text, matches, 128);

    expect(chunks).toContain(0);
    expect(chunks).toContain(1);
  });

  it('returns empty for no matches', () => {
    const chunks = convertRedactionsToChunks('hello', [], 128);
    expect(chunks).toEqual([]);
  });

  it('returns sorted unique chunk indices', () => {
    const text = 'a'.repeat(1024);
    const matches: RedactionMatch[] = [
      makeMatch('abc', 300, 'PII'),  // chunk 2
      makeMatch('xyz', 100, 'PII'),  // chunk 0
      makeMatch('def', 300, 'PII'),  // chunk 2 (duplicate)
    ];

    const chunks = convertRedactionsToChunks(text, matches, 128);

    // Should be sorted and deduplicated
    expect(chunks).toEqual([...new Set(chunks)].sort((a, b) => a - b));
  });
});

// ---------------------------------------------------------------------------
// validateRedactions
// ---------------------------------------------------------------------------
describe('validateRedactions', () => {
  it('returns valid for correct matches', () => {
    const text = 'Hello John Doe, welcome';
    const matches: RedactionMatch[] = [
      makeMatch('John Doe', 6, 'PERSON'),
    ];

    const result = validateRedactions(text, matches);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects out-of-bounds matches', () => {
    const text = 'Short';
    const matches: RedactionMatch[] = [
      makeMatch('Long text here', 0, 'PII'),
    ];

    const result = validateRedactions(text, matches);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects invalid range (start >= end)', () => {
    const text = 'Hello World';
    const matches: RedactionMatch[] = [
      { text: 'test', start: 5, end: 5, type: 'PII', replacement: '[REDACTED]', confidence: 1, normalizedKey: 'test' },
    ];

    const result = validateRedactions(text, matches);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('invalid range'));
  });

  it('detects text mismatch', () => {
    const text = 'Hello World';
    const matches: RedactionMatch[] = [
      makeMatch('Mismatch', 6, 'PII'),
    ];

    const result = validateRedactions(text, matches);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('text mismatch'));
  });

  it('returns valid for empty matches', () => {
    const result = validateRedactions('any text', []);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createRedactedFile
// ---------------------------------------------------------------------------
describe('createRedactedFile', () => {
  it('creates a text file with redacted content', async () => {
    const original = new File(['original content'], 'test.txt', { type: 'text/plain' });
    const file = await createRedactedFile(original, 'redacted content', 'test.txt', 'text');

    expect(file.name).toBe('Redacted_test.txt');
    expect(file.type).toBe('text/plain');
    expect(file.size).toBeGreaterThan(0);
  });

  it('creates a text file for pdf type (simplified)', async () => {
    const original = new File(['pdf bytes'], 'doc.pdf', { type: 'application/pdf' });
    const file = await createRedactedFile(original, 'text from pdf', 'doc.pdf', 'pdf');

    expect(file.name).toBe('Redacted_doc.pdf');
    expect(file.type).toBe('text/plain');
  });
});
