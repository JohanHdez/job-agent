import { encryptToken, decryptToken } from './token-cipher.js';

// 64-char hex = 32 bytes for AES-256
const VALID_KEY = '0'.repeat(64);

describe('token-cipher', () => {
  beforeAll(() => {
    process.env['TOKEN_CIPHER_KEY'] = VALID_KEY;
  });

  afterAll(() => {
    delete process.env['TOKEN_CIPHER_KEY'];
  });

  // ── encryptToken ───────────────────────────────────────────────────────────

  describe('encryptToken()', () => {
    it('returns a string in "iv:authTag:ciphertext" format (3 hex segments)', () => {
      const result = encryptToken('my-secret-token');

      expect(typeof result).toBe('string');
      const parts = result.split(':');
      expect(parts).toHaveLength(3);

      // Each part must be a non-empty hex string
      for (const part of parts) {
        expect(part).toMatch(/^[0-9a-f]+$/i);
        expect(part.length).toBeGreaterThan(0);
      }
    });

    it('produces different ciphertexts on each call (random IV)', () => {
      const plaintext = 'same-plaintext';
      const first = encryptToken(plaintext);
      const second = encryptToken(plaintext);

      expect(first).not.toBe(second);
    });
  });

  // ── decryptToken ───────────────────────────────────────────────────────────

  describe('decryptToken()', () => {
    it('round-trips correctly: decryptToken(encryptToken(x)) === x', () => {
      const original = 'my-secret-refresh-token-value';
      const encrypted = encryptToken(original);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(original);
    });

    it('round-trips with unicode content', () => {
      const original = 'token-with-unicode-\u00e9\u00e0\u00fc';
      expect(decryptToken(encryptToken(original))).toBe(original);
    });

    it('throws an Error when given corrupted ciphertext', () => {
      // Corrupt the ciphertext portion (third segment) by changing hex chars
      const encrypted = encryptToken('some-value');
      const parts = encrypted.split(':');
      // Replace last char of ciphertext with different hex digit
      const corrupted = [
        parts[0],
        parts[1],
        parts[2]!.slice(0, -2) + 'ff',
      ].join(':');

      expect(() => decryptToken(corrupted)).toThrow();
    });

    it('throws an Error for wrong format (not 3 colon-separated parts)', () => {
      expect(() => decryptToken('onlytwoparts:here')).toThrow('Invalid encrypted token format');
    });
  });

  // ── missing key ────────────────────────────────────────────────────────────

  describe('missing TOKEN_CIPHER_KEY', () => {
    it('encryptToken() throws Error when key is missing', () => {
      const savedKey = process.env['TOKEN_CIPHER_KEY'];
      delete process.env['TOKEN_CIPHER_KEY'];

      try {
        expect(() => encryptToken('test')).toThrow(Error);
      } finally {
        process.env['TOKEN_CIPHER_KEY'] = savedKey;
      }
    });

    it('decryptToken() throws Error when key is missing', () => {
      const savedKey = process.env['TOKEN_CIPHER_KEY'];
      delete process.env['TOKEN_CIPHER_KEY'];

      try {
        expect(() => decryptToken('aa:bb:cc')).toThrow(Error);
      } finally {
        process.env['TOKEN_CIPHER_KEY'] = savedKey;
      }
    });
  });
});
