import type { RedactionMatch } from '@/utils/redactionPatterns';
import type { DocumentContent } from '@/utils/documentExtractor';

export interface MatchPreview {
  text: string;
  type: string;
  context: string;
}

export interface RedactionSummary {
  totalMatches: number;
  uniqueMatches: number;
  uniqueTypes: number;
  previews: MatchPreview[];
  matchedTexts: string[];
}

export interface RedactionResult {
  originalContent: DocumentContent;
  redactedContent: DocumentContent;
  matches: RedactionMatch[];
  redactedFile: File;
}






