/// <reference lib="webworker" />

import { processDocumentRedactionsCore } from '@/workers/redactionWorkerRuntime';
import type { RedactionMatch } from '@/utils/redactionPatterns';
import { logger } from '@/utils/logger';

interface WorkerRequest {
  id: string;
  type: 'process';
  payload: {
    file?: File;
    fileBuffer?: ArrayBuffer;
    fileType?: string;
    fileName: string;
    matches: RedactionMatch[];
  };
}

type WorkerResponse =
  | {
      id: string;
      status: 'success';
      payload: {
        originalContent: any;
        redactedContent: any;
        matches: RedactionMatch[];
        redactedFile: {
          name: string;
          type: string;
          buffer: ArrayBuffer;
        };
      };
    }
  | {
      id: string;
      status: 'error';
      message: string;
      stack?: string;
    };

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data;
  if (type !== 'process') {
    return;
  }

  try {
    let sourceFile: File;
    if (payload.file) {
      sourceFile = payload.file;
    } else if (payload.fileBuffer) {
      sourceFile = new File([payload.fileBuffer], payload.fileName, {
        type: payload.fileType || 'application/octet-stream',
      });
    } else {
      throw new Error('No file data supplied to redaction worker');
    }

    const result = await processDocumentRedactionsCore(sourceFile, payload.matches, payload.fileName);
    const buffer = await result.redactedFile.arrayBuffer();

    const response: WorkerResponse = {
      id,
      status: 'success',
      payload: {
        originalContent: result.originalContent,
        redactedContent: result.redactedContent,
        matches: result.matches,
        redactedFile: {
          name: result.redactedFile.name,
          type: result.redactedFile.type,
          buffer,
        },
      },
    };

    ctx.postMessage(response, [buffer]);
  } catch (error: any) {
    logger.error('[redactionWorker] processing failed', error);
    const response: WorkerResponse = {
      id,
      status: 'error',
      message: error?.message || 'Unknown redaction worker error',
      stack: error?.stack,
    };
    ctx.postMessage(response);
  }
};

