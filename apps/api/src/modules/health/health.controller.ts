import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, MongooseHealthIndicator } from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../../../package.json') as { version: string };

/**
 * Health controller — exposes GET /health as a public endpoint.
 *
 * Extends the Terminus health check result with:
 *   - uptime: process uptime in seconds
 *   - version: application version from package.json
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator
  ) {}

  /**
   * GET /health — publicly accessible, no JWT required.
   *
   * Returns:
   *   { status: 'ok' | 'error' | 'shutting_down', uptime: number, version: string, info: {...} }
   *
   * Returns 503 if MongoDB is unreachable.
   */
  @Get()
  @Public()
  @HealthCheck()
  async check() {
    const result = await this.health.check([
      () => this.mongoose.pingCheck('mongodb'),
    ]);

    return {
      ...result,
      uptime: process.uptime(),
      version,
    };
  }
}
