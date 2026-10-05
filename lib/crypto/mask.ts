/**
 * Credential masking helpers - ensures secrets never leak into logs/responses.
 */

const PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  { re: /\bsk-[A-Za-z0-9]{6,}/g, replacement: 'sk-***MASKED***' },
  { re: /\bsk-ant-[A-Za-z0-9_-]{6,}/g, replacement: 'sk-ant-***MASKED***' },
  { re: /\bBearer\s+[A-Za-z0-9._-]{6,}/g, replacement: 'Bearer ***MASKED***' },
  { re: /\bx-api-key:\s*[^\s,}]+/gi, replacement: 'x-api-key: ***MASKED***' },
  { re: /\bauthorization:\s*[^\s,}]+/gi, replacement: 'authorization: ***MASKED***' },
];

export function maskSecretsInText(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { re, replacement } of PATTERNS) {
    out = out.replace(re, replacement);
  }
  return out;
}

export function maskApiKey(key: string, visibleStart = 4, visibleEnd = 4): string {
  if (!key) return '';
  if (key.length <= visibleStart + visibleEnd) {
    return '*'.repeat(key.length);
  }
  return `${key.slice(0, visibleStart)}${'*'.repeat(6)}${key.slice(-visibleEnd)}`;
}