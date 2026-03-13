import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service.js';
import { UserDocument } from '../../users/schemas/user.schema.js';

export interface JwtPayload {
  sub: string;   // MongoDB user _id
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT Bearer strategy — validates the token on every protected request.
 * Token is extracted from the Authorization: Bearer <token> header.
 * Uses RS256 asymmetric verification with the RSA public key.
 *
 * Required env vars: JWT_PRIVATE_KEY, JWT_PUBLIC_KEY (base64-encoded PEM)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: Buffer.from(
        process.env['JWT_PUBLIC_KEY'] ?? '',
        'base64'
      ).toString('utf8'),
      algorithms: ['RS256'],
    });
  }

  /**
   * Called by Passport after the token signature is verified.
   * Attaches the user document to req.user.
   */
  async validate(payload: JwtPayload): Promise<UserDocument> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
