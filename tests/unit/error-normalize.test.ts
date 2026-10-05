import { describe, it, expect } from 'vitest';
import { normalizeError, classifyHttpStatus, isRetryable, errors, ErrorCodes } from '@/lib/providers/errors';
import { ProviderError } from '@/lib/errors';

describe('classifyHttpStatus', () => {
  it.each([
    [401, ErrorCodes.AUTH_ERROR],
    [403, ErrorCodes.AUTH_ERROR],
    [429, ErrorCodes.RATE_LIMIT],
    [400, ErrorCodes.BAD_REQUEST],
    [404, ErrorCodes.NOT_FOUND],
    [413, ErrorCodes.CONTEXT_LENGTH],
    [408, ErrorCodes.TIMEOUT],
    [500, ErrorCodes.PROVIDER_UNAVAILABLE],
    [503, ErrorCodes.PROVIDER_UNAVAILABLE],
  ])('maps %i to %s', (status, code) => {
    expect(classifyHttpStatus(status)).toBe(code);
  });

  it('maps arbitrary other 4xx to INVALID_RESPONSE', () => {
    expect(classifyHttpStatus(422)).toBe(ErrorCodes.INVALID_RESPONSE);
  });
});

describe('isRetryable', () => {
  it.each([ErrorCodes.RATE_LIMIT, ErrorCodes.TIMEOUT, ErrorCodes.PROVIDER_UNAVAILABLE, ErrorCodes.NETWORK_ERROR])(
    'retryable: %s',
    (code) => expect(isRetryable(code)).toBe(true),
  );
  it.each([ErrorCodes.AUTH_ERROR, ErrorCodes.NOT_FOUND, ErrorCodes.BAD_REQUEST])(
    'not retryable: %s',
    (code) => expect(isRetryable(code)).toBe(false),
  );
});

describe('normalizeError', () => {
  it('preserves an existing ProviderError with sanitized message', () => {
    const pre = new ProviderError({
      code: 'AUTH_ERROR',
      message: 'key sk-abcdef123456 rejected',
      provider: 'openai',
    });
    const out = normalizeError(pre, { provider: 'openai', model: 'gpt-4o' });
    expect(out.code).toBe('AUTH_ERROR');
    expect(out.message).not.toContain('abcdef123456');
    expect(out.message).toContain('***MASKED***');
  });

  it('maps AbortError to CANCELED', () => {
    const err = new DOMException('Aborted', 'AbortError');
    const out = normalizeError(err, { provider: 'demo' });
    expect(out.code).toBe('CANCELED');
    expect(out.retryable).toBe(false);
  });

  it('maps TypeError "fetch failed" + ECONNREFUSED cause to CONNECTION_REFUSED', () => {
    const err = Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'ECONNREFUSED' },
    });
    const out = normalizeError(err, { provider: 'ollama' });
    expect(out.code).toBe('CONNECTION_REFUSED');
    expect(out.retryable).toBe(true);
  });

  it('maps TypeError "fetch failed" + ENOTFOUND to INVALID_ENDPOINT', () => {
    const err = Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'ENOTFOUND' },
    });
    const out = normalizeError(err, { provider: 'demo' });
    expect(out.code).toBe('INVALID_ENDPOINT');
  });

  it('maps generic TypeError to NETWORK_ERROR (fallback)', () => {
    const err = Object.assign(new TypeError('fetch failed'), { cause: {} });
    const out = normalizeError(err, { provider: 'demo' });
    expect(out.code).toBe('NETWORK_ERROR');
  });

  it('maps message containing "timeout" to TIMEOUT', () => {
    const err = new Error('The operation was aborted due to timeout');
    const out = normalizeError(err, { provider: 'demo' });
    expect(out.code).toBe('TIMEOUT');
    expect(out.retryable).toBe(true);
  });

  it('unknown values fall back to INTERNAL_ERROR without leaking', () => {
    const out = normalizeError({ wtf: true, secret: 'sk-abracadabra123456' }, { provider: 'demo' });
    expect(out.code).toBe('INTERNAL_ERROR');
    expect(out.message).not.toContain('abracadabra');
  });
});

describe('errors helpers', () => {
  it('builds rateLimit ProviderError', () => {
    const err = errors.rateLimit('openai', 'gpt-4o');
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.statusCode).toBe(429);
    expect(err.retryable).toBe(true);
  });

  it('builds modelsEndpointMissing with friendly message', () => {
    const err = errors.modelsEndpointMissing('openai-compatible');
    expect(err.code).toBe('MODELS_ENDPOINT_MISSING');
    expect(err.message.toLowerCase()).toContain('cadastre');
  });
});