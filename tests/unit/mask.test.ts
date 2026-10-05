import { describe, it, expect } from 'vitest';
import { maskApiKey, maskSecretsInText } from '@/lib/crypto/mask';

describe('maskApiKey', () => {
  it('returns empty for empty input', () => {
    expect(maskApiKey('')).toBe('');
  });

  it('masks fully when very short', () => {
    expect(maskApiKey('abc')).toBe('***');
  });

  it('keeps prefixes/suffixes when long enough', () => {
    const masked = maskApiKey('sk-abcdef1234567890xyz');
    expect(masked.startsWith('sk-a')).toBe(true);
    expect(masked.endsWith('0xyz')).toBe(true);
    expect(masked).toContain('*');
  });
});

describe('maskSecretsInText', () => {
  it('masks OpenAI-style keys', () => {
    const out = maskSecretsInText('Error: key sk-abcdef123456 was rejected');
    expect(out).not.toContain('abcdef123456');
    expect(out).toContain('***MASKED***');
  });

  it('masks Anthropic-style keys', () => {
    const out = maskSecretsInText('Authorization: sk-ant-api99xyz');
    expect(out).not.toContain('api99xyz');
  });

  it('masks Bearer tokens', () => {
    const out = maskSecretsInText('header: Bearer abc.def.ghi-token');
    expect(out).toContain('***MASKED***');
  });

  it('does not alter text without secrets', () => {
    const txt = 'No secrets here, just plain text';
    expect(maskSecretsInText(txt)).toBe(txt);
  });
});