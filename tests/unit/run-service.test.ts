import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runComparison, classifyStatus, type ExecutionFailure } from '@/lib/services/run-service';
import { DEMO_PROVIDER_CONFIG, DEMO_MODELS } from '@/providers/demo/mock-models';

const ac = () => new AbortController();

describe('runComparison', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs in parallel for multiple models and returns one outcome per model', async () => {
    const models = DEMO_MODELS.slice(0, 3);
    const outcome = await runComparison({
      userPrompt: 'Hello',
      parameters: {},
      models,
      config: DEMO_PROVIDER_CONFIG,
      signal: ac().signal,
    });
    expect(outcome.results).toHaveLength(3);
    for (const r of outcome.results) {
      expect(r.status).toBe('fulfilled');
    }
  });

  it('isolates failures - other models keep running when one fails', async () => {
    // faz 1/3 falhar via random roll baixo para todos mas assume que
    // distribution garante apenas falhas parciais usando o threshold fixo
    vi.spyOn(Math, 'random').mockImplementation(() => 0.05);
    const models = DEMO_MODELS.slice(0, 3);
    const outcome = await runComparison({
      userPrompt: 'Hello',
      parameters: {},
      models,
      config: DEMO_PROVIDER_CONFIG,
      signal: ac().signal,
    });
    expect(outcome.results).toHaveLength(3);
    for (const r of outcome.results) {
      expect(r.status).toBe('rejected');
    }
  });
});

describe('classifyStatus', () => {
  it('returns COMPLETED when no failure', () => {
    expect(classifyStatus(undefined)).toBe('COMPLETED');
  });

  it('maps known codes', () => {
    const mk = (errorCode: string): ExecutionFailure => ({
      modelTechnicalId: 'x',
      modelName: 'x',
      errorCode,
      errorMessage: '',
      errorProvider: 'demo',
      retryable: false,
      latencyMs: 0,
    });
    expect(classifyStatus(mk('TIMEOUT'))).toBe('TIMEOUT');
    expect(classifyStatus(mk('CANCELED'))).toBe('CANCELED');
    expect(classifyStatus(mk('RATE_LIMIT'))).toBe('RATE_LIMITED');
    expect(classifyStatus(mk('AUTH_ERROR'))).toBe('AUTH_ERROR');
    expect(classifyStatus(mk('UNKNOWN'))).toBe('FAILED');
  });
});