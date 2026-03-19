import { Module, Global } from '@nestjs/common';
import { RedisProvider, REDIS_CLIENT } from './redis.provider.js';
import { RedisSubscriberProvider, REDIS_SUBSCRIBER } from './redis-subscriber.provider.js';

/**
 * Global Redis module — imported once in AppModule, available everywhere.
 *
 * Provides two injection tokens:
 * - REDIS_CLIENT     — general-purpose ioredis client (commands, pub/publish)
 * - REDIS_SUBSCRIBER — dedicated subscriber-mode client (subscribe/psubscribe only)
 *
 * Both tokens are globally exported, so any module can inject either without
 * importing RedisModule again.
 */
@Global()
@Module({
  providers: [RedisProvider, RedisSubscriberProvider],
  exports: [REDIS_CLIENT, REDIS_SUBSCRIBER],
})
export class RedisModule {}
