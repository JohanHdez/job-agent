import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger } from '@job-agent/logger';
import type winston from 'winston';

/**
 * NestJS LoggerService implementation that delegates to the shared
 * @job-agent/logger Winston factory.
 *
 * Register this service globally in AppModule and wire it into the NestJS
 * logger via app.useLogger(app.get(WinstonLoggerService)) in main.ts.
 */
@Injectable()
export class WinstonLoggerService implements LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = createLogger('user-service');
  }

  /** @inheritdoc */
  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  /** @inheritdoc */
  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { trace, context });
  }

  /** @inheritdoc */
  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  /** @inheritdoc */
  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  /** @inheritdoc */
  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }
}
