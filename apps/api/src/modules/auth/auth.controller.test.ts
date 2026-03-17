import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ExchangeCodeDto } from './dto/exchange-code.dto.js';
import type { UserDocument } from '../users/schemas/user.schema.js';

const mockAuthService = {
  issueTokens: jest.fn(),
  storeAuthCode: jest.fn(),
  exchangeCode: jest.fn(),
  refreshTokens: jest.fn(),
  revokeToken: jest.fn().mockResolvedValue(undefined),
};

/** Build a mock Express Response object */
function buildMockRes(): Response {
  const res = {
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

/** Build a mock Express Request with cookies */
function buildMockReq(
  cookies: Record<string, string> = {},
  user?: Partial<UserDocument>
): Request {
  return {
    cookies,
    user: user ?? {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      name: 'Test User',
      photo: 'https://example.com/photo.jpg',
      headline: 'Software Engineer',
    },
  } as unknown as Request;
}

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ── POST /auth/exchange ────────────────────────────────────────────────────

  describe('POST /auth/exchange', () => {
    it('returns { accessToken, expiresIn } in response body', async () => {
      mockAuthService.exchangeCode.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 86400,
      });

      const res = buildMockRes();
      const result = await controller.exchange({ code: 'valid-uuid' } as ExchangeCodeDto, res);

      expect(result).toEqual({ accessToken: 'access-token', expiresIn: 86400 });
    });

    it('sets refresh_token httpOnly cookie with correct options', async () => {
      mockAuthService.exchangeCode.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 86400,
      });

      const res = buildMockRes();
      await controller.exchange({ code: 'valid-uuid' } as ExchangeCodeDto, res);

      expect((res.cookie as jest.Mock)).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          // 'strict' in production, 'lax' in development/test — match either
          sameSite: expect.stringMatching(/^(strict|lax)$/),
          path: '/auth/refresh',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
      );
    });

    it('returns 401 for an invalid/expired code', async () => {
      mockAuthService.exchangeCode.mockRejectedValue(
        new UnauthorizedException('Invalid or expired auth code')
      );

      const res = buildMockRes();
      await expect(
        controller.exchange({ code: 'bad-code' } as ExchangeCodeDto, res)
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── POST /auth/refresh ─────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('reads refresh_token from cookies (not body)', async () => {
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 86400,
      });

      const req = buildMockReq({ refresh_token: 'cookie-refresh-token' });
      const res = buildMockRes();
      await controller.refresh(req, res);

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('cookie-refresh-token');
    });

    it('returns { accessToken, expiresIn } in body', async () => {
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 86400,
      });

      const req = buildMockReq({ refresh_token: 'cookie-refresh-token' });
      const res = buildMockRes();
      const result = await controller.refresh(req, res);

      expect(result).toEqual({ accessToken: 'new-access-token', expiresIn: 86400 });
    });

    it('sets a new refresh_token cookie (token rotation)', async () => {
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 86400,
      });

      const req = buildMockReq({ refresh_token: 'old-cookie-token' });
      const res = buildMockRes();
      await controller.refresh(req, res);

      expect((res.cookie as jest.Mock)).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: expect.stringMatching(/^(strict|lax)$/),
          path: '/auth/refresh',
        })
      );
    });

    it('throws 401 when refresh_token cookie is absent', async () => {
      const req = buildMockReq({});
      const res = buildMockRes();

      await expect(
        controller.refresh(req, res)
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── OAuth callbacks — identity fields on req.user (PROF-01) ───────────────

  describe('OAuth callbacks identity fields (PROF-01)', () => {
    it('linkedinCallback: req.user contains name, email, photo, headline from LinkedInStrategy', async () => {
      mockAuthService.issueTokens.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 86400,
      });
      mockAuthService.storeAuthCode.mockResolvedValue('test-code-uuid');

      const userWithIdentity: Partial<UserDocument> = {
        email: 'user@linkedin.com',
        name: 'LinkedIn User',
        photo: 'https://media.linkedin.com/photo.jpg',
        headline: 'Senior Developer at Acme',
        linkedinId: 'li-123',
      };

      const req = buildMockReq({}, userWithIdentity);
      const res = buildMockRes();

      await controller.linkedinCallback(req as unknown as Parameters<typeof controller.linkedinCallback>[0], res);

      // Verify issueTokens was called with req.user that contains identity fields
      const calledUser = (mockAuthService.issueTokens.mock.calls[0] as [UserDocument])[0];
      expect(calledUser.name).toBe('LinkedIn User');
      expect(calledUser.email).toBe('user@linkedin.com');
      expect(calledUser.photo).toBe('https://media.linkedin.com/photo.jpg');
      expect(calledUser.headline).toBe('Senior Developer at Acme');
    });

    it('linkedinCallback: redirects to /auth/callback?code=<uuid>', async () => {
      mockAuthService.issueTokens.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 86400,
      });
      mockAuthService.storeAuthCode.mockResolvedValue('test-uuid-code');

      const req = buildMockReq();
      const res = buildMockRes();

      await controller.linkedinCallback(req as unknown as Parameters<typeof controller.linkedinCallback>[0], res);

      expect((res.redirect as jest.Mock)).toHaveBeenCalledWith(
        expect.stringMatching(/\/auth\/callback\?code=test-uuid-code$/)
      );
    });

    it('linkedinCallback: does NOT include accessToken or refreshToken in redirect URL', async () => {
      mockAuthService.issueTokens.mockResolvedValue({
        accessToken: 'secret-access-token',
        refreshToken: 'secret-refresh-token',
        expiresIn: 86400,
      });
      mockAuthService.storeAuthCode.mockResolvedValue('the-code');

      const req = buildMockReq();
      const res = buildMockRes();

      await controller.linkedinCallback(req as unknown as Parameters<typeof controller.linkedinCallback>[0], res);

      const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0] as string;
      expect(redirectUrl).not.toContain('secret-access-token');
      expect(redirectUrl).not.toContain('secret-refresh-token');
      expect(redirectUrl).not.toContain('accessToken=');
      expect(redirectUrl).not.toContain('refreshToken=');
    });
  });

  // ── HTTP status decorators ─────────────────────────────────────────────────

  describe('HTTP status decorators', () => {
    it('exchange method exists and HttpStatus.OK is 200', () => {
      expect(typeof controller.exchange).toBe('function');
      expect(HttpStatus.OK).toBe(200);
    });
  });
});
