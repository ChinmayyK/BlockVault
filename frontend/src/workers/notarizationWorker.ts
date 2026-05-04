/// <reference lib="webworker" />

import { ZKCircuitManager } from '@/lib/crypto/zkCircuits';
import { logger } from '@/utils/logger';

interface NotarizationRequest {
  id: string;
  file?: File;
  fileBuffer?: ArrayBuffer;
  fileName: string;
}

type NotarizationResponse =
  | {
      id: string;
      status: 'success';
      payload: {
        fileHash: string;
        proof: any;
        publicSignals: string[];
        formattedProof: any;
      };
    }
  | {
      id: string;
      status: 'error';
      message: string;
      stack?: string;
    };

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.onmessage = async (event: MessageEvent<NotarizationRequest>) => {
  const { id, file, fileBuffer } = event.data;

  try {
    let buffer: ArrayBuffer;
    if (file) {
      buffer = await file.arrayBuffer();
    } else if (fileBuffer) {
      buffer = fileBuffer;
    } else {
      throw new Error('No notarization file data provided');
    }

    const fileData = new Uint8Array(buffer);
    const zkManager = ZKCircuitManager.getInstance();
    const fileHash = await zkManager.poseidonHash(fileData);
    const { proof, publicSignals } = await zkManager.generateIntegrityProof(fileData, fileHash);
    const formattedProof = await zkManager.formatProofForContract(proof, publicSignals);

    const response: NotarizationResponse = {
      id,
      status: 'success',
      payload: {
        fileHash,
        proof,
        publicSignals,
        formattedProof,
      },
    };

    workerScope.postMessage(response);
  } catch (error: any) {
    logger.error('[notarizationWorker] failed to generate proof', error);
    const response: NotarizationResponse = {
      id,
      status: 'error',
      message: error?.message || 'Failed to generate notarization proof',
      stack: error?.stack,
    };
    workerScope.postMessage(response);
  }
};



