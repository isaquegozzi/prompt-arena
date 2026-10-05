import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { anthropicAdapter } from '@/providers/anthropic/adapter';
import type { ProviderConfig, ProviderModel } from '@/lib/providers/types';

const cfg: ProviderConfig = {
  id: 'a1',
  name: 'Anthropic',
  adapterType: 'ANTHROPIC',
  baseUrl: 'https://api.anthropic.com',
  apiKey: 'sk-ant-test-key-1234567890',
  timeoutMs: 4000,
  active: true,
};

const model: ProviderModel = {
  id: 'claude',
  providerId: 'a1',
  technicalId: 'claude-3-5-sonnet-20240620',
  displayName: 'Claude 3.5 Sonnet',
  inputPricePer1M: 3,
  outputPricePer1M: 15,
  isLocal: false,
  active: true,
  supportsStreaming: true,
};

function mockJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
  });
}

describe('anthropic adapter.generate', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends x-api-key header (not Bearer) and maps response', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson(200, {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello from Claude' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    );
    const result = await anthropicAdapter.generate(
      { systemPrompt: 'be concise', userPrompt: 'hi', model, parameters: { temperature: 0.7, maxTokens: 50 } },
      cfg,
    );
    expect(result.content).toBe('Hello from Claude');
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(5);
    expect(result.finishReason).toBe('end_turn');
    expect(result.providerType).toBe('ANTHROPIC');

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe(cfg.apiKey);
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(init.body as string) as { system: string; messages: { role: string; content: string }[]; max_tokens: number; temperature: number };
    expect(body.system).toBe('be concise');
    expect(body.messages[0]).toEqual({ role: 'user', content: 'hi' });
    expect(body.max_tokens).toBe(50);
    expect(body.temperature).toBe(0.7);
  });

  it('maps 401 to AUTH_ERROR', async () => {
    fetchSpy.mockResolvedValueOnce(mockJson(401, { error: { message: 'bad key' } }));
    await expect(
      anthropicAdapter.generate({ userPrompt: 'x', model, parameters: {} }, cfg),
    ).rejects.toMatchObject({ code: 'AUTH_ERROR', statusCode: 401 });
  });

  it('ignores unsupported parameters (responseFormat, frequencyPenalty)', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson(200, {
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 2 },
        stop_reason: 'end_turn',
      }),
    );
    await anthropicAdapter.generate(
      { userPrompt: 'h', model, parameters: { responseFormat: 'json', frequencyPenalty: 1.5, temperature: 1 } },
      cfg,
    );
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as { temperature: number; response_format?: never; frequency_penalty?: never };
    expect(body.temperature).toBe(1);
    expect(body).not.toHaveProperty('response_format');
    expect(body).not.toHaveProperty('frequency_penalty');
  });
});

describe('anthropic adapter.testConnection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns ok=true and models list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mockJson(200, { data: [{ id: 'claude-3-5-sonnet', display_name: 'Claude 3.5 Sonnet' }] }),
      ),
    );
    const res = await anthropicAdapter.testConnection(cfg);
    expect(res.ok).toBe(true);
    expect(res.models?.[0]).toMatchObject({ technicalId: 'claude-3-5-sonnet', displayName: 'Claude 3.5 Sonnet' });
  });
});