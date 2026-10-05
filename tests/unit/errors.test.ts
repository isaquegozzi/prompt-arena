import { describe, it, expect } from 'vitest';
import { ProviderError, isProviderError } from '@/lib/errors';

describe('ProviderError', () => {
  it('carries structured fields', () => {
    const err = new ProviderError({
      code: 'AUTH_ERROR',
      message: 'Invalid API key',
      provider: 'openai',
      model: 'gpt-4o',
      retryable: false,
      statusCode: 401,
    });
    expect(err.name).toBe('ProviderError');
    expect(err.code).toBe('AUTH_ERROR');
    expect(err.provider).toBe('openai');
    expect(err.retryable).toBe(false);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid API key');
  });

  it('defaults retryable to false', () => {
    const err = new ProviderError({
      code: 'TIMEOUT',
      message: 'x',
      provider: 'demo',
    });
    expect(err.retryable).toBe(false);
  });

  it('is recognized by isProviderError', () => {
    const err = new ProviderError({ code: 'X', message: 'y', provider: 'z' });
    expect(isProviderError(err)).toBe(true);
    expect(isProviderError(new Error('plain'))).toBe(false);
  });
});