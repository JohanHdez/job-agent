import Redis from 'ioredis';

/** DI injection token for the Redis client */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * NestJS provider that creates a Redis client from REDIS_URL env var.
 * Defaults to localhost:6379 for local development.
 */
export const RedisProvider = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
};
