import { maskSecretsInText } from '@/lib/crypto/mask';

/**
 * Sanitiza mensagens de erro antes de expor ao cliente.
 *
 * - Aplica mascaramento de chaves/headers/tokens.
 * - Corta mensagens muito longas (?os provedores as vezes incluem stacks).
 * - Remove quebras de linha em excesso.
 * - Nunca propaga valores que possam conter URLs com credenciais.
 */

const MAX_LENGTH = 500;

const URL_CREDENTIAL_RE = /\bhttps?:\/\/[^/\s]*:[^/\s@]*@/gi;
const EXTRA_WHITESPACE_RE = /\s{2,}/g;

export function sanitizeMessage(raw: string | undefined | null): string {
  if (!raw) return '';
  let out = String(raw);
  // Remove credenciais embutidas em URLs: https://user:pass@host
  out = out.replace(URL_CREDENTIAL_RE, 'https://***@');
  // Mascara padroes de chave (sk-..., Bearer ..., x-api-key: ...)
  out = maskSecretsInText(out);
  // Compacta espacos
  out = out.replace(EXTRA_WHITESPACE_RE, ' ');
  // Trunca para evitar digerir stacks gigantes do provedor
  if (out.length > MAX_LENGTH) {
    out = `${out.slice(0, MAX_LENGTH - 3)}...`;
  }
  return out.trim();
}