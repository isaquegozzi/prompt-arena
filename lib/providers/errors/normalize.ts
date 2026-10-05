import { ProviderError } from '@/lib/errors';
import { ErrorCodes, type ErrorCode } from './codes';
import { sanitizeMessage } from './sanitize';

/**
 * Normaliza erros de qualquer origem (SDK, fetch, timeout, abort, logica do
 * proprio adaptador) em um ProviderError com codigo padronizado.
 *
 * Nenhum dado sensivel passa direto: mensagens brutas sao sanitizadas.
 */

export interface NormalizeOptions {
  provider: string;
  model?: string;
  baseUrl?: string;
}

/** Classifica um codigo HTTP em um ErrorCode padronizado. */
export function classifyHttpStatus(status: number): ErrorCode {
  if (status === 401 || status === 403) return ErrorCodes.AUTH_ERROR;
  if (status === 429) return ErrorCodes.RATE_LIMIT;
  if (status === 400) return ErrorCodes.BAD_REQUEST;
  if (status === 404) return ErrorCodes.NOT_FOUND;
  if (status === 408) return ErrorCodes.TIMEOUT;
  if (status === 503 || status >= 500) return ErrorCodes.PROVIDER_UNAVAILABLE;
  if (status === 413) return ErrorCodes.CONTEXT_LENGTH;
  return ErrorCodes.INVALID_RESPONSE;
}

/** Determina se um erro deve ser retryable com backoff. */
export function isRetryable(code: ErrorCode): boolean {
  return (
    code === ErrorCodes.RATE_LIMIT ||
    code === ErrorCodes.PROVIDER_UNAVAILABLE ||
    code === ErrorCodes.NETWORK_ERROR ||
    code === ErrorCodes.TIMEOUT
  );
}

/**
 * Cria um ProviderError a partir de qualquer thrown value. Default seguro se
 * nenhuma pattern house.
 */
export function normalizeError(err: unknown, opts: NormalizeOptions): ProviderError {
  if (err instanceof ProviderError) {
    // Ja normalizado por outro adaptador; apenas garante provider/modelo
    return new ProviderError({
      code: err.code,
      message: sanitizeMessage(err.message),
      provider: opts.provider,
      model: opts.model ?? err.model,
      retryable: err.retryable,
      statusCode: err.statusCode,
    });
  }

  if (err instanceof Error) {
    const name = err.name;
    const msg = err.message || '';

    // Timeout tem precedencia: msgens como "aborted due to timeout" sao
    // classificadas como TIMEOUT, nao como CANCELED.
    if (/timeout|timed out/i.test(msg) || name === 'TimeoutError') {
      return new ProviderError({
        code: ErrorCodes.TIMEOUT,
        message: 'A requisicao excedeu o tempo limite configurado.',
        provider: opts.provider,
        model: opts.model,
        retryable: true,
      });
    }

    // AbortController / fetch abort
    if (name === 'AbortError' || /aborted/i.test(msg)) {
      return new ProviderError({
        code: ErrorCodes.CANCELED,
        message: 'Requisicao cancelada pelo usuario.',
        provider: opts.provider,
        model: opts.model,
        retryable: false,
      });
    }

    // Erros tipicos de fetch (TypeError: fetch failed em undici)
    if (name === 'TypeError' && /fetch failed/i.test(msg)) {
      const cause = (err as Error & { cause?: { code?: string } }).cause;
      const causeCode = cause?.code;
      if (causeCode === 'ECONNREFUSED') {
        return new ProviderError({
          code: ErrorCodes.CONNECTION_REFUSED,
          message: 'Conexao recusada pelo provedor. Verifique a URL base e se o servico esta em execucao.',
          provider: opts.provider,
          model: opts.model,
          retryable: true,
        });
      }
      if (causeCode === 'ENOTFOUND' || causeCode === 'EAI_AGAIN') {
        return new ProviderError({
          code: ErrorCodes.INVALID_ENDPOINT,
          message: 'Nao foi possivel resolver o host informado. Verifique a URL base do provedor.',
          provider: opts.provider,
          model: opts.model,
          retryable: false,
        });
      }
      if (causeCode === 'CERT_HAS_EXPIRED' || causeCode === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        return new ProviderError({
          code: ErrorCodes.INVALID_ENDPOINT,
          message: 'Falha ao validar o certificado TLS do provedor.',
          provider: opts.provider,
          model: opts.model,
          retryable: false,
        });
      }
      return new ProviderError({
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Erro de rede ao chamar o provedor. Verifique a conexao e a URL base.',
        provider: opts.provider,
        model: opts.model,
        retryable: true,
      });
    }
  }

  // Fallback generico - nunca expoe o objeto cru
  return new ProviderError({
    code: ErrorCodes.INTERNAL_ERROR,
    message: 'Erro interno inesperado ao processar a requisicao.',
    provider: opts.provider,
    model: opts.model,
    retryable: false,
  });
}

/**
 * Fabrica todos os ProviderError mais comuns que os adaptadores reais vao usar.
 */
export const errors = {
  auth: (provider: string, model?: string) =>
    new ProviderError({
      code: ErrorCodes.AUTH_ERROR,
      message: 'Credenciais invalidas ou ausentes para o provedor.',
      provider,
      model,
      retryable: false,
      statusCode: 401,
    }),
  rateLimit: (provider: string, model?: string, statusCode = 429) =>
    new ProviderError({
      code: ErrorCodes.RATE_LIMIT,
      message: 'Limite de requisicoes atingido. Tente novamente em alguns instantes.',
      provider,
      model,
      retryable: true,
      statusCode,
    }),
  timeout: (provider: string, model?: string) =>
    new ProviderError({
      code: ErrorCodes.TIMEOUT,
      message: 'A requisicao excedeu o tempo limite.',
      provider,
      model,
      retryable: true,
    }),
  canceled: (provider: string, model?: string) =>
    new ProviderError({
      code: ErrorCodes.CANCELED,
      message: 'Requisicao cancelada.',
      provider,
      model,
      retryable: false,
    }),
  notFound: (provider: string, model?: string) =>
    new ProviderError({
      code: ErrorCodes.NOT_FOUND,
      message: 'Modelo ou recurso nao encontrado no provedor.',
      provider,
      model,
      retryable: false,
      statusCode: 404,
    }),
  contextLengthExceeded: (provider: string, model?: string) =>
    new ProviderError({
      code: ErrorCodes.CONTEXT_LENGTH,
      message: 'O prompt excede o contexto maximo configurado para o modelo.',
      provider,
      model,
      retryable: false,
    }),
  invalidEndpoint: (provider: string, msg?: string) =>
    new ProviderError({
      code: ErrorCodes.INVALID_ENDPOINT,
      message: msg ?? 'URL base do provedor invalida ou ausente.',
      provider,
      retryable: false,
    }),
  emptyResponse: (provider: string, model?: string) =>
    new ProviderError({
      code: ErrorCodes.EMPTY_RESPONSE,
      message: 'O provedor retornou uma resposta sem conteudo.',
      provider,
      model,
      retryable: true,
    }),
  invalidResponse: (provider: string, model?: string, msg?: string) =>
    new ProviderError({
      code: ErrorCodes.INVALID_RESPONSE,
      message: sanitizeMessage(msg ?? 'Resposta fora do formato esperado.'),
      provider,
      model,
      retryable: false,
    }),
  modelsEndpointMissing: (provider: string) =>
    new ProviderError({
      code: ErrorCodes.MODELS_ENDPOINT_MISSING,
      message:
        'Nao foi possivel listar os modelos automaticamente. Cadastre pelo menos um modelo manualmente ou verifique a URL base do provedor.',
      provider,
      retryable: false,
    }),
};