import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { requestContext } from '@job-agent/logger';

/**
 * Reads or generates a correlation ID per request and stores it in the
 * AsyncLocalStorage requestContext. Every log call made during that request
 * automatically includes the correlationId.
 *
 * The correlation ID is also reflected back in the X-Correlation-Id response header.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  /**
   * Sets up the per-request AsyncLocalStorage context before the handler runs.
   * Reads X-Correlation-Id from incoming headers or generates a new UUID.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ??
      crypto.randomUUID();

    res.setHeader('X-Correlation-Id', correlationId);

    return new Observable((subscriber) => {
      requestContext.run({ correlationId }, () => {
        next
          .handle()
          .subscribe({
            next: (value) => subscriber.next(value),
            error: (err: unknown) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
      });
    });
  }
}
