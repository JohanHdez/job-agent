import { Global, Module } from '@nestjs/common';
import { createLogger } from '@job-agent/logger';
import { LOGGER } from './logger.constants.js';

/**
 * Global NestJS logger module.
 *
 * Provides the LOGGER injection token (a Winston Logger instance) to every
 * module in the application without needing to import LoggerModule explicitly.
 *
 * @example
 * constructor(@Inject(LOGGER) private readonly logger: Logger) {}
 */
@Global()
@Module({
  providers: [
    {
      provide: LOGGER,
      useFactory: (): ReturnType<typeof createLogger> => createLogger('api'),
    },
  ],
  exports: [LOGGER],
})
export class LoggerModule {}
