import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16;

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * The encryption key is read from TOKEN_CIPHER_KEY (32-byte hex string).
 *
 * @param plaintext - The string to encrypt.
 * @returns "iv:authTag:ciphertext" — all parts hex-encoded.
 */
export function encryptToken(plaintext: string): string {
  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a token encrypted by encryptToken().
 * @param encoded - "iv:authTag:ciphertext" hex string.
 * @returns Decrypted plaintext.
 */
export function decryptToken(encoded: string): string {
  const key = resolveKey();
  const parts = encoded.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const [ivHex, tagHex, cipherHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag.slice(0, TAG_LENGTH));

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Reads and validates the 32-byte hex key from the environment. */
function resolveKey(): Buffer {
  const hex = process.env['TOKEN_CIPHER_KEY'] ?? '';
  if (hex.length !== 64) {
    throw new Error(
      'TOKEN_CIPHER_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "process.stdout.write(require(\'crypto\').randomBytes(32).toString(\'hex\') + \'\\n\')"'
    );
  }
  return Buffer.from(hex, 'hex');
}
