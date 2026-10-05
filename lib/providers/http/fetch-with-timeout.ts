import { validateBaseURL } from './url';
import { combineTimeoutSignal, withAbortGuard } from './signal';
import { normalizeError, type NormalizeOptions } from '../errors/normalize';
import { classifyHttpStatus, errors } from '../errors/normalize';
import { ErrorCodes } from '../errors/codes';
import { ProviderError } from '@/lib/errors';
import type { ProviderConfig } from '../types';

export interface FetchWithTimeoutOptions {
  config: ProviderConfig;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Lida automaticamente com a resposta: 4xx/5xx levantam ProviderError. */
  expectJson?: boolean;
}

export interface FetchWithTimeoutResult<T = unknown> {
  status: number;
  headers: Headers;
  json: T | undefined;
  text: string | undefined;
}

/**
 * Realiza a chamada HTTP ao provedor com timeout, cancelamento e tratamento
 * padronizado de erros de rede e HTTP. Nao conhece detalhes do SDK de cada
 * provedor - apenas um helper REST.
 *
 * Comportamento:
 *   - valida a URL base
 *   - injeta Authorization/Header apiKey se config.apiKey existir (nessa ordem):
 *       Authorization: Bearer <apiKey>   (caso padrao OpenAI-compativeis)
 *   - adiciona extraHeaders (sem sobrescrever os internos)
 *   - aplica timeout e AbortSignal combo
 *   - 4xx/5xx => ProviderError com codigo classificado do status
 *   - erros de rede/abortados => normalizados
 */
export async function fetchWithTimeout<T = unknown>(
  opts: FetchWithTimeoutOptions,
  normalize: NormalizeOptions,
): Promise<FetchWithTimeoutResult<T>> {
  const { config, path: urlPath, method = 'GET', headers = {}, body, expectJson = true } = opts;

  const base = validateBaseURL(config.baseUrl ?? '');
  const finalUrl = new URL(urlPath, base).toString();

  const effectiveTimeout = config.timeoutMs ?? 30_000;
  const combined = combineTimeoutSignal(effectiveTimeout);

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (config.apiKey) {
    requestHeaders['Authorization'] = `Bearer ${config.apiKey}`;
  }
  if (config.extraHeaders) {
    for (const [k, v] of Object.entries(config.extraHeaders)) {
      if (k.toLowerCase() === 'authorization') continue;
      requestHeaders[k] = v;
    }
  }
  if (body && !('Content-Type' in requestHeaders)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  try {
    const init: RequestInit = {
      method,
      headers: requestHeaders,
      signal: combined.signal,
    };
    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      init.body = body;
    }

    const fetchPromise = fetch(finalUrl, init);

    let response: Response;
    try {
      response = await withAbortGuard(fetchPromise, combined, normalize.provider, normalize.model);
    } catch (err) {
      throw normalizeError(err, normalize);
    }

    const text = await response.text().catch(() => undefined);
    let json: T | undefined;
    if (expectJson && text) {
      try {
        json = JSON.parse(text) as T;
      } catch {
        // resposta nao-JSON: sera tratada abaixo pelo status
      }
    }

    if (!response.ok) {
      let providerMessage: string | undefined;
      if (json && typeof json === 'object') {
        const candidate =
          (json as { error?: { message?: string }; message?: string }).error?.message ??
          (json as { message?: string }).message;
        if (typeof candidate === 'string') providerMessage = candidate;
      }
      const code = classifyHttpStatus(response.status);
      throw new ProviderError({
        code,
        message: providerMessage ?? defaultHttpMessage(response.status),
        provider: normalize.provider,
        model: normalize.model,
        retryable: [429, 503, 502, 504].includes(response.status),
        statusCode: response.status,
      });
    }

    return { status: response.status, headers: response.headers, json, text };
  } finally {
    combined.cleanup();
  }
}

function defaultHttpMessage(status: number): string {
  if (status === 400) return 'Requisicao invalida. Verifique os parametros enviados ao provedor.';
  if (status === 401 || status === 403) return 'Credenciais invalidas ou ausentes.';
  if (status === 404) return 'Recurso ou modelo nao encontrado no provedor.';
  if (status === 429) return 'Limite de requisicoes atingido. Tente novamente em instantes.';
  if (status === 413) return 'O prompt excede o limite de contexto do modelo.';
  if (status === 503 || status >= 500) return 'Provedor temporariamente indisponivel.';
  return `Resposta ${status} do provedor.`;
}

void errors;