import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-linkedin-oauth2';
import { UsersService } from '../../users/users.service.js';
import { UserDocument } from '../../users/schemas/user.schema.js';

interface LinkedInProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
  _json?: { headline?: string };
}

/**
 * LinkedIn OAuth 2.0 Passport strategy.
 * Scopes: openid, profile, email (LinkedIn OIDC scopes).
 *
 * Required env vars:
 *   LINKEDIN_CLIENT_ID
 *   LINKEDIN_CLIENT_SECRET
 *   LINKEDIN_CALLBACK_URL  (e.g. http://localhost:3001/auth/linkedin/callback)
 */
@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor(private readonly usersService: UsersService) {
    super({
      clientID: process.env['LINKEDIN_CLIENT_ID'] ?? '',
      clientSecret: process.env['LINKEDIN_CLIENT_SECRET'] ?? '',
      callbackURL: process.env['LINKEDIN_CALLBACK_URL'] ?? 'http://localhost:3001/auth/linkedin/callback',
      scope: ['openid', 'profile', 'email'],
    });
  }

  /**
   * Called after LinkedIn redirects back with a valid access token.
   * Creates or updates the user in MongoDB and returns the user document.
   */
  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: LinkedInProfile
  ): Promise<UserDocument> {
    const email = profile.emails?.[0]?.value ?? `${profile.id}@linkedin.noemail`;
    const photo = profile.photos?.[0]?.value;
    const headline = profile._json?.headline;

    return this.usersService.upsertFromLinkedIn({
      linkedinId: profile.id,
      email,
      name: profile.displayName,
      ...(photo ? { photo } : {}),
      ...(headline ? { headline } : {}),
      accessToken,
    });
  }
}
