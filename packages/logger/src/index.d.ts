/**
 * Structured Logger Factory — packages/logger/src/index.ts
 *
 * Creates a Winston logger that automatically attaches:
 *   - service name (passed at creation time)
 *   - correlationId (injected per-request via AsyncLocalStorage)
 *   - userId (injected per-request via AsyncLocalStorage)
 *   - ISO timestamp
 *
 * Usage:
 *   const logger = createLogger('api');
 *   logger.info('Server started', { port: 3000 });
 *
 * Correlation context is populated by the correlationMiddleware in server.ts.
 */
import { AsyncLocalStorage } from 'async_hooks';
import winston from 'winston';
export interface RequestContext {
    correlationId: string;
    userId?: string;
}
/** Shared storage — one active entry per request, isolated by async context */
export declare const requestContext: AsyncLocalStorage<RequestContext>;
/**
 * Creates a structured Winston logger bound to a service name.
 *
 * In development (NODE_ENV !== 'production') logs are human-readable.
 * In production logs are JSON for log aggregators (Datadog, Loki, etc.).
 *
 * @param serviceName - Label identifying which service/package emits the log.
 */
export declare function createLogger(serviceName: string): winston.Logger;
//# sourceMappingURL=index.d.ts.map