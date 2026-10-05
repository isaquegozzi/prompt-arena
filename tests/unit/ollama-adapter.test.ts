import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ollamaAdapter } from '@/providers/ollama/adapter';
import type { ProviderConfig, ProviderModel } from '@/lib/providers/types';

const cfg: ProviderConfig = {
  id: 'o1',
  name: 'Ollama',
  adapterType: 'OLLAMA',
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  timeoutMs: 60_000,
  active: true,
};

const model: ProviderModel = {
  id: 'llama3',
  providerId: 'o1',
  technicalId: 'llama3',
  displayName: 'Llama 3',
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

describe('ollama adapter.generate', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('maps 2xx with tokens prompt_eval_count and eval_count', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson(200, {
        model: 'llama3',
        message: { role: 'assistant', content: 'Resposta local' },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 25,
        eval_count: 15,
      }),
    );
    const result = await ollamaAdapter.generate(
      { systemPrompt: 's', userPrompt: 'hi', model, parameters: { temperature: 0.4, maxTokens: 100 } },
      cfg,
    );
    expect(result.content).toBe('Resposta local');
    expect(result.inputTokens).toBe(25);
    expect(result.outputTokens).toBe(15);
    expect(result.finishReason).toBe('stop');
    expect(result.providerType).toBe('OLLAMA');
    expect(result.estimatedCost).toBeUndefined();

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('/api/chat');
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
    const body = JSON.parse(init.body as string) as { model: string; stream: boolean; temperature: number; num_predict: number; messages: { role: string; content: string }[] };
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0.4);
    expect(body.num_predict).toBe(100);
    expect(body.messages[0]).toEqual({ role: 'system', content: 's' });
  });

  it('maps model_not_found-style 404 to NOT_FOUND', async () => {
    fetchSpy.mockResolvedValueOnce(mockJson(404, { error: 'model not found locally' }));
    await expect(
      ollamaAdapter.generate({ userPrompt: 'x', model: { ...model, technicalId: 'nonexistent' }, parameters: {} }, cfg),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('maps response without message to INVALID_RESPONSE', async () => {
    fetchSpy.mockResolvedValueOnce(mockJson(200, { done: true }));
    await expect(
      ollamaAdapter.generate({ userPrompt: 'x', model, parameters: {} }, cfg),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('ollama adapter.testConnection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns ok=true with local models and isLocal=true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mockJson(200, {
          models: [
            { name: 'llama3', size: 3_800_000_000, details: { family: 'llama' } },
            { name: 'phi3', size: 2_200_000_000, details: { family: 'phi' } },
          ],
        }),
      ),
    );
    const res = await ollamaAdapter.testConnection(cfg);
    expect(res.ok).toBe(true);
    expect(res.models?.every((m) => m.isLocal === true)).toBe(true);
    expect(res.models?.[0]).toMatchObject({ technicalId: 'llama3', displayName: 'llama3' });
  });
});