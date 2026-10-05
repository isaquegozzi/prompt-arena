/**
 * AES-256-GCM encryption helpers for secrets at rest.
 *
 * The encryption key is derived from the ENCRYPTION_KEY environment variable.
 * For local MVP only; public deployments must use a proper secret manager.
 *
 * Format stored: <ivBase64>:<ciphertextBase64>:<tagBase64>
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Define it in your .env file (32+ bytes recommended).',
    );
  }
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), encrypted.toString('base64'), tag.toString('base64')].join(':');
}

export function decryptSecret(stored: string): string {
  if (!stored) return '';
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }
  const [ivB64, dataB64, tagB64] = parts;
  if (!ivB64 || !dataB64 || !tagB64) {
    throw new Error('Invalid encrypted payload format');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3;
}