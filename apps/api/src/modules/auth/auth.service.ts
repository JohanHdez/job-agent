import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'crypto';
import { Types } from 'mongoose';
import type Redis from 'ioredis';
import { UsersService } from '../users/users.service.js';
import { UserDocument } from '../users/schemas/user.schema.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';
import { REDIS_CLIENT } from '../../common/redis/redis.provider.js';

/** Converts a Mongoose document _id to a plain string. */
function toId(id: unknown): string {
  if (id instanceof Types.ObjectId) return id.toHexString();
  return String(id);
}

/** Shape of the token pair returned to the client */
export interface TokenPairDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const REFRESH_TOKEN_TTL_DAYS = 7;

/** TTL for one-time auth codes used in the code-exchange flow */
const AUTH_CODE_TTL_SECONDS = 30;

/**
 * Handles JWT issuance, rotation, revocation, and the Redis-backed
 * one-time code-exchange flow for secure OAuth callbacks.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis
  ) {}

  /**
   * Issues a new access + refresh token pair for a user.
   * Called after successful OAuth login.
   */
  async issueTokens(user: UserDocument): Promise<TokenPairDto> {
    const payload: JwtPayload = {
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
      REFRESH_TOKEN_TTL_DAYS
    );

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  /**
   * Stores a token pair in Redis under a one-time UUID code.
   * The code expires after AUTH_CODE_TTL_SECONDS (30s).
   * Used by OAuth callbacks to avoid putting tokens in URL params.
   *
   * @param tokens - The token pair to store.
   * @returns A UUID v4 string that can be exchanged once for the tokens.
   */
  async storeAuthCode(tokens: TokenPairDto): Promise<string> {
    const code = randomUUID();
    const key = `auth:code:${code}`;
    await this.redis.setex(key, AUTH_CODE_TTL_SECONDS, JSON.stringify(tokens));
    return code;
  }

  /**
   * Exchanges a one-time auth code for its associated token pair.
   * The code is consumed atomically — it cannot be reused.
   *
   * @param code - The UUID v4 code issued by storeAuthCode().
   * @throws UnauthorizedException if the code is invalid, expired, or already used.
   */
  async exchangeCode(code: string): Promise<TokenPairDto> {
    const key = `auth:code:${code}`;
    const raw = await this.redis.getdel(key);
    if (!raw) throw new UnauthorizedException('Invalid or expired auth code');
    return JSON.parse(raw) as TokenPairDto;
  }

  /**
   * Validates a refresh token and issues a new token pair (rotation).
   * The old refresh token is revoked after use.
   * @throws UnauthorizedException if the token is invalid or expired.
   */
  async refreshTokens(refreshToken: string): Promise<TokenPairDto> {
    const user = await this.usersService.validateRefreshToken(refreshToken);
    if (!user) throw new UnauthorizedException('Invalid or expired refresh token');

    // Revoke the used token (rotation — prevents replay attacks)
    await this.usersService.removeRefreshToken(
      toId(user._id),
      refreshToken
    );

    return this.issueTokens(user);
  }

  /**
   * Revokes a refresh token (user logout).
   */
  async revokeToken(userId: string, refreshToken: string): Promise<void> {
    await this.usersService.removeRefreshToken(userId, refreshToken);
  }
}
