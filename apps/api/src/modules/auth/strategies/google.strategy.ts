import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { UsersService } from '../../users/users.service.js';
import { UserDocument } from '../../users/schemas/user.schema.js';

/**
 * Google OAuth 2.0 Passport strategy.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_CALLBACK_URL  (e.g. http://localhost:3001/auth/google/callback)
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly usersService: UsersService) {
    super({
      clientID: process.env['GOOGLE_CLIENT_ID'] ?? '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
      callbackURL: process.env['GOOGLE_CALLBACK_URL'] ?? 'http://localhost:3001/auth/google/callback',
      scope: ['openid', 'profile', 'email'],
      state: false,
    });
  }

  /**
   * Called after Google redirects back with a valid access token.
   * Links accounts when the same email exists from a LinkedIn registration.
   */
  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile
  ): Promise<UserDocument> {
    const email = profile.emails?.[0]?.value ?? `${profile.id}@google.noemail`;
    const photo = profile.photos?.[0]?.value;

    return this.usersService.upsertFromGoogle({
      googleId: profile.id,
      email,
      name: profile.displayName,
      ...(photo ? { photo } : {}),
    });
  }
}
