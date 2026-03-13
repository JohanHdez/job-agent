import { Injectable, ExecutionContext } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Global JWT guard — applied to all routes as APP_GUARD.
 * Routes decorated with @Public() bypass JWT validation.
 * All other routes require a valid Bearer token in the Authorization header.
 *
 * Uses HS256 with JWT_SECRET in Phase 1.
 * RS256 with asymmetric keys is deferred to Phase 2 (OAuth token issuance).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Returns true immediately for @Public() routes.
   * Delegates to the passport JWT strategy for all other routes.
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }
}
