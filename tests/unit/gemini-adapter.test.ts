import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geminiAdapter } from '@/providers/gemini/adapter';
import type { ProviderConfig, ProviderModel } from '@/lib/providers/types';

const cfg: ProviderConfig = {
  id: 'g1',
  name: 'Gemini',
  adapterType: 'GEMINI',
  baseUrl: 'https://generativelanguage.googleapis.com',
  apiKey: 'AIza-fake-test-key',
  timeoutMs: 4000,
  active: true,
};

const model: ProviderModel = {
  id: 'gemini-1.5-pro',
  providerId: 'g1',
  technicalId: 'gemini-1.5-pro',
  displayName: 'Gemini 1.5 Pro',
  inputPricePer1M: 1.25,
  outputPricePer1M: 5,
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

describe('gemini adapter.generate', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('maps 2xx response and passes api key as ?key=', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson(200, {
        candidates: [
          {
            content: { parts: [{ text: 'Resposta Gemini' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 },
      }),
    );
    const result = await geminiAdapter.generate(
      { systemPrompt: 'preencha', userPrompt: 'hi', model, parameters: { temperature: 0.9, maxTokens: 60 } },
      cfg,
    );
    expect(result.content).toBe('Resposta Gemini');
    expect(result.inputTokens).toBe(20);
    expect(result.outputTokens).toBe(10);
    expect(result.totalTokens).toBe(30);
    expect(result.finishReason).toBe('STOP');
    expect(result.estimatedCost).toBeCloseTo((20 / 1e6) * 1.25 + (10 / 1e6) * 5, 6);
    expect(result.providerType).toBe('GEMINI');

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('key=');
    expect(url).toContain('AIza-fake-test-key');
    const path = '/v1beta/models/gemini-1.5-pro:generateContent';
    expect(url).toContain(path);

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as {
      contents: Array<{ role: string; parts: Array<{ text?: string }> }>;
      generationConfig: { temperature: number; maxOutputTokens: number };
    };
    // 1 system + 1 ack + 1 user
    expect(body.contents[0].role).toBe('user');
    expect(body.contents[0].parts[0]?.text).toBe('preencha');
    expect(body.contents[2].parts[0]?.text).toBe('hi');
    expect(body.generationConfig.temperature).toBe(0.9);
    expect(body.generationConfig.maxOutputTokens).toBe(60);
  });

  it('maps 400 to BAD_REQUEST', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson(400, { error: { message: 'invalid request' } }),
    );
    await expect(
      geminiAdapter.generate({ userPrompt: 'x', model, parameters: {} }, cfg),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', statusCode: 400 });
  });

  it('maps 404 to NOT_FOUND', async () => {
    fetchSpy.mockResolvedValueOnce(mockJson(404, { error: { message: 'model not found' } }));
    await expect(
      geminiAdapter.generate({ userPrompt: 'x', model, parameters: {} }, cfg),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('rejects when no candidates present with INVALID_RESPONSE', async () => {
    fetchSpy.mockResolvedValueOnce(mockJson(200, {}));
    await expect(
      geminiAdapter.generate({ userPrompt: 'x', model, parameters: {} }, cfg),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});