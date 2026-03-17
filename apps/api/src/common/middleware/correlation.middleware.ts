import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { requestContext } from '@job-agent/logger';

/**
 * Sets up the per-request correlationId in AsyncLocalStorage BEFORE guards run.
 *
 * NestJS execution order: Middleware → Guards → Interceptors → Handler
 * The old CorrelationInterceptor ran too late — guard errors (e.g. JWT 401)
 * logged correlationId as "unknown" because the interceptor hadn't fired yet.
 *
 * This middleware runs first, so every log line — including auth failures —
 * carries the correct correlationId.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ??
      crypto.randomUUID();

    res.setHeader('X-Correlation-Id', correlationId);

    requestContext.run({ correlationId }, next);
  }
}
