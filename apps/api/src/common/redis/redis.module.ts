import { Module, Global } from '@nestjs/common';
import { RedisProvider, REDIS_CLIENT } from './redis.provider.js';

/**
 * Global Redis module — imported once in AppModule, available everywhere.
 * Provides REDIS_CLIENT injection token with an ioredis client instance.
 */
@Global()
@Module({
  providers: [RedisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
