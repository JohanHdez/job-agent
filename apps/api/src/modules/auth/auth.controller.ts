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

interface RefreshBody {
  refreshToken?: string;
}

interface AuthenticatedRequest extends Request {
  user: UserDocument;
}

const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';

/**
 * Auth controller — handles all OAuth flows and JWT token management.
 * All /auth/* routes are public (excluded from global JWT guard).
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
   * Issues JWT tokens and redirects to the frontend.
   */
  @Get('linkedin/callback')
  @UseGuards(LinkedInAuthGuard)
  async linkedinCallback(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    try {
      const tokens = await this.authService.issueTokens(req.user);
      const params = new URLSearchParams({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: String(tokens.expiresIn),
      });
      res.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`);
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
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    try {
      const tokens = await this.authService.issueTokens(req.user);
      const params = new URLSearchParams({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: String(tokens.expiresIn),
      });
      res.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`);
    } catch {
      res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
    }
  }

  // ── JWT token management ───────────────────────────────────────────────────

  /**
   * POST /auth/refresh
   * Exchanges a valid refresh token for a new access + refresh token pair.
   * The old refresh token is revoked (rotation).
   */
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: RefreshBody) {
    if (!body.refreshToken) {
      throw new UnauthorizedException('refreshToken is required');
    }
    return this.authService.refreshTokens(body.refreshToken);
  }

  /**
   * POST /auth/logout
   * Revokes the provided refresh token.
   * Requires a valid JWT access token in the Authorization header.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Body() body: RefreshBody
  ) {
    if (body.refreshToken) {
      await this.authService.revokeToken(
        req.user._id instanceof Types.ObjectId ? req.user._id.toHexString() : String(req.user._id),
        body.refreshToken
      );
    }
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
