import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { demoAdapter } from '@/providers/demo/adapter';
import { DEMO_PROVIDER_CONFIG, DEMO_MODELS } from '@/providers/demo/mock-models';
import { ProviderError } from '@/lib/errors';

const ac = () => new AbortController();

describe('demoAdapter.testConnection', () => {
  it('returns ok=true and models list', async () => {
    const res = await demoAdapter.testConnection(DEMO_PROVIDER_CONFIG);
    expect(res.ok).toBe(true);
    expect(res.models?.length).toBeGreaterThan(0);
  });
});

describe('demoAdapter.listModels', () => {
  it('returns 5 demo models', async () => {
    const list = (demoAdapter.listModels ? await demoAdapter.listModels(DEMO_PROVIDER_CONFIG) : []);
    expect(list.length).toBe(DEMO_MODELS.length);
  });
});

describe('demoAdapter.generate', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // fora da faixa de 8% de erro
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a GenerationResult with tokens, cost, latency and finishReason=stop', async () => {
    const model = DEMO_MODELS[0]!;
    const result = await demoAdapter.generate(
      {
        systemPrompt: 'system',
        userPrompt: 'Hello world',
        model,
        parameters: { temperature: 0.7, maxTokens: 256 },
        signal: ac().signal,
      },
      DEMO_PROVIDER_CONFIG,
    );
    expect(result.modelTechnicalId).toBe(model.technicalId);
    expect(result.modelName).toBe(model.displayName);
    expect(result.content).toContain('Hello world');
    expect(result.inputTokens).toBeGreaterThan(0);
    expect(result.outputTokens).toBeGreaterThan(0);
    expect(result.totalTokens).toBe(result.inputTokens! + result.outputTokens!);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.finishReason).toBe('stop');
    expect(result.providerType).toBe('DEMO');
  });

  it('respects local (free) model with zero cost', async () => {
    const localModel = DEMO_MODELS.find((m) => m.isLocal)!;
    const result = await demoAdapter.generate(
      { userPrompt: 'test', model: localModel, parameters: {}, signal: ac().signal },
      DEMO_PROVIDER_CONFIG,
    );
    expect(result.estimatedCost).toBe(0);
  });

  it('throws RATE_LIMIT ProviderError when random roll < 0.08', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05);
    const model = DEMO_MODELS[0]!;
    await expect(
      demoAdapter.generate(
        { userPrompt: 'x', model, parameters: {}, signal: ac().signal },
        DEMO_PROVIDER_CONFIG,
      ),
    ).rejects.toMatchObject({
      name: 'ProviderError',
      code: 'RATE_LIMIT',
      statusCode: 429,
      retryable: true,
    });
  });

  it('honors AbortSignal - rejects with CANCELED', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const controller = new AbortController();
    const model = DEMO_MODELS[0]!;
    const promise = demoAdapter.generate(
      { userPrompt: 'x', model, parameters: {}, signal: controller.signal },
      DEMO_PROVIDER_CONFIG,
    );
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(ProviderError);
    await expect(promise).rejects.toMatchObject({ code: 'CANCELED' });
  });
});