import { describe, it, expect } from 'vitest';
import { sanitizeMessage } from '@/lib/providers/errors/sanitize';

describe('sanitizeMessage', () => {
  it('masks API keys inside text', () => {
    const out = sanitizeMessage('Unauthorized for key sk-abcdef1234567890');
    expect(out).not.toContain('abcdef1234567890');
    expect(out).toContain('***MASKED***');
  });

  it('redacts embedded credentials in URLs', () => {
    const out = sanitizeMessage('failed calling https://user:pass@host.com/v1');
    expect(out).not.toContain('user:pass');
    expect(out).toContain('https://***@host.com');
  });

  it('collapses excessive whitespace', () => {
    const out = sanitizeMessage('error    with\n\nmultiple   spaces');
    expect(out).not.toMatch(/\s{2,}/);
  });

  it('truncates very long messages', () => {
    const long = 'x'.repeat(1000);
    const out = sanitizeMessage(long);
    expect(out.length).toBeLessThanOrEqual(500);
    expect(out.endsWith('...')).toBe(true);
  });

  it('returns empty string for empty/undefined', () => {
    expect(sanitizeMessage('')).toBe('');
    expect(sanitizeMessage(undefined)).toBe('');
    expect(sanitizeMessage(null)).toBe('');
  });
});