import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { UsersService } from '../../users/users.service.js';
import type { UserDocument } from '../../users/schemas/user.schema.js';

interface LinkedInOidcUserInfo {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
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
      clientID: process.env['LINKEDIN_CLIENT_ID'] || 'not-configured',
      clientSecret: process.env['LINKEDIN_CLIENT_SECRET'] || 'not-configured',
      callbackURL:
        process.env['LINKEDIN_CALLBACK_URL'] ??
        'http://localhost:3001/auth/linkedin/callback',
      scope: ['openid', 'profile', 'email'],
    });
  }

  /**
   * Called after LinkedIn exchanges the code for an access token.
   * Fetches the OIDC userinfo and upserts the user in MongoDB.
   *
   * @param accessToken  - LinkedIn OAuth 2.0 access token
   * @param _refreshToken - Not used (LinkedIn does not issue refresh tokens for OIDC)
   * @param _results      - Raw token response from LinkedIn (not used)
   */
  async validate(
    accessToken: string,
    _refreshToken: string,
    _results: unknown,
  ): Promise<UserDocument> {
    const res = await fetch('https://api.linkedin.com/oidc/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `LinkedIn userinfo fetch failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`,
      );
    }
    const info = (await res.json()) as LinkedInOidcUserInfo;
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
