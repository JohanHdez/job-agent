import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { UsersService } from '../../users/users.service.js';
import { UserDocument } from '../../users/schemas/user.schema.js';

/** Shape of the LinkedIn OIDC /userinfo response */
interface LinkedInUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
  headline?: string;
}

/**
 * LinkedIn Sign In with OpenID Connect (OIDC) — Passport strategy.
 *
 * Uses passport-oauth2 base strategy + LinkedIn's /oidc/userinfo endpoint
 * because passport-linkedin-oauth2 targets the deprecated v2 API and does
 * not support OIDC scopes (openid, profile, email).
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
      authorizationURL: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenURL: 'https://www.linkedin.com/oauth/v2/accessToken',
      clientID: process.env['LINKEDIN_CLIENT_ID'] ?? '',
      clientSecret: process.env['LINKEDIN_CLIENT_SECRET'] ?? '',
      callbackURL: process.env['LINKEDIN_CALLBACK_URL'] ?? 'http://localhost:3001/auth/linkedin/callback',
      scope: ['openid', 'profile', 'email'],
    });
  }

  /**
   * Called after LinkedIn exchanges the code for an access token.
   * Fetches the OIDC userinfo and upserts the user in MongoDB.
   */
  async validate(accessToken: string): Promise<UserDocument> {
    const res = await fetch('https://api.linkedin.com/oidc/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`LinkedIn userinfo fetch failed: ${res.status} ${res.statusText}`);
    }

    const info = (await res.json()) as LinkedInUserInfo;

    const email = info.email ?? `${info.sub}@linkedin.noemail`;
    const fullName = [info.given_name, info.family_name].filter(Boolean).join(' ');
    const name = info.name ?? (fullName || 'LinkedIn User');

    return this.usersService.upsertFromLinkedIn({
      linkedinId: info.sub,
      email,
      name,
      ...(info.picture ? { photo: info.picture } : {}),
      ...(info.headline ? { headline: info.headline } : {}),
      accessToken,
    });
  }
}
