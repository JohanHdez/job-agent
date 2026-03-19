import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import type { Logger } from 'winston';
import { LOGGER } from '../../logger/logger.constants.js';

const FRONTEND_URL = () => process.env['FRONTEND_URL'] ?? 'http://localhost:5173';

/** Initiates the Google OAuth 2.0 redirect flow. Session-less — state stored client-side. */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (err) {
      this.logger.error('Google OAuth failed', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      const res = context.switchToHttp().getResponse<Response>();
      res.redirect(`${FRONTEND_URL()}/login?error=google_auth_failed`);
      return false;
    }
  }

  getAuthenticateOptions() {
    return { session: false };
  }
}
