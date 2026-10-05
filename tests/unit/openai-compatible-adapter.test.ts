import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openaiCompatibleAdapter } from '@/providers/openai-compatible/adapter';
import type { ProviderConfig, ProviderModel } from '@/lib/providers/types';

const cfg: ProviderConfig = {
  id: 'c1',
  name: 'LocalOpenAI',
  adapterType: 'OPENAI_COMPATIBLE',
  baseUrl: 'http://localhost:8080',
  apiKey: 'custom-token-xyz-1234567890',
  timeoutMs: 5000,
  active: true,
};

const model: ProviderModel = {
  id: 'local-gpt',
  providerId: 'c1',
  technicalId: 'local-gpt',
  displayName: 'Local GPT',
  isLocal: true,
  active: true,
  supportsStreaming: true,
};

function mockJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
  });
}

describe('openai-compatible adapter.testConnection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns ok=false with friendly "Cadastre" message on NOT_FOUND', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockJson(404, { error: 'missing' })));
    const res = await openaiCompatibleAdapter.testConnection(cfg);
    expect(res.ok).toBe(false);
    expect(res.message).toContain('Cadastre');
  });

  it('returns ok=true and models list on valid /v1/models', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockJson(200, { data: [{ id: 'local-gpt' }] })),
    );
    const res = await openaiCompatibleAdapter.testConnection(cfg);
    expect(res.ok).toBe(true);
    expect(res.models?.[0]?.technicalId).toBe('local-gpt');
  });

  it('returns ok=false with friendly message on invalid endpoint (BAD_REQUEST)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockJson(400, { error: 'no models endpoint' })));
    const res = await openaiCompatibleAdapter.testConnection(cfg);
    expect(res.ok).toBe(false);
    expect(res.message).toContain('Cadastre');
  });
});

describe('openai-compatible adapter.generate', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reuses OpenAI semantics but returns providerType=OPENAI_COMPATIBLE', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson(200, {
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }),
    );
    const result = await openaiCompatibleAdapter.generate(
      { userPrompt: 'hi', model, parameters: { temperature: 0.5 } },
      cfg,
    );
    expect(result.providerType).toBe('OPENAI_COMPATIBLE');
    expect(result.content).toBe('ok');
    expect(result.inputTokens).toBe(5);
  });

  it('rejects when baseUrl is missing', async () => {
    await expect(
      openaiCompatibleAdapter.generate(
        { userPrompt: 'x', model, parameters: {} },
        { ...cfg, baseUrl: '' },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_ENDPOINT' });
  });
});

describe('openai-compatible adapter.listModels', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('throws MODELS_ENDPOINT_MISSING (cadastro manual)', async () => {
    // nao invoca fetch, lazy handler by design
    await expect(openaiCompatibleAdapter.listModels!(cfg)).rejects.toMatchObject({ code: 'MODELS_ENDPOINT_MISSING' });
  });
});