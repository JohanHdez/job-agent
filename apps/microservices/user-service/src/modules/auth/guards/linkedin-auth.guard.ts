import { Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Initiates the LinkedIn OAuth 2.0 redirect flow.
 * - If LinkedIn credentials are not configured, redirects to the frontend with
 *   an error instead of crashing with a 500 (checked at request time so that
 *   ConfigModule has already populated process.env).
 * - On callback errors (expired code, user denied) redirects to /login?error=.
 */
@Injectable()
export class LinkedInAuthGuard extends AuthGuard('linkedin') {
  private readonly logger = new Logger(LinkedInAuthGuard.name);

  override canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    // Read at request time — ConfigModule has already run dotenv by now
    const configured =
      !!process.env['LINKEDIN_CLIENT_ID'] &&
      process.env['LINKEDIN_CLIENT_ID'] !== 'not-configured';
    if (!configured) {
      const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (context.switchToHttp().getResponse() as { redirect: (url: string) => void }).redirect(
        `${frontendUrl}/login?error=linkedin_not_configured`,
      );
      return false;
    }
    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  override handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      this.logger.error('LinkedIn OAuth failed', {
        error: err?.message ?? err,
        info,
        hint:
          'Verify: (1) LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET are set, ' +
          '(2) "Sign In with LinkedIn using OpenID Connect" product is enabled in the LinkedIn Developer Portal, ' +
          '(3) callback URL http://localhost:3001/auth/linkedin/callback is in the Authorized Redirect URLs list.',
      });
      const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (context.switchToHttp().getResponse() as { redirect: (url: string) => void }).redirect(
        `${frontendUrl}/login?error=linkedin_failed`,
      );
      return false as unknown as TUser;
    }
    return user;
  }
}
