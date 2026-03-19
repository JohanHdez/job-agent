import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type { Logger } from 'winston';
import { requestContext } from '@job-agent/logger';
import { LOGGER } from '../../modules/logger/logger.constants.js';

/**
 * Global exception filter — catches every unhandled exception and logs it
 * with full context (method, url, status, correlationId, message, stack).
 *
 * Registered as APP_FILTER in AppModule so it runs for every route.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = resolveMessage(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    const correlationId = requestContext.getStore()?.correlationId ?? 'unknown';

    this.logger.error('Request failed', {
      method: req.method,
      url: req.url,
      status,
      correlationId,
      message,
      stack,
    });

    res.status(status).json({
      statusCode: status,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}

function resolveMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    const obj = response as Record<string, unknown>;
    const msg = obj['message'];
    return Array.isArray(msg) ? msg.join(', ') : typeof msg === 'string' ? msg : exception.message;
  }
  if (exception instanceof Error) return exception.message;
  return 'Internal server error';
}
