"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContext = void 0;
exports.createLogger = createLogger;
const async_hooks_1 = require("async_hooks");
const winston_1 = __importDefault(require("winston"));
const chalk_1 = __importDefault(require("chalk"));
/** Shared storage — one active entry per request, isolated by async context */
exports.requestContext = new async_hooks_1.AsyncLocalStorage();
// ── Format helpers ────────────────────────────────────────────────────────────
const LEVEL_COLORS = {
    error: chalk_1.default.red,
    warn: chalk_1.default.yellow,
    info: chalk_1.default.blue,
    debug: chalk_1.default.magenta,
    verbose: chalk_1.default.cyan,
};
/**
 * Human-readable format for development:
 *   [HH:mm:ss] [SERVICE] [correlationId] LEVEL message {meta}
 */
function devFormat(service) {
    return winston_1.default.format.printf((info) => {
        const ctx = exports.requestContext.getStore();
        const cid = ctx?.correlationId ?? '-';
        const uid = ctx?.userId ? ` uid=${ctx.userId}` : '';
        const ts = chalk_1.default.gray(String(info['timestamp'] ?? ''));
        const svc = chalk_1.default.cyan(`[${service}]`);
        const lvl = (LEVEL_COLORS[info.level] ?? chalk_1.default.white)(info.level.toUpperCase());
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
function jsonFormat(service) {
    return winston_1.default.format.printf((info) => {
        const ctx = exports.requestContext.getStore();
        const entry = {
            timestamp: String(info['timestamp'] ?? new Date().toISOString()),
            level: info.level,
            service,
            correlationId: ctx?.correlationId ?? 'system',
            userId: ctx?.userId ?? 'anonymous',
            message: String(info['message'] ?? ''),
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
function createLogger(serviceName) {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const level = process.env['LOG_LEVEL'] ?? 'info';
    const format = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), isProduction ? jsonFormat(serviceName) : devFormat(serviceName));
    return winston_1.default.createLogger({
        level,
        format,
        transports: [new winston_1.default.transports.Console()],
    });
}
//# sourceMappingURL=index.js.map