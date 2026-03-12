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
import { AsyncLocalStorage } from 'node:async_hooks';
import winston from 'winston';

/** Shape of the per-request context stored in AsyncLocalStorage */
export interface RequestContext {
  correlationId: string;
  userId?: string;
}

/** Shared storage — one active entry per request, isolated by async context */
export const requestContext = new AsyncLocalStorage<RequestContext>();

// ── Format helpers ────────────────────────────────────────────────────────────

/**
 * Human-readable format for development:
 *   [timestamp] [SERVICE] [correlationId] LEVEL message {meta}
 */
function devFormat(service: string): winston.Logform.Format {
  return winston.format.printf((info) => {
    const ctx = requestContext.getStore();
    const cid = ctx?.correlationId ?? '-';
    const uid = ctx?.userId ? ` uid=${ctx.userId}` : '';
    const ts = String(info['timestamp'] ?? '');
    const svc = `[${service}]`;
    const lvl = info.level.toUpperCase();
    const msg = String(info['message'] ?? '');

    // Print extra metadata (excluding standard fields)
    const { timestamp: _ts, level: _lvl, message: _msg, ...meta } = info as Record<string, unknown>;
    void _ts; void _lvl; void _msg;
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

    return `${ts} ${svc} [${cid}${uid}] ${lvl} ${msg}${metaStr}`;
  });
}

/**
 * JSON format for production:
 *   { timestamp, level, service, correlationId, userId, message, ...meta }
 */
function jsonFormat(service: string): winston.Logform.Format {
  return winston.format.printf((info) => {
    const ctx = requestContext.getStore();
    const entry: Record<string, unknown> = {
      timestamp: String(info['timestamp'] ?? new Date().toISOString()),
      level: info.level,
      service,
      correlationId: ctx?.correlationId ?? 'system',
      userId: ctx?.userId ?? 'anonymous',
      message: String(info['message'] ?? ''),
    };

    // Merge remaining metadata
    const { timestamp: _ts, level: _lvl, message: _msg, ...meta } = info as Record<string, unknown>;
    void _ts; void _lvl; void _msg;
    Object.assign(entry, meta);

    return JSON.stringify(entry);
  });
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates a structured Winston logger bound to a service name.
 *
 * In development (NODE_ENV !== 'production') logs are human-readable.
 * In production logs are JSON for log aggregators (Datadog, Loki, etc.).
 *
 * @param serviceName - Label identifying which service/package emits the log.
 */
export function createLogger(serviceName: string): winston.Logger {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const level = process.env['LOG_LEVEL'] ?? 'info';

  const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    isProduction ? jsonFormat(serviceName) : devFormat(serviceName)
  );

  return winston.createLogger({
    level,
    format,
    transports: [new winston.transports.Console()],
  });
}
