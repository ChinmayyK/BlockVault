/**
 * Redaction Patterns Library
 * Defines regex patterns and functions for identifying and redacting PII
 */

export interface RedactionPattern {
  id: string;
  name: string;
  regex: RegExp;
  replacement: string;
  description: string;
}

export interface RedactionMatch {
  text: string;
  start: number;
  end: number;
  type: string;
  replacement: string;
}

// Common PII patterns
export const REDACTION_PATTERNS: Record<string, RedactionPattern> = {
  AADHAAR: {
    id: 'aadhaar',
    name: 'Aadhaar Number',
    regex: /\b\d{4}[\s-]\d{4}[\s-]\d{4}\b/g,
    replacement: '[AADHAAR REDACTED]',
    description: 'Matches Aadhaar in format: XXXX-XXXX-XXXX or XXXX XXXX XXXX'
  },
  PAN: {
    id: 'pan',
    name: 'PAN Card Number',
    regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    replacement: '[PAN REDACTED]',
    description: 'Matches PAN format: 5 letters, 4 digits, 1 letter'
  },
  CREDIT_CARD: {
    id: 'credit_card',
    name: 'Credit Card Number',
    regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '[CREDIT CARD REDACTED]',
    description: 'Matches 16-digit credit card numbers'
  },
  EMAIL: {
    id: 'email',
    name: 'Email Address',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL REDACTED]',
    description: 'Matches email addresses'
  },
  PHONE: {
    id: 'phone',
    name: 'Phone Number',
    regex: /\b(\+91[\s-]?)?[6-9]\d{9}\b|\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    replacement: '[PHONE REDACTED]',
    description: 'Matches Indian (+91) and international phone numbers'
  },
  DOB: {
    id: 'dob',
    name: 'Date of Birth',
    regex: /\b(0?[1-9]|[12]\d|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](\d{2}|\d{4})\b|\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/g,
    replacement: '[DOB REDACTED]',
    description: 'Matches dates in DD/MM/YYYY or MM/DD/YYYY format'
  },
  BANK_ACCOUNT: {
    id: 'bank_account',
    name: 'Bank Account Number',
    regex: /(?:Account|A\/C|Account #|Account Number|Account No\.?)[:\s#]+\d{9,18}\b/gi,
    replacement: '[BANK ACCOUNT REDACTED]',
    description: 'Matches Indian bank account numbers with label'
  },
  IFSC: {
    id: 'ifsc',
    name: 'IFSC Code',
    regex: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    replacement: '[IFSC REDACTED]',
    description: 'Matches Indian IFSC codes'
  },
  PASSPORT: {
    id: 'passport',
    name: 'Passport Number',
    regex: /\b[A-Z]\d{7}\b|\b[A-Z]{1,2}\d{6,9}\b/g,
    replacement: '[PASSPORT REDACTED]',
    description: 'Matches Indian passport numbers'
  },
  DRIVING_LICENSE: {
    id: 'driving_license',
    name: 'Driving License',
    regex: /\b[A-Z]{2}[\s-]?\d{2}[\s-]?\d{4}[\s-]?\d{7}\b|\b[A-Z]{2}\d{13}\b/g,
    replacement: '[DL REDACTED]',
    description: 'Matches Indian driving license numbers'
  }
};

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
      replacement: pattern.replacement
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
      replacement: replacement
    });
  }
  
  return matches;
}

/**
 * Find all redaction matches based on enabled patterns and search terms
 */
export function findAllRedactions(
  text: string,
  enabledPatterns: string[],
  searchTerms: Array<{ term: string; caseSensitive: boolean }> = []
): RedactionMatch[] {
  const allMatches: RedactionMatch[] = [];
  
  // Find pattern matches - optimized: single pass through enabled patterns
  enabledPatterns.forEach(patternId => {
    // Try both uppercase and lowercase to handle any case
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
  
  // Sort by start position and remove duplicates
  allMatches.sort((a, b) => a.start - b.start);
  
  // Remove overlapping matches (keep first occurrence)
  const uniqueMatches: RedactionMatch[] = [];
  let lastEnd = -1;
  
  allMatches.forEach(match => {
    if (match.start >= lastEnd) {
      uniqueMatches.push(match);
      lastEnd = match.end;
    }
  });
  
  return uniqueMatches;
}

/**
 * Apply redactions to text
 */
export function applyRedactions(
  text: string,
  matches: RedactionMatch[]
): string {
  if (matches.length === 0) {
    console.warn('⚠️ applyRedactions called with 0 matches - returning original text');
    return text;
  }
  
  console.log(`🔴 Applying ${matches.length} redactions to text (${text.length} chars)`);
  
  let redactedText = '';
  let lastIndex = 0;
  let redactionCount = 0;
  
  matches.forEach((match, idx) => {
    // Add text before the match
    redactedText += text.slice(lastIndex, match.start);
    
    // Add replacement
    redactedText += match.replacement;
    redactionCount++;
    
    // Log first few redactions for verification
    if (idx < 3) {
      console.log(`   [${idx + 1}] "${match.text.substring(0, 30)}..." → "${match.replacement}"`);
    }
    
    // Update last index
    lastIndex = match.end;
  });
  
  // Add remaining text
  redactedText += text.slice(lastIndex);
  
  console.log(`✅ Applied ${redactionCount} redactions. New text length: ${redactedText.length} chars`);
  console.log(`   Text changed: ${text !== redactedText}`);
  
  return redactedText;
}

/**
 * Get summary of redactions
 */
export function getRedactionSummary(matches: RedactionMatch[]): {
  total: number;
  byType: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  
  matches.forEach(match => {
    const typeName = REDACTION_PATTERNS[match.type]?.name || 'Custom Text';
    byType[typeName] = (byType[typeName] || 0) + 1;
  });
  
  return {
    total: matches.length,
    byType
  };
}

