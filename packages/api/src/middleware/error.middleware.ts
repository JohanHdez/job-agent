import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/** Typed API error with an optional HTTP status code */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Express error-handling middleware.
 * Must be registered LAST in the middleware chain.
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    logger.warn(`ApiError ${err.statusCode}: ${err.message}`);
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error(`Unhandled error: ${message}`);
  res.status(500).json({ error: message });
}

/**
 * 404 handler — register before errorMiddleware.
 */
export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}
