/**
 * Human-friendly error message mapping for BlockVault.
 *
 * Converts technical error strings into user-readable messages
 * with actionable suggestions.
 */

interface HumanError {
  message: string;
  suggestion: string;
}

/** Patterns matched against the raw error string (case-insensitive). */
const ERROR_MAP: Array<{ pattern: RegExp; result: (ctx?: ErrorContext) => HumanError }> = [
  // OCR / text extraction
  {
    pattern: /ocr.*(fail|error)/i,
    result: (ctx) => ({
      message: ctx?.page
        ? `Text recognition failed on page ${ctx.page}.`
        : 'Text recognition failed on this document.',
      suggestion: 'Please upload a higher-resolution scan or a text-based PDF.',
    }),
  },
  {
    pattern: /tesseract/i,
    result: () => ({
      message: 'The OCR engine encountered an issue.',
      suggestion: 'Try re-uploading the document. If the issue persists, verify the file is not corrupted.',
    }),
  },

  // Encryption
  {
    pattern: /decrypt|passphrase|password.*incorrect/i,
    result: () => ({
      message: 'Unable to decrypt the document.',
      suggestion: 'Please check that you entered the correct passphrase.',
    }),
  },
  {
    pattern: /encrypt.*fail/i,
    result: () => ({
      message: 'Encryption could not be applied to this document.',
      suggestion: 'Ensure the file is not corrupted and try again.',
    }),
  },

  // Redaction
  {
    pattern: /redact.*fail|apply.*redaction.*error/i,
    result: () => ({
      message: 'Redaction could not be applied.',
      suggestion: 'Review your redaction selections and try again. If the issue persists, re-analyze the document.',
    }),
  },
  {
    pattern: /no.*entities|no.*detections/i,
    result: () => ({
      message: 'No sensitive entities were found in this document.',
      suggestion: 'You can manually mark areas for redaction using the drawing tool.',
    }),
  },

  // ZK Proof
  {
    pattern: /proof.*fail|zk.*error|snark/i,
    result: () => ({
      message: 'Zero-knowledge proof generation failed.',
      suggestion: 'This is usually temporary. Wait a moment and try generating the proof again.',
    }),
  },
  {
    pattern: /proof.*timeout/i,
    result: () => ({
      message: 'Proof generation timed out.',
      suggestion: 'Large documents may take longer. The system will retry automatically.',
    }),
  },

  // Blockchain
  {
    pattern: /anchor.*fail|blockchain.*error|transaction.*fail/i,
    result: () => ({
      message: 'Blockchain anchoring could not be completed.',
      suggestion: 'Check your network connection. The system will retry the anchoring automatically.',
    }),
  },
  {
    pattern: /gas|insufficient.*funds/i,
    result: () => ({
      message: 'The blockchain transaction could not be submitted.',
      suggestion: 'Ensure there are sufficient funds for gas fees on the connected wallet.',
    }),
  },

  // Upload / network
  {
    pattern: /upload.*fail|file.*too.*large/i,
    result: () => ({
      message: 'The file could not be uploaded.',
      suggestion: 'Check your internet connection and ensure the file is under the size limit (50 MB).',
    }),
  },
  {
    pattern: /network|ECONNREFUSED|timeout|fetch/i,
    result: () => ({
      message: 'Unable to reach the server.',
      suggestion: 'Please check your internet connection and try again in a few seconds.',
    }),
  },
  {
    pattern: /401|unauthorized|jwt.*expired/i,
    result: () => ({
      message: 'Your session has expired.',
      suggestion: 'Please reconnect your wallet to continue.',
    }),
  },
  {
    pattern: /403|forbidden/i,
    result: () => ({
      message: 'You do not have permission for this action.',
      suggestion: 'Contact the document owner or your organization admin to request access.',
    }),
  },
  {
    pattern: /404|not.*found/i,
    result: () => ({
      message: 'The requested resource was not found.',
      suggestion: 'The file may have been deleted or the link may be invalid.',
    }),
  },
  {
    pattern: /429|rate.*limit/i,
    result: () => ({
      message: 'Too many requests.',
      suggestion: 'Please wait a moment before trying again.',
    }),
  },
  {
    pattern: /500|internal.*server/i,
    result: () => ({
      message: 'An unexpected server error occurred.',
      suggestion: 'Please try again. If the problem persists, contact support.',
    }),
  },

  // Certificate
  {
    pattern: /certificate.*fail/i,
    result: () => ({
      message: 'Security certificate could not be generated.',
      suggestion: 'Ensure the ZK proof was verified successfully before generating the certificate.',
    }),
  },
];

export interface ErrorContext {
  page?: number;
  fileName?: string;
}

/**
 * Convert a technical error string into a human-readable message with a suggestion.
 */
export function humanizeError(error: unknown, context?: ErrorContext): HumanError {
  const raw = error instanceof Error ? error.message : String(error ?? '');

  for (const { pattern, result } of ERROR_MAP) {
    if (pattern.test(raw)) {
      return result(context);
    }
  }

  // Fallback for unknown errors
  return {
    message: 'Something went wrong.',
    suggestion: 'Please try again. If the issue continues, refresh the page or contact support.',
  };
}

/**
 * Format a HumanError into a single user-facing toast string.
 */
export function formatError(error: unknown, context?: ErrorContext): string {
  const { message, suggestion } = humanizeError(error, context);
  return `${message} ${suggestion}`;
}
