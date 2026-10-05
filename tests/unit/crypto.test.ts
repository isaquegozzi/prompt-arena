import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, isEncrypted } from '@/lib/crypto/aes';

const KEY = 'test-encryption-key-32-bytes-long-please-a';

describe('crypto aes', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it('round-trips a secret', () => {
    const plain = 'sk-test-super-secret-key';
    const enc = encryptSecret(plain);
    expect(enc).not.toBe(plain);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it('returns empty string for empty input', () => {
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const a = encryptSecret('same-secret');
    const b = encryptSecret('same-secret');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same-secret');
    expect(decryptSecret(b)).toBe('same-secret');
  });

  it('throws for missing ENCRYPTION_KEY', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret('x')).toThrow(/ENCRYPTION_KEY/);
  });

  it('rejects tampered ciphertext (auth tag check)', () => {
    const enc = encryptSecret('hello');
    const parts = enc.split(':');
    const tampered = [parts[0], Buffer.from('tampered').toString('base64'), parts[2]].join(':');
    expect(() => decryptSecret(tampered)).toThrow();
  });
});