import { ErrorCodes } from '../errors/codes';
import { ProviderError } from '@/lib/errors';

/**
 * Validacao de URL base do provedor.
 *
 * - So aceita http(s) (e opcionalmente ollama:// para compat futura).
 * - Bloqueia IPs privados/loopback apenas quando explicitlyEnableLoopback=false,
 *   para evitar SSRF acidental em ambientes compartilhados. No MVP local
 *   mantemos false (permitido) porque o usuario precisa apontar para Ollama.
 */

export interface ValidateUrlOptions {
  /** Permite 127.0.0.1 / localhost / 10.x / 192.168.x. Default: true (MVP local). */
  allowPrivateHosts?: boolean;
  /** Lista de scheme permitidos. Default: http, https. */
  allowedSchemes?: string[];
}

export function validateBaseURL(
  raw: string,
  opts: ValidateUrlOptions = {},
): URL {
  const allowPrivate = opts.allowPrivateHosts ?? true;
  const allowedSchemes = opts.allowedSchemes ?? ['http', 'https'];

  if (!raw || typeof raw !== 'string') {
    throw new ProviderError({
      code: ErrorCodes.INVALID_ENDPOINT,
      message: 'URL base vazia.',
      provider: 'unknown',
    });
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ProviderError({
      code: ErrorCodes.INVALID_ENDPOINT,
      message: 'URL base malformada. Use o formato http(s)://host[:porta].',
      provider: 'unknown',
    });
  }

  if (!allowedSchemes.includes(url.protocol.replace(':', '').toLowerCase())) {
    throw new ProviderError({
      code: ErrorCodes.INVALID_ENDPOINT,
      message: `Esquema nao suportado: ${url.protocol}. Use ${allowedSchemes.join(' ou ')}.`,
      provider: 'unknown',
    });
  }

  if (!allowPrivate) {
    const host = url.hostname.toLowerCase();
    const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const privateRe =
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/;
    if (isLoopback || privateRe.test(host)) {
      throw new ProviderError({
        code: ErrorCodes.INVALID_ENDPOINT,
        message: 'Hosts privados/loopback nao sao permitidos nesta configuracao.',
        provider: 'unknown',
      });
    }
  }

  return url;
}