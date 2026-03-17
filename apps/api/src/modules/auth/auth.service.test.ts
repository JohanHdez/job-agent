import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService, TokenPairDto } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { REDIS_CLIENT } from '../../common/redis/redis.provider.js';

const mockRedis = {
  setex: jest.fn(),
  // exchangeCode uses a Lua script via redis.eval (compatible with Redis 3.0+)
  eval: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('signed-access-token'),
};

const mockUsersService = {
  addRefreshToken: jest.fn().mockResolvedValue(undefined),
  removeRefreshToken: jest.fn().mockResolvedValue(undefined),
  validateRefreshToken: jest.fn(),
};

const mockUser = {
  _id: '507f1f77bcf86cd799439011',
  email: 'test@example.com',
  name: 'Test User',
  photo: 'https://example.com/photo.jpg',
  headline: 'Software Engineer',
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── issueTokens ────────────────────────────────────────────────────────────

  describe('issueTokens()', () => {
    it('returns a TokenPairDto with accessToken, refreshToken, and expiresIn', async () => {
      const result = await service.issueTokens(mockUser as unknown as import('../users/schemas/user.schema.js').UserDocument);

      expect(result).toMatchObject({
        accessToken: 'signed-access-token',
        expiresIn: expect.any(Number),
      });
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });
  });

  // ── storeAuthCode ──────────────────────────────────────────────────────────

  describe('storeAuthCode()', () => {
    it('returns a UUID v4 string', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const tokens: TokenPairDto = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 86400,
      };

      const code = await service.storeAuthCode(tokens);

      expect(typeof code).toBe('string');
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(code).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('stores tokens in Redis with 300s TTL (5-minute window for OAuth round-trip)', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const tokens: TokenPairDto = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 86400,
      };

      const code = await service.storeAuthCode(tokens);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `auth:code:${code}`,
        300,
        JSON.stringify(tokens)
      );
    });
  });

  // ── exchangeCode ───────────────────────────────────────────────────────────

  describe('exchangeCode()', () => {
    it('returns TokenPairDto for a valid code', async () => {
      const tokens: TokenPairDto = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 86400,
      };
      // redis.eval returns the serialized token string (Lua GET result)
      mockRedis.eval.mockResolvedValue(JSON.stringify(tokens));

      const result = await service.exchangeCode('valid-uuid-code');

      expect(result).toEqual(tokens);
    });

    it('deletes the code atomically via Lua script (GET + DEL in one round-trip)', async () => {
      const tokens: TokenPairDto = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 86400,
      };
      mockRedis.eval.mockResolvedValue(JSON.stringify(tokens));

      await service.exchangeCode('some-code');

      // eval is called with the Lua script, key count, and the key name
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('GET', KEYS[1])"),
        1,
        'auth:code:some-code'
      );
    });

    it('throws UnauthorizedException for an invalid/expired code', async () => {
      mockRedis.eval.mockResolvedValue(null);

      await expect(service.exchangeCode('invalid-code')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('throws UnauthorizedException for an already-used code (one-time use)', async () => {
      // First call returns the token, second call returns null (already consumed)
      mockRedis.eval
        .mockResolvedValueOnce(
          JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresIn: 86400 })
        )
        .mockResolvedValueOnce(null);

      const code = 'once-use-code';

      // First use succeeds
      await expect(service.exchangeCode(code)).resolves.toBeDefined();

      // Second use throws — key was deleted by the Lua script on first call
      await expect(service.exchangeCode(code)).rejects.toThrow(UnauthorizedException);
    });
  });
});
