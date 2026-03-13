import { encryptToken, decryptToken } from './token-cipher.js';

/**
 * Unit tests for token-cipher utility.
 * Pure functions — no DI, no async, tested directly.
 *
 * TOKEN_CIPHER_KEY is set in beforeAll to a valid 64-char hex string.
 */
describe('token-cipher', () => {
  const VALID_KEY = 'a'.repeat(64); // 64-char hex = 32 bytes

  beforeAll(() => {
    process.env['TOKEN_CIPHER_KEY'] = VALID_KEY;
  });

  afterAll(() => {
    delete process.env['TOKEN_CIPHER_KEY'];
  });

  it('round-trip: encrypt then decrypt recovers original plaintext', () => {
    const plain = 'test-secret-token-12345';
    const encrypted = encryptToken(plain);
    expect(decryptToken(encrypted)).toBe(plain);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const plain = 'same-value';
    expect(encryptToken(plain)).not.toBe(encryptToken(plain));
  });

  it('throws on malformed ciphertext', () => {
    expect(() => decryptToken('not:valid')).toThrow();
  });
});
