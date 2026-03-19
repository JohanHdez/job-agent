import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import type { Logger } from 'winston';
import { LOGGER } from '../../modules/logger/logger.constants.js';

/**
 * HTTP logging interceptor — emits a structured log line for every request.
 *
 * On entry:  INFO  → GET /auth/me
 * On success: INFO  ← 200 GET /auth/me (12ms)
 *
 * Errors are NOT logged here — the HttpExceptionFilter handles them with
 * the full stack trace.  This interceptor only fires on successful responses.
 *
 * Registered as APP_INTERCEPTOR (after CorrelationInterceptor) so the
 * correlationId is already set in AsyncLocalStorage when these lines execute.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const start = Date.now();
    this.logger.info(`→ ${req.method} ${req.url}`);

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.info(`← ${res.statusCode} ${req.method} ${req.url} (${ms}ms)`);
      })
    );
  }
}
