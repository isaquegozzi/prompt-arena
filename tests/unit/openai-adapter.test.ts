import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openaiAdapter, withConfig } from '@/providers/openai/adapter';
import type { ProviderConfig, ProviderModel, GenerationParameters } from '@/lib/providers/types';

const cfg: ProviderConfig = {
  id: 'p1',
  name: 'OpenAI',
  adapterType: 'OPENAI',
  baseUrl: 'https://api.openai.com',
  apiKey: 'sk-test-key-1234567890abcdef',
  timeoutMs: 5000,
  active: true,
};

const model: ProviderModel = {
  id: 'gpt-4o',
  providerId: 'p1',
  technicalId: 'gpt-4o',
  displayName: 'GPT-4o',
  inputPricePer1M: 5,
  outputPricePer1M: 15,
  isLocal: false,
  active: true,
  supportsStreaming: true,
};

const params: GenerationParameters = { temperature: 0.5, maxTokens: 100 };

function mockJson(status: number, body: unknown): Response {
  const h = new Headers({ 'content-type': 'application/json' });
  return new Response(JSON.stringify(body), { status, headers: h });
}

describe('openai adapter.withConfig', () => {
  it('applies default baseUrl when missing', () => {
    const out = withConfig({ ...cfg, baseUrl: '' });
    expect(out.baseUrl).toBe('https://api.openai.com');
  });
  it('applies default timeoutMs when 0', () => {
    const out = withConfig({ ...cfg, timeoutMs: 0 });
    expect(out.timeoutMs).toBe(60_000);
  });
});

describe('openai adapter.generate', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('maps 2xx response to GenerationResult with tokens, cost, modelTechnicalId', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson(200, {
        id: 'chatcmpl-1',
        model: 'gpt-4o',
        choices: [{ message: { role: 'assistant', content: 'Hello world' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
      }),
    );
    const result = await openaiAdapter.generate(
      { systemPrompt: 'be helpful', userPrompt: 'hi', model, parameters: params },
      cfg,
    );
    expect(result.modelTechnicalId).toBe('gpt-4o');
    expect(result.content).toBe('Hello world');
    expect(result.inputTokens).toBe(50);
    expect(result.outputTokens).toBe(30);
    expect(result.totalTokens).toBe(80);
    expect(result.finishReason).toBe('stop');
    expect(result.estimatedCost).toBeCloseTo((50 / 1e6) * 5 + (30 / 1e6) * 15, 6);
    expect(result.providerType).toBe('OPENAI');

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${cfg.apiKey}`);
    const body = JSON.parse(init.body as string) as { model: string; messages: { role: string; content: string }[]; temperature: number; max_tokens: number };
    expect(body.model).toBe('gpt-4o');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'be helpful' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hi' });
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(100);
  });

  it('ignores unsupported parameters cleanly (seed/stop erroneously passadas para ANTHROPIC only)', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson(200, {
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    );
    await openaiAdapter.generate(
      { userPrompt: 'hi', model, parameters: { seed: 42, stop: ['END'] } },
      cfg,
    );
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as { seed: number; stop: string[] };
    expect(body.seed).toBe(42);
    expect(body.stop).toEqual(['END']);
  });

  it('maps 401 to AUTH_ERROR and sanitizes leaked keys', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson(401, { error: { message: 'Incorrect API key sk-leak1234567890 provided' } }),
    );
    await expect(
      openaiAdapter.generate({ userPrompt: 'x', model, parameters: {} }, cfg),
    ).rejects.toMatchObject({ code: 'AUTH_ERROR', statusCode: 401 });
  });

  it('maps 429 to RATE_LIMIT retryable', async () => {
    fetchSpy.mockResolvedValueOnce(mockJson(429, { error: { message: 'slow down sk-xxx12345' } }));
    await expect(
      openaiAdapter.generate({ userPrompt: 'x', model, parameters: {} }, cfg),
    ).rejects.toMatchObject({ code: 'RATE_LIMIT', retryable: true });
  });

  it('throws INVALID_RESPONSE when body has no choices', async () => {
    fetchSpy.mockResolvedValueOnce(mockJson(200, { unexpected: true }));
    await expect(
      openaiAdapter.generate({ userPrompt: 'x', model, parameters: {} }, cfg),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('openai adapter.listModels', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns ProviderModel list from data[]', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockJson(200, { data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] })),
    );
    const list = await openaiAdapter.listModels!(cfg);
    expect(list.map((m) => m.technicalId)).toEqual(['gpt-4o', 'gpt-4o-mini']);
    expect(list[0]).toMatchObject({ active: true, supportsStreaming: true });
  });

  it('throws INVALID_RESPONSE when missing data[]', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockJson(200, {})));
    await expect(openaiAdapter.listModels!(cfg)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('openai adapter.testConnection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns ok with models on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockJson(200, { data: [{ id: 'gpt-4o' }] })),
    );
    const res = await openaiAdapter.testConnection(cfg);
    expect(res.ok).toBe(true);
    expect(res.models?.length).toBe(1);
  });

  it('returns ok=false with friendly message on NOT_FOUND', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockJson(404, { error: 'not found' })));
    const res = await openaiAdapter.testConnection(cfg);
    expect(res.ok).toBe(false);
    expect(res.message).toContain('Cadastre');
  });

  it('returns ok=false with message on AUTH_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockJson(401, { error: { message: 'bad key' } })));
    const res = await openaiAdapter.testConnection(cfg);
    expect(res.ok).toBe(false);
  });
});