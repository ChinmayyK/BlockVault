/**
 * Tests for fetchWithTimeout utility.
 *
 * Validates timeout behavior, external signal passthrough,
 * and proper cleanup of abort controllers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves when fetch completes before timeout', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout('https://example.com/api');
    expect(result.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('passes through request options to fetch', async () => {
    const mockResponse = new Response('created', { status: 201 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    await fetchWithTimeout('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"test": true}',
      timeout: 5000,
    });

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://example.com/api');
    expect(options?.method).toBe('POST');
    expect(options?.body).toBe('{"test": true}');
    // The signal should be an AbortSignal (from our controller)
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('aborts when timeout elapses', async () => {
    // Mock fetch to never resolve
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        })
    );

    const promise = fetchWithTimeout('https://example.com/slow', {
      timeout: 1000,
    });

    // Advance time past the timeout
    vi.advanceTimersByTime(1001);

    await expect(promise).rejects.toThrow();
  });

  it('clears timeout after successful fetch', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const mockResponse = new Response('ok', { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    await fetchWithTimeout('https://example.com/api', { timeout: 5000 });

    // clearTimeout should have been called to clean up
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('uses default timeout of 15000ms', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const mockResponse = new Response('ok', { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    await fetchWithTimeout('https://example.com/api');

    // First setTimeout call should use default 15000ms
    const timeoutCall = setTimeoutSpy.mock.calls.find(
      (call) => typeof call[1] === 'number' && call[1] === 15000
    );
    expect(timeoutCall).toBeDefined();
  });

  it('aborts immediately when external signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }
        })
    );

    await expect(
      fetchWithTimeout('https://example.com/api', {
        signal: controller.signal,
        timeout: 5000,
      })
    ).rejects.toThrow();
  });

  it('cleans up external signal listener after completion', async () => {
    const controller = new AbortController();
    const removeListenerSpy = vi.spyOn(controller.signal, 'removeEventListener');
    const mockResponse = new Response('ok', { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    await fetchWithTimeout('https://example.com/api', {
      signal: controller.signal,
      timeout: 5000,
    });

    expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
