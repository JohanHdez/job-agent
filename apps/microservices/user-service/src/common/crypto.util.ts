import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

/**
 * Reads and validates the 32-byte hex encryption key from the environment.
 * @throws Error if TOKEN_CIPHER_KEY is absent or not a 64-char hex string.
 */
function resolveKey(): Buffer {
  const hex = process.env['TOKEN_CIPHER_KEY'];
  if (typeof hex !== 'string' || hex.length !== 64) {
    throw new Error(
      'TOKEN_CIPHER_KEY must be a 64-character hex string (32 bytes). ' +
        "Generate with: node -e \"process.stdout.write(require('crypto').randomBytes(32).toString('hex') + '\\n')\"",
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * The key is read from the `TOKEN_CIPHER_KEY` environment variable
 * (a 64-character hex string representing 32 bytes).
 *
 * @param plain - The plaintext string to encrypt.
 * @returns A colon-delimited string `iv:authTag:ciphertext` where every
 *   segment is hex-encoded. This value is safe to store in MongoDB.
 * @throws Error if TOKEN_CIPHER_KEY is missing or invalid.
 */
export function encrypt(plain: string): string {
  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts a value produced by {@link encrypt}.
 *
 * @param encrypted - A colon-delimited `iv:authTag:ciphertext` hex string.
 * @returns The original plaintext string.
 * @throws Error if the format is invalid, the key is wrong, or authentication fails.
 */
export function decrypt(encrypted: string): string {
  const key = resolveKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid encrypted token format: expected "iv:authTag:ciphertext", got ${parts.length} segment(s).`,
    );
  }
  const [ivHex, tagHex, cipherHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex').slice(0, TAG_LENGTH);
  const ciphertext = Buffer.from(cipherHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
