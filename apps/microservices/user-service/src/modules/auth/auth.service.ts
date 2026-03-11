import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { UsersService } from '../users/users.service.js';
import type { UserDocument } from '../users/schemas/user.schema.js';

/** Converts a Mongoose document _id to a plain string. */
function toId(id: unknown): string {
  if (id instanceof Types.ObjectId) return id.toHexString();
  return String(id);
}

const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const REFRESH_TOKEN_TTL_DAYS = 7;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Handles JWT issuance, rotation, and revocation.
 * Refresh tokens are stored in MongoDB (production: migrate to Redis).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Issues a new access + refresh token pair for a user.
   * Called after successful OAuth login.
   */
  async issueTokens(user: UserDocument): Promise<TokenPair> {
    const payload = {
      sub: toId(user._id),
      email: user.email,
      name: user.name,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
    const refreshToken = randomBytes(40).toString('hex');
    await this.usersService.addRefreshToken(
      toId(user._id),
      refreshToken,
      REFRESH_TOKEN_TTL_DAYS,
    );
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  /**
   * Validates a refresh token and issues a new token pair (rotation).
   * The old refresh token is revoked after use.
   * @throws UnauthorizedException if the token is invalid or expired.
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const user = await this.usersService.validateRefreshToken(refreshToken);
    if (!user) throw new UnauthorizedException('Invalid or expired refresh token');
    // Revoke the used token (rotation — prevents replay attacks)
    await this.usersService.removeRefreshToken(toId(user._id), refreshToken);
    return this.issueTokens(user);
  }

  /**
   * Revokes a refresh token (user logout).
   */
  async revokeToken(userId: string, refreshToken: string): Promise<void> {
    await this.usersService.removeRefreshToken(userId, refreshToken);
  }
}
