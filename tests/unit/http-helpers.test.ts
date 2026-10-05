import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { combineTimeoutSignal, withAbortGuard } from '@/lib/providers/http/signal';
import { validateBaseURL } from '@/lib/providers/http/url';
import { ProviderError } from '@/lib/errors';

describe('combineTimeoutSignal', () => {
  it('returns an AbortSignal that is not aborted immediately', () => {
    const { signal, cleanup } = combineTimeoutSignal(5000);
    expect(signal.aborted).toBe(false);
    cleanup();
  });

  it('aborts after the timeout elapses', async () => {
    vi.useFakeTimers();
    const { signal, cleanup } = combineTimeoutSignal(50);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(60);
    expect(signal.aborted).toBe(true);
    cleanup();
    vi.useRealTimers();
  });

  it('aborts immediately when external signal is already aborted', () => {
    const external = new AbortController();
    external.abort();
    const { signal, cleanup } = combineTimeoutSignal(5000, external.signal);
    expect(signal.aborted).toBe(true);
    cleanup();
  });

  it('aborts when external signal aborts later', async () => {
    const external = new AbortController();
    const { signal, cleanup } = combineTimeoutSignal(5000, external.signal);
    expect(signal.aborted).toBe(false);
    setTimeout(() => external.abort(), 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(signal.aborted).toBe(true);
    cleanup();
  });

  it('timeout=0 means no timer scheduling', () => {
    vi.useFakeTimers();
    const { signal, cleanup } = combineTimeoutSignal(0);
    vi.advanceTimersByTime(10_000);
    expect(signal.aborted).toBe(false);
    cleanup();
    vi.useRealTimers();
  });
});

describe('withAbortGuard', () => {
  it('rejects with errors.timeout when signal aborts by timeout', async () => {
    vi.useFakeTimers();
    const combined = combineTimeoutSignal(50);
    const p = withAbortGuard(
      new Promise<void>(() => {}),
      combined,
      'demo',
      'demo-model',
    );
    vi.advanceTimersByTime(60);
    await expect(p).rejects.toMatchObject({ code: 'TIMEOUT' });
    combined.cleanup();
    vi.useRealTimers();
  });

  it('rejects with errors.canceled when external signal aborts', async () => {
    const external = new AbortController();
    const combined = combineTimeoutSignal(30_000, external.signal);
    const p = withAbortGuard(
      new Promise<void>(() => {}),
      combined,
      'demo',
      'demo-model',
    );
    setTimeout(() => external.abort(), 5);
    await expect(p).rejects.toMatchObject({ code: 'CANCELED' });
    combined.cleanup();
  });
});

describe('validateBaseURL', () => {
  it('accepts a valid https URL', () => {
    const url = validateBaseURL('https://api.openai.com');
    expect(url.protocol).toBe('https:');
  });

  it('accepts http for local providers (ollama)', () => {
    const url = validateBaseURL('http://localhost:11434');
    expect(url.hostname).toBe('localhost');
  });

  it('rejects empty input', () => {
    expect(() => validateBaseURL('')).toThrow(ProviderError);
  });

  it('rejects non-URL strings', () => {
    expect(() => validateBaseURL('not-a-url')).toThrow(ProviderError);
  });

  it('rejects unsupported schemes by default', () => {
    expect(() => validateBaseURL('ftp://host')).toThrow(ProviderError);
  });

  it('rejects private hosts when allowPrivateHosts=false', () => {
    expect(() =>
      validateBaseURL('http://localhost:11434', { allowPrivateHosts: false }),
    ).toThrow(ProviderError);
  });

  it('accepts a custom scheme list', () => {
    const url = validateBaseURL('ws://host', { allowedSchemes: ['ws', 'wss'] });
    expect(url.protocol).toBe('ws:');
  });
});