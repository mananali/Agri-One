import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function encryptionKey(hexKey: string) {
  if (!/^[a-f0-9]{64}$/i.test(hexKey)) throw new Error('PII_ENCRYPTION_KEY must be exactly 64 hexadecimal characters');
  return Buffer.from(hexKey, 'hex');
}

export function encryptSensitive(value: string, hexKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(hexKey), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSensitive(value: string | null, hexKey: string) {
  if (!value) return '';
  const [version, ivHex, tagHex, encryptedHex] = value.split(':');
  if (version !== 'v1' || !ivHex || !tagHex || !encryptedHex) throw new Error('Stored sensitive profile data has an unsupported format');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(hexKey), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
}
