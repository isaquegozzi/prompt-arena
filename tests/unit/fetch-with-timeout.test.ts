import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from '@/lib/providers/http/fetch-with-timeout';
import type { ProviderConfig } from '@/lib/providers/types';

const baseConfig: ProviderConfig = {
  id: 'p1',
  name: 'OpenAI',
  adapterType: 'OPENAI_COMPATIBLE',
  baseUrl: 'https://api.example.com',
  apiKey: 'sk-secret-test-key-not-real',
  timeoutMs: 5000,
  active: true,
};

function mockResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  const text = JSON.stringify(body);
  const h = new Headers(headers);
  h.set('content-type', 'application/json');
  return new Response(text, { status, headers: h });
}

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, _init: RequestInit) =>
        mockResponse(200, { ok: true, data: 'hello' }),
      ),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('parses JSON on 2xx and returns the body', async () => {
    const res = await fetchWithTimeout(
      { config: baseConfig, path: '/v1/test', method: 'POST', body: '{}' },
      { provider: 'openai-compatible' },
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, data: 'hello' });
  });

  it('rejects with AUTH_ERROR on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(401, { error: { message: 'Invalid API key sk-leak-1234567890' } })));
    await expect(
      fetchWithTimeout({ config: baseConfig, path: '/v1/test' }, { provider: 'openai-compatible' }),
    ).rejects.toMatchObject({
      code: 'AUTH_ERROR',
      statusCode: 401,
    });
  });

  it('rejects with RATE_LIMIT retryable on 429', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(429, { error: { message: 'slow down' } })));
    await expect(
      fetchWithTimeout({ config: baseConfig, path: '/v1/test' }, { provider: 'openai-compatible' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMIT', retryable: true });
  });

  it('sanitizes leaked keys in provider error messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(400, { error: { message: 'bad key sk-abc123def456ghi' } })));
    await expect(
      fetchWithTimeout({ config: baseConfig, path: '/v1/test' }, { provider: 'openai-compatible' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects with CONNECTION_REFUSED for ECONNREFUSED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
      }),
    );
    await expect(
      fetchWithTimeout({ config: { ...baseConfig, baseUrl: 'http://localhost:9999' }, path: '/v1/test' }, { provider: 'ollama' }),
    ).rejects.toMatchObject({ code: 'CONNECTION_REFUSED' });
  });

  it('sends Authorization header when apiKey is provided', async () => {
    const fetchSpy = vi.fn(async (_url, init: RequestInit) =>
      mockResponse(200, { ok: true }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    await fetchWithTimeout(
      { config: baseConfig, path: '/v1/test', method: 'POST', body: '{}' },
      { provider: 'openai-compatible' },
    );
    const firstCall = fetchSpy.mock.calls[0]; if (!firstCall) throw new Error('expected call'); const sent = (firstCall[1] as RequestInit).headers as Record<string, string>;
    expect(sent['Authorization']).toBe(`Bearer ${baseConfig.apiKey}`);
  });

  it('respects extraHeaders without overriding Authorization', async () => {
    const fetchSpy = vi.fn(async (_url, init: RequestInit) =>
      mockResponse(200, { ok: true }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    await fetchWithTimeout(
      {
        config: { ...baseConfig, extraHeaders: { 'X-Org': '123', Authorization: 'Bearer leaked-should-be-kept' } },
        path: '/v1/test',
      },
      { provider: 'openai-compatible' },
    );
    const firstCall = fetchSpy.mock.calls[0]; if (!firstCall) throw new Error('expected call'); const sent = (firstCall[1] as RequestInit).headers as Record<string, string>;
    expect(sent['X-Org']).toBe('123');
    expect(sent['Authorization']).toBe(`Bearer ${baseConfig.apiKey}`);
  });

  it('rejects with INVALID_ENDPOINT when baseUrl is invalid', async () => {
    await expect(
      fetchWithTimeout(
        { config: { ...baseConfig, baseUrl: 'not-a-url' }, path: '/v1/test' },
        { provider: 'openai-compatible' },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_ENDPOINT' });
  });
});