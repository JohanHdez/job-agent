import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LinkedInAuthGuard } from './guards/linkedin-auth.guard.js';
import { GoogleAuthGuard } from './guards/google-auth.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { UserDocument } from '../users/schemas/user.schema.js';
import { ExchangeCodeDto } from './dto/exchange-code.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';

interface AuthenticatedRequest extends Request {
  user: UserDocument;
}

const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';

/** Cookie options for the refresh token */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/auth/refresh',
};

/**
 * Auth controller — handles all OAuth flows and JWT token management.
 *
 * Flow:
 *  1. Browser hits /auth/linkedin or /auth/google → redirects to provider
 *  2. Provider redirects to callback → stores tokens in Redis as one-time code
 *  3. Browser follows redirect to /auth/callback?code=<uuid>
 *  4. Frontend POSTs code to /auth/exchange → receives accessToken in body + httpOnly cookie
 *  5. Frontend uses accessToken for API calls; refresh via /auth/refresh (cookie-based)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── LinkedIn OAuth ─────────────────────────────────────────────────────────

  /**
   * GET /auth/linkedin
   * Redirects the browser to LinkedIn's OAuth consent page.
   */
  @Get('linkedin')
  @UseGuards(LinkedInAuthGuard)
  linkedinLogin(): void {
    // Passport redirects — no body needed
  }

  /**
   * GET /auth/linkedin/callback
   * LinkedIn redirects here after the user grants permission.
   * Stores tokens in Redis and redirects with a one-time code (no tokens in URL).
   */
  @Get('linkedin/callback')
  @UseGuards(LinkedInAuthGuard)
  async linkedinCallback(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    try {
      const tokens = await this.authService.issueTokens(req.user);
      const code = await this.authService.storeAuthCode(tokens);
      res.redirect(`${FRONTEND_URL}/auth/callback?code=${code}`);
    } catch {
      res.redirect(`${FRONTEND_URL}/login?error=linkedin_auth_failed`);
    }
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────

  /**
   * GET /auth/google
   * Redirects the browser to Google's OAuth consent page.
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {
    // Passport redirects — no body needed
  }

  /**
   * GET /auth/google/callback
   * Google redirects here after the user grants permission.
   * Stores tokens in Redis and redirects with a one-time code (no tokens in URL).
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    try {
      const tokens = await this.authService.issueTokens(req.user);
      const code = await this.authService.storeAuthCode(tokens);
      res.redirect(`${FRONTEND_URL}/auth/callback?code=${code}`);
    } catch {
      res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
    }
  }

  // ── Code-exchange ──────────────────────────────────────────────────────────

  /**
   * POST /auth/exchange
   * Exchanges a one-time auth code for an access token.
   * Sets the refresh token as an httpOnly Secure SameSite=Strict cookie.
   *
   * @param body - { code: UUID v4 } from the OAuth callback redirect
   * @returns { accessToken: string; expiresIn: number }
   */
  @Post('exchange')
  @HttpCode(200)
  @Public()
  async exchange(
    @Body() body: ExchangeCodeDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const tokens = await this.authService.exchangeCode(body.code);
    res.cookie('refresh_token', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // ── JWT token management ───────────────────────────────────────────────────

  /**
   * POST /auth/refresh
   * Reads the refresh token from the httpOnly cookie and issues a new token pair.
   * Sets a new refresh token cookie (rotation).
   *
   * @throws UnauthorizedException if the cookie is absent or the token is invalid.
   */
  @Post('refresh')
  @HttpCode(200)
  @Public()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const cookies = req.cookies as Record<string, string | undefined>;
    const refreshToken = cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token cookie');
    }
    const tokens = await this.authService.refreshTokens(refreshToken);
    // Rotate the refresh token cookie
    res.cookie('refresh_token', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  /**
   * POST /auth/logout
   * Revokes the refresh token from the httpOnly cookie.
   * Requires a valid JWT access token in the Authorization header.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response
  ) {
    const cookies = req.cookies as Record<string, string | undefined>;
    const refreshToken = cookies['refresh_token'];
    if (refreshToken) {
      await this.authService.revokeToken(
        req.user._id instanceof Types.ObjectId ? req.user._id.toHexString() : String(req.user._id),
        refreshToken
      );
    }
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * GET /auth/me
   * Returns the authenticated user's profile.
   * Requires a valid JWT access token.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    return {
      id: user._id instanceof Types.ObjectId ? user._id.toHexString() : String(user._id),
      email: user.email,
      name: user.name,
      photo: user.photo,
      headline: user.headline,
      providers: {
        linkedin: !!user.linkedinId,
        google: !!user.googleId,
      },
    };
  }
}
