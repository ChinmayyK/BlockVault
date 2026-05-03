let cryptoWorker: Worker | null = null;
let currentJobId = 0;

interface CryptoWorkerResponse {
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  jobId: number;
  progress?: number;
  message?: string;
  result?: any;
  error?: string;
}

function getWorker(): Worker {
  if (!cryptoWorker) {
    cryptoWorker = new Worker(new URL('../workers/crypto.worker.ts', import.meta.url), { type: 'module' });
  }
  return cryptoWorker;
}

export interface EncryptedResult {
  encryptedBlob: Blob;
  wrappedKeys: {
    passphrase: string;
    recovery: string;
  };
  recoveryKey: string;
}

export interface DecryptedResult {
  decryptedBlob: Blob;
}

export interface EmailShareResult {
  recipientSecretHex: string;
  recipientEncryptedFileKey: string;
}

export interface WrapVaultKeyResult {
  vaultKey: string;
  wrappedVaultKey: string;
}

export interface UnwrapVaultKeyResult {
  vaultKey: string;
}

export interface WrapWorkspaceKeyResult {
  workspaceKey: string;
  wrappedWorkspaceKey: string;
}

export interface UnwrapWorkspaceKeyResult {
  workspaceKey: string;
}

export function encryptFileWithWorker(
  file: File,
  passphrase: string,
  aad?: string,
  onProgress?: (progress: number, message?: string) => void
): Promise<EncryptedResult> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const jobId = ++currentJobId;

    const handler = (e: MessageEvent<CryptoWorkerResponse>) => {
      if (e.data.jobId !== jobId) return;

      if (e.data.type === 'SUCCESS') {
        worker.removeEventListener('message', handler);
        resolve(e.data.result);
      } else if (e.data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      } else if (e.data.type === 'PROGRESS' && onProgress) {
        onProgress(e.data.progress || 0, e.data.message);
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      type: 'ENCRYPT_FILE',
      jobId,
      payload: { file, passphrase, aad }
    });
  });
}

export function decryptFileWithWorker(
  encryptedBlob: Blob,
  wrappedKey: string,
  passphrase: string,
  aad?: string,
  onProgress?: (progress: number, message?: string) => void
): Promise<DecryptedResult> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const jobId = ++currentJobId;

    const handler = (e: MessageEvent<CryptoWorkerResponse>) => {
      if (e.data.jobId !== jobId) return;

      if (e.data.type === 'SUCCESS') {
        worker.removeEventListener('message', handler);
        resolve(e.data.result);
      } else if (e.data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      } else if (e.data.type === 'PROGRESS' && onProgress) {
        onProgress(e.data.progress || 0, e.data.message);
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      type: 'DECRYPT_FILE',
      jobId,
      payload: { encryptedBlob, wrappedKey, passphrase, aad }
    });
  });
}

export function prepareEmailShareWithWorker(
  wrappedKey: string,
  passphrase: string
): Promise<EmailShareResult> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const jobId = ++currentJobId;

    const handler = (e: MessageEvent<CryptoWorkerResponse>) => {
      if (e.data.jobId !== jobId) return;

      if (e.data.type === 'SUCCESS') {
        worker.removeEventListener('message', handler);
        resolve(e.data.result);
      } else if (e.data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
      // PROGRESS is not expected for this operation
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      type: 'PREPARE_EMAIL_SHARE',
      jobId,
      payload: { wrappedKey, passphrase }
    });
  });
}

export function wrapVaultKeyWithWorker(
  passphrase: string
): Promise<WrapVaultKeyResult> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const jobId = ++currentJobId;

    const handler = (e: MessageEvent<CryptoWorkerResponse>) => {
      if (e.data.jobId !== jobId) return;

      if (e.data.type === 'SUCCESS') {
        worker.removeEventListener('message', handler);
        resolve(e.data.result);
      } else if (e.data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      type: 'WRAP_VAULT_KEY',
      jobId,
      payload: { passphrase }
    });
  });
}

export function unwrapVaultKeyWithWorker(
  wrappedVaultKey: string,
  passphrase: string
): Promise<UnwrapVaultKeyResult> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const jobId = ++currentJobId;

    const handler = (e: MessageEvent<CryptoWorkerResponse>) => {
      if (e.data.jobId !== jobId) return;

      if (e.data.type === 'SUCCESS') {
        worker.removeEventListener('message', handler);
        resolve(e.data.result);
      } else if (e.data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      type: 'UNWRAP_VAULT_KEY',
      jobId,
      payload: { wrappedVaultKey, passphrase }
    });
  });
}

export function wrapWorkspaceKeyWithWorker(
  vaultKey: string,
  workspaceKey?: string
): Promise<WrapWorkspaceKeyResult> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const jobId = ++currentJobId;

    const handler = (e: MessageEvent<CryptoWorkerResponse>) => {
      if (e.data.jobId !== jobId) return;

      if (e.data.type === 'SUCCESS') {
        worker.removeEventListener('message', handler);
        resolve(e.data.result);
      } else if (e.data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      type: 'WRAP_WORKSPACE_KEY',
      jobId,
      payload: { vaultKey, workspaceKey }
    });
  });
}

export function unwrapWorkspaceKeyWithWorker(
  wrappedWorkspaceKey: string,
  vaultKey: string
): Promise<UnwrapWorkspaceKeyResult> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const jobId = ++currentJobId;

    const handler = (e: MessageEvent<CryptoWorkerResponse>) => {
      if (e.data.jobId !== jobId) return;

      if (e.data.type === 'SUCCESS') {
        worker.removeEventListener('message', handler);
        resolve(e.data.result);
      } else if (e.data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      type: 'UNWRAP_WORKSPACE_KEY',
      jobId,
      payload: { wrappedWorkspaceKey, vaultKey }
    });
  });
}
