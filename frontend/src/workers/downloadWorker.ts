/// <reference lib="webworker" />

self.onmessage = async (event: MessageEvent) => {
  const { url, options } = event.data as {
    url: string;
    options: RequestInit & { timeout?: number };
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? 60000);
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // If response body missing, fall back to buffering once
    if (!response.ok || !response.body) {
      const buffer = await response.arrayBuffer();
      (self as DedicatedWorkerGlobalScope).postMessage(
        { type: 'chunk', buffer, byteOffset: 0, byteLength: buffer.byteLength },
        [buffer]
      );
      (self as DedicatedWorkerGlobalScope).postMessage({
        type: 'done',
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      });
      return;
    }

    const reader = response.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const transferable = value.buffer;
        (self as DedicatedWorkerGlobalScope).postMessage(
          {
            type: 'chunk',
            buffer: transferable,
            byteOffset: value.byteOffset,
            byteLength: value.byteLength,
          },
          [transferable]
        );
      }
    }

    (self as DedicatedWorkerGlobalScope).postMessage({
      type: 'done',
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    });
  } catch (error: any) {
    (self as DedicatedWorkerGlobalScope).postMessage({
      type: 'error',
      message: error?.message || 'Download worker failed',
    });
  }
};




