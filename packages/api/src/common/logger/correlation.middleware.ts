/**
 * Correlation Middleware
 *
 * Assigns a UUID v4 correlationId to every incoming HTTP request and stores
 * it in AsyncLocalStorage so all downstream log calls automatically include it.
 *
 * The correlationId is also returned in the X-Correlation-Id response header
 * so clients can trace their requests in log aggregators.
 *
 * If the incoming request already carries an X-Correlation-Id header
 * (e.g. forwarded by a gateway), that value is reused.
 */

import type { Request, Response, NextFunction } from 'express';
import { requestContext } from './index.js';

/**
 * Express middleware that injects a correlationId into AsyncLocalStorage
 * for the duration of the request's async execution chain.
 */
export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Reuse an upstream correlationId if present, otherwise generate a new one
  const incoming = req.headers['x-correlation-id'];
  const correlationId =
    typeof incoming === 'string' && incoming.length > 0
      ? incoming
      : crypto.randomUUID();

  // Propagate to response headers for client tracing
  res.setHeader('X-Correlation-Id', correlationId);

  // Run the rest of the request inside the async context
  requestContext.run({ correlationId }, next);
}
