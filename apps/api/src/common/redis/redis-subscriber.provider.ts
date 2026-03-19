import Redis from 'ioredis';

/** DI injection token for the dedicated Redis Pub/Sub subscriber client */
export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';

/**
 * Dedicated ioredis instance for Pub/Sub subscriptions.
 *
 * MUST be a separate connection from REDIS_CLIENT — once `subscribe()` is
 * called on an ioredis instance, the connection enters subscriber mode and
 * cannot execute any other Redis commands (e.g. SET, GET, PUBLISH).
 *
 * This provider is consumed by the SSE gateway (Plan 02) which subscribes
 * to per-session event channels to stream live updates to the browser.
 */
export const RedisSubscriberProvider = {
  provide: REDIS_SUBSCRIBER,
  useFactory: (): Redis =>
    new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
};
