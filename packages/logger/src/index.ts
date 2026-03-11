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
import chalk from 'chalk';

// ── Request context stored per async execution chain ─────────────────────────

export interface RequestContext {
  correlationId: string;
  userId?: string;
}

/** Shared storage — one active entry per request, isolated by async context */
export const requestContext = new AsyncLocalStorage<RequestContext>();

// ── Log entry shape ───────────────────────────────────────────────────────────

interface StructuredLogEntry {
  timestamp: string;
  level: string;
  service: string;
  correlationId: string;
  userId: string;
  message: string;
  [key: string]: unknown;
}

// ── Format helpers ────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, (s: string) => string> = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.blue,
  debug: chalk.magenta,
  verbose: chalk.cyan,
};

/**
 * Human-readable format for development:
 *   [HH:mm:ss] [SERVICE] [correlationId] LEVEL message {meta}
 */
function devFormat(service: string): winston.Logform.Format {
  return winston.format.printf((info) => {
    const ctx = requestContext.getStore();
    const cid = ctx?.correlationId ?? '-';
    const uid = ctx?.userId ? ` uid=${ctx.userId}` : '';
    const ts  = chalk.gray(String(info['timestamp'] ?? ''));
    const svc = chalk.cyan(`[${service}]`);
    const lvl = (LEVEL_COLORS[info.level] ?? chalk.white)(info.level.toUpperCase());
    const msg = String(info['message'] ?? '');

    // Print extra metadata (excluding standard fields)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { timestamp: _ts, level: _lvl, message: _msg, ...meta } = info;
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
    const entry: StructuredLogEntry = {
      timestamp:     String(info['timestamp'] ?? new Date().toISOString()),
      level:         info.level,
      service,
      correlationId: ctx?.correlationId ?? 'system',
      userId:        ctx?.userId ?? 'anonymous',
      message:       String(info['message'] ?? ''),
    };

    // Merge remaining metadata
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { timestamp: _ts, level: _lvl, message: _msg, ...meta } = info;
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
    isProduction ? jsonFormat(serviceName) : devFormat(serviceName),
  );

  return winston.createLogger({
    level,
    format,
    transports: [new winston.transports.Console()],
  });
}
