/**
 * Build error helpers - normalized error type for provider responses.
 */

export class ProviderError extends Error {
  code: string;
  provider: string;
  model?: string;
  retryable: boolean;
  statusCode?: number;

  constructor(params: {
    code: string;
    message: string;
    provider: string;
    model?: string;
    retryable?: boolean;
    statusCode?: number;
  }) {
    super(params.message);
    this.name = 'ProviderError';
    this.code = params.code;
    this.provider = params.provider;
    this.model = params.model;
    this.retryable = params.retryable ?? false;
    this.statusCode = params.statusCode;
  }
}

export function isProviderError(e: unknown): e is ProviderError {
  return e instanceof ProviderError;
}