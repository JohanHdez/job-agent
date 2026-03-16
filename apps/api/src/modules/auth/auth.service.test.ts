import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import { Types } from 'mongoose';

const mockUser = {
  _id: new Types.ObjectId(),
  email: 'test@example.com',
  name: 'Test User',
  refreshTokens: [],
} as unknown as UserDocument;

/**
 * AuthService unit tests — Phase 2, Plan 02.
 * Tests AUTH-01/02 (issueTokens) and AUTH-03 (refreshTokens rotation).
 */
describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<Partial<UsersService>>;

  beforeEach(async () => {
    const mockJwt = { sign: jest.fn().mockReturnValue('mock-access-token') };
    const mockUsers = {
      addRefreshToken: jest.fn().mockResolvedValue(undefined),
      validateRefreshToken: jest.fn(),
      removeRefreshToken: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwt },
        { provide: UsersService, useValue: mockUsers },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    usersService = module.get(UsersService) as jest.Mocked<Partial<UsersService>>;
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  // AUTH-01, AUTH-02
  describe('issueTokens', () => {
    it('returns accessToken, refreshToken, and expiresIn: 86400', async () => {
      const result = await service.issueTokens(mockUser);
      expect(result.accessToken).toBe('mock-access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(20);
      expect(result.expiresIn).toBe(86400);
    });

    it('signs JWT with sub, email, and name payload', async () => {
      await service.issueTokens(mockUser);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com', name: 'Test User' }),
        expect.any(Object)
      );
    });
  });

  // AUTH-03
  describe('refreshTokens', () => {
    it('issues new tokens when refresh token is valid', async () => {
      (usersService.validateRefreshToken as jest.Mock).mockResolvedValue(mockUser);
      const result = await service.refreshTokens('valid-token');
      expect(result.accessToken).toBe('mock-access-token');
      expect(usersService.removeRefreshToken).toHaveBeenCalled();
    });

    it('throws UnauthorizedException when refresh token is invalid', async () => {
      (usersService.validateRefreshToken as jest.Mock).mockResolvedValue(null);
      await expect(service.refreshTokens('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
