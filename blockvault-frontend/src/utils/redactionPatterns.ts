/**
 * Redaction Patterns Library
 * Defines regex patterns and functions for identifying and redacting PII.
 * Includes entity normalization, confidence filtering, and overlap merging.
 */

export interface RedactionPattern {
  id: string;
  name: string;
  regex: RegExp;
  replacement: string;
  description: string;
  /** Confidence score for regex-based detections (0.0 – 1.0) */
  confidence: number;
}

export interface RedactionMatch {
  text: string;
  start: number;
  end: number;
  type: string;
  replacement: string;
  /** Confidence score (0.0 – 1.0). Regex patterns have fixed confidence. NLP may vary. */
  confidence: number;
  /** Normalized key for entity grouping (lowercase, trimmed) */
  normalizedKey: string;
}

// Common PII patterns
export const REDACTION_PATTERNS: Record<string, RedactionPattern> = {
  SSN: {
    id: 'ssn',
    name: 'Social Security Number',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN REDACTED]',
    description: 'Matches US SSN in format: XXX-XX-XXXX',
    confidence: 0.95,
  },
  AADHAAR: {
    id: 'aadhaar',
    name: 'Aadhaar Number',
    regex: /\b\d{4}[\s-]\d{4}[\s-]\d{4}\b/g,
    replacement: '[AADHAAR REDACTED]',
    description: 'Matches Aadhaar in format: XXXX-XXXX-XXXX or XXXX XXXX XXXX',
    confidence: 0.90,
  },
  PAN: {
    id: 'pan',
    name: 'PAN Card Number',
    regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    replacement: '[PAN REDACTED]',
    description: 'Matches PAN format: 5 letters, 4 digits, 1 letter',
    confidence: 0.92,
  },
  CREDIT_CARD: {
    id: 'credit_card',
    name: 'Credit Card Number',
    regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '[CREDIT CARD REDACTED]',
    description: 'Matches 16-digit credit card numbers',
    confidence: 0.88,
  },
  EMAIL: {
    id: 'email',
    name: 'Email Address',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL REDACTED]',
    description: 'Matches email addresses',
    confidence: 0.95,
  },
  PHONE: {
    id: 'phone',
    name: 'Phone Number',
    regex: /\b(\+91[\s-]?)?[6-9]\d{9}\b|\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    replacement: '[PHONE REDACTED]',
    description: 'Matches Indian (+91) and international phone numbers',
    confidence: 0.85,
  },
  DOB: {
    id: 'dob',
    name: 'Date of Birth',
    regex: /\b(0?[1-9]|[12]\d|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](\d{2}|\d{4})\b|\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/g,
    replacement: '[DOB REDACTED]',
    description: 'Matches dates in DD/MM/YYYY or MM/DD/YYYY format',
    confidence: 0.70,
  },
  BANK_ACCOUNT: {
    id: 'bank_account',
    name: 'Bank Account Number',
    regex: /(?:Account|A\/C|Account #|Account Number|Account No\.?)[:\s#]+\d{9,18}\b/gi,
    replacement: '[BANK ACCOUNT REDACTED]',
    description: 'Matches Indian bank account numbers with label',
    confidence: 0.90,
  },
  IFSC: {
    id: 'ifsc',
    name: 'IFSC Code',
    regex: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    replacement: '[IFSC REDACTED]',
    description: 'Matches Indian IFSC codes',
    confidence: 0.88,
  },
  PASSPORT: {
    id: 'passport',
    name: 'Passport Number',
    regex: /\b[A-Z]\d{7}\b|\b[A-Z]{1,2}\d{6,9}\b/g,
    replacement: '[PASSPORT REDACTED]',
    description: 'Matches Indian passport numbers',
    confidence: 0.80,
  },
  DRIVING_LICENSE: {
    id: 'driving_license',
    name: 'Driving License',
    regex: /\b[A-Z]{2}[\s-]?\d{2}[\s-]?\d{4}[\s-]?\d{7}\b|\b[A-Z]{2}\d{13}\b/g,
    replacement: '[DL REDACTED]',
    description: 'Matches Indian driving license numbers',
    confidence: 0.85,
  },
};

// ---------------------------------------------------------------------------
// Entity Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize an entity string for case-insensitive deduplication.
 * "John Smith", "john smith", "JOHN SMITH" → "john smith"
 */
export function normalizeEntity(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Pattern Matching
// ---------------------------------------------------------------------------

/**
 * Find all matches for a pattern in text
 */
export function findPatternMatches(
  text: string,
  pattern: RedactionPattern
): RedactionMatch[] {
  const matches: RedactionMatch[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex
  pattern.regex.lastIndex = 0;

  while ((match = pattern.regex.exec(text)) !== null) {
    matches.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      type: pattern.id,
      replacement: pattern.replacement,
      confidence: pattern.confidence,
      normalizedKey: normalizeEntity(match[0]),
    });
  }

  return matches;
}

/**
 * Find all text search matches (case-sensitive or insensitive)
 */
export function findTextMatches(
  text: string,
  searchTerm: string,
  caseSensitive: boolean = false,
  replacement: string = '[REDACTED]'
): RedactionMatch[] {
  const matches: RedactionMatch[] = [];

  if (!searchTerm) return matches;

  const flags = caseSensitive ? 'g' : 'gi';
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedTerm, flags);

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      type: 'custom',
      replacement: replacement,
      confidence: 1.0, // explicit user search = full confidence
      normalizedKey: normalizeEntity(match[0]),
    });
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Overlap Merging
// ---------------------------------------------------------------------------

/**
 * Merge overlapping match ranges. When two detections overlap, the earlier
 * and longer match wins. Fully contained matches are dropped.
 */
function mergeOverlaps(sorted: RedactionMatch[]): RedactionMatch[] {
  if (sorted.length <= 1) return sorted;

  const merged: RedactionMatch[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];

    if (curr.start < prev.end) {
      // Overlapping — keep the one with higher confidence, or the longer one
      if (curr.confidence > prev.confidence || (curr.end - curr.start) > (prev.end - prev.start)) {
        merged[merged.length - 1] = curr;
      }
      // else: keep prev (drop curr)
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Main Search
// ---------------------------------------------------------------------------

/**
 * Default minimum confidence threshold for including matches.
 */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Find all redaction matches based on enabled patterns and search terms.
 * Includes confidence filtering and overlap merging.
 */
export function findAllRedactions(
  text: string,
  enabledPatterns: string[],
  searchTerms: Array<{ term: string; caseSensitive: boolean }> = [],
  confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
): RedactionMatch[] {
  const allMatches: RedactionMatch[] = [];

  // Find pattern matches
  enabledPatterns.forEach(patternId => {
    const pattern = REDACTION_PATTERNS[patternId.toUpperCase()] || REDACTION_PATTERNS[patternId];

    if (pattern) {
      const matches = findPatternMatches(text, pattern);
      allMatches.push(...matches);
    }
  });

  // Find text search matches
  searchTerms.forEach(({ term, caseSensitive }) => {
    const matches = findTextMatches(text, term, caseSensitive);
    allMatches.push(...matches);
  });

  // Filter by confidence threshold
  const confident = allMatches.filter(m => m.confidence >= confidenceThreshold);

  // Sort by start position
  confident.sort((a, b) => a.start - b.start);

  // Merge overlapping ranges
  return mergeOverlaps(confident);
}

/**
 * Apply redactions to text
 */
export function applyRedactions(
  text: string,
  matches: RedactionMatch[]
): string {
  if (matches.length === 0) return text;

  let redactedText = '';
  let lastIndex = 0;

  matches.forEach((match) => {
    redactedText += text.slice(lastIndex, match.start);
    redactedText += match.replacement;
    lastIndex = match.end;
  });

  redactedText += text.slice(lastIndex);
  return redactedText;
}

// ---------------------------------------------------------------------------
// Entity Deduplication
// ---------------------------------------------------------------------------

/**
 * Group matches by their normalized key, treating case variations as the same entity.
 * Returns a map of normalized key → array of matches.
 */
export function groupByEntity(matches: RedactionMatch[]): Map<string, RedactionMatch[]> {
  const groups = new Map<string, RedactionMatch[]>();

  for (const match of matches) {
    const key = match.normalizedKey;
    const group = groups.get(key);
    if (group) {
      group.push(match);
    } else {
      groups.set(key, [match]);
    }
  }

  return groups;
}

/**
 * Get summary of redactions
 */
export function getRedactionSummary(matches: RedactionMatch[]): {
  total: number;
  byType: Record<string, number>;
  uniqueEntities: number;
} {
  const byType: Record<string, number> = {};

  matches.forEach(match => {
    const typeName = REDACTION_PATTERNS[match.type]?.name || 'Custom Text';
    byType[typeName] = (byType[typeName] || 0) + 1;
  });

  const uniqueEntities = groupByEntity(matches).size;

  return {
    total: matches.length,
    byType,
    uniqueEntities,
  };
}
