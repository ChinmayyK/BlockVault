import { RedactionMatch } from './redactionPatterns';
import { logger } from '@/utils/logger';
import RedactionWorker from '@/workers/redactionWorker?worker';
import type { DocumentContent } from './documentExtractor';
import type { MatchPreview, RedactionResult, RedactionSummary } from './redactionTypes';

export type { MatchPreview, RedactionResult, RedactionSummary } from './redactionTypes';

interface RedactionWorkerSuccessPayload {
  originalContent: DocumentContent;
  redactedContent: DocumentContent;
  matches: RedactionMatch[];
  redactedFile: {
    name: string;
    type: string;
    buffer: ArrayBuffer;
  };
}

interface RedactionWorkerRequestPayload {
  file?: File;
  fileBuffer?: ArrayBuffer;
  fileType?: string;
  fileName: string;
  matches: RedactionMatch[];
}

type RedactionWorkerMessage =
  | { id: string; status: 'success'; payload: RedactionWorkerSuccessPayload }
  | { id: string; status: 'error'; message?: string; stack?: string };

const pendingRequests = new Map<string, {
  resolve: (payload: RedactionWorkerSuccessPayload) => void;
  reject: (error: Error) => void;
}>();
let workerInstance: Worker | null = null;

function generateRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `redaction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureWorker() {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }
  if (!workerInstance) {
    workerInstance = new RedactionWorker();
    workerInstance.onmessage = (event: MessageEvent<RedactionWorkerMessage>) => {
      const message = event.data;
      const callbacks = pendingRequests.get(message.id);
      if (!callbacks) {
        return;
      }
      pendingRequests.delete(message.id);
      if (message.status === 'success' && message.payload) {
        callbacks.resolve(message.payload);
      } else {
        callbacks.reject(new Error(message.message || 'Redaction worker failed'));
      }
    };
    workerInstance.onerror = (event) => {
      logger.error('Redaction worker crashed', event);
      pendingRequests.forEach(({ reject }) => reject(new Error('Redaction worker crashed')));
      pendingRequests.clear();
      workerInstance?.terminate();
      workerInstance = null;
    };
  }
  return workerInstance;
}

export function buildRedactionSummary(text: string, matches: RedactionMatch[]): RedactionSummary {
  const uniqueTexts = new Set<string>();
  const types = new Set<string>();

  const previews: MatchPreview[] = matches.slice(0, 50).map((match) => {
    uniqueTexts.add(match.text);
    types.add(match.type);

    const start = Math.max(0, match.start - 40);
    const end = Math.min(text.length, match.end + 40);
    const snippet = text.substring(start, end).replace(/\s+/g, ' ');

    return {
      text: match.text,
      type: match.type,
      context: snippet,
    };
  });

  return {
    totalMatches: matches.length,
    uniqueMatches: uniqueTexts.size,
    uniqueTypes: types.size,
    previews,
    matchedTexts: Array.from(uniqueTexts),
  };
}

export async function processDocumentRedactions(
  file: File | Blob,
  matches: RedactionMatch[],
  fileName: string = 'redacted_document'
): Promise<RedactionResult> {
  logger.debug('[redactionProcessor] starting redaction job', {
    name: fileName,
    size: file.size,
    type: file.type,
    matches: matches.length,
  });

  if (file.size < 100) {
    throw new Error(`Input file is too small (${file.size} bytes) - cannot process`);
  }

  const worker = ensureWorker();
  if (!worker) {
    logger.warn('[redactionProcessor] Web Workers unavailable, running synchronously');
    const { processDocumentRedactionsCore } = await import('@/workers/redactionWorkerRuntime');
    return processDocumentRedactionsCore(file, matches, fileName);
  }

  const sendPayload = (payload: RedactionWorkerRequestPayload, transfer: Transferable[] = []) =>
    new Promise<RedactionWorkerSuccessPayload>((resolve, reject) => {
      const requestId = generateRequestId();
      pendingRequests.set(requestId, { resolve, reject });
      try {
        worker.postMessage({ id: requestId, type: 'process', payload }, transfer);
      } catch (err) {
        pendingRequests.delete(requestId);
        reject(err as Error);
      }
    });

  const asFile =
    file instanceof File
      ? file
      : new File([file], fileName, { type: file.type || 'application/octet-stream' });

  let response: RedactionWorkerSuccessPayload;
  try {
    response = await sendPayload({
      file: asFile,
      fileType: asFile.type,
      fileName,
      matches,
    });
  } catch (err: any) {
    if (err?.name !== 'DataCloneError') {
      throw err;
    }
    logger.warn('[redactionProcessor] Structured clone failed, falling back to ArrayBuffer payload');
    const fileBuffer = await asFile.arrayBuffer();
    response = await sendPayload(
      {
        fileBuffer,
        fileType: asFile.type,
        fileName,
        matches,
      },
      [fileBuffer],
    );
  }

  const { redactedFile, ...rest } = response;
  const reconstructedFile = new File([redactedFile.buffer], redactedFile.name, { type: redactedFile.type });

  return {
    originalContent: rest.originalContent,
    redactedContent: rest.redactedContent,
    matches: rest.matches,
    redactedFile: reconstructedFile,
  };
}

export function convertRedactionsToChunks(
  text: string,
  matches: RedactionMatch[],
  chunkSize: number = 128
): number[] {
  const chunks: Set<number> = new Set();

  matches.forEach((match) => {
    const startChunk = Math.floor(match.start / chunkSize);
    const endChunk = Math.floor(match.end / chunkSize);

    for (let i = startChunk; i <= endChunk; i++) {
      chunks.add(i);
    }
  });

  return Array.from(chunks).sort((a, b) => a - b);
}

export async function createRedactedFile(
  _originalFile: File | Blob,
  redactedText: string,
  fileName: string,
  type: 'text' | 'pdf' = 'text'
): Promise<File> {
  if (type === 'pdf') {
    const blob = new Blob([redactedText], { type: 'text/plain' });
    return new File([blob], `Redacted_${fileName}`, { type: 'text/plain' });
  }
  const blob = new Blob([redactedText], { type: 'text/plain' });
  return new File([blob], `Redacted_${fileName}`, { type: 'text/plain' });
}

export function validateRedactions(
  text: string,
  matches: RedactionMatch[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  matches.forEach((match, index) => {
    if (match.start < 0 || match.end > text.length) {
      errors.push(`Match ${index + 1} is out of bounds`);
    }

    if (match.start >= match.end) {
      errors.push(`Match ${index + 1} has invalid range`);
    }

    const actualText = text.slice(match.start, match.end);
    if (actualText !== match.text) {
      errors.push(`Match ${index + 1} text mismatch`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
