export interface FetchTimeoutOptions extends RequestInit {
  timeout?: number;
}

/**
 * Wrapper around fetch that aborts the request if it exceeds the provided timeout (default 15s).
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchTimeoutOptions = {},
): Promise<Response> {
  const { timeout = 15000, signal, ...rest } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  // If caller provided a signal, abort when either signal aborts
  const abortHandler = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', abortHandler);
    }
  }

  try {
    const response = await fetch(input, {
      ...rest,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
}







