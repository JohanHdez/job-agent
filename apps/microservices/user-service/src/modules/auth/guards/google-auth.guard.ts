import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Initiates the Google OAuth 2.0 redirect flow.
 * - If Google credentials are not configured, redirects to the frontend with
 *   an error instead of crashing with a 500 (checked at request time so that
 *   ConfigModule has already populated process.env).
 * - On callback errors redirects to /login?error=google_failed.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  override canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    // Read at request time — ConfigModule has already run dotenv by now
    const configured =
      !!process.env['GOOGLE_CLIENT_ID'] &&
      process.env['GOOGLE_CLIENT_ID'] !== 'not-configured';
    if (!configured) {
      const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (context.switchToHttp().getResponse() as { redirect: (url: string) => void }).redirect(
        `${frontendUrl}/login?error=google_not_configured`,
      );
      return false;
    }
    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err ?? !user) {
      const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (context.switchToHttp().getResponse() as { redirect: (url: string) => void }).redirect(
        `${frontendUrl}/login?error=google_failed`,
      );
      return false as unknown as TUser;
    }
    return user;
  }
}
