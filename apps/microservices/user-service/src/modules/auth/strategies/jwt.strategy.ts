import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { UsersService } from '../../users/users.service.js';
import type { UserDocument } from '../../users/schemas/user.schema.js';

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
}

/**
 * JWT Bearer strategy — validates the token on every protected request.
 * Token is extracted from the Authorization: Bearer <token> header.
 *
 * Required env var: JWT_SECRET
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env['JWT_SECRET'] ?? 'change-me-in-production',
    });
  }

  /**
   * Called by Passport after the token signature is verified.
   * Attaches the user document to req.user.
   */
  async validate(payload: JwtPayload): Promise<UserDocument> {
    const user = await this.usersService.findById(payload.sub, payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
