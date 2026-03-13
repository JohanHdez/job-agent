import { Test } from '@nestjs/testing';
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let mongooseHealthIndicator: jest.Mocked<MongooseHealthIndicator>;

  beforeEach(async () => {
    const mockHealthCheckService: jest.Mocked<HealthCheckService> = {
      check: jest.fn(),
    } as unknown as jest.Mocked<HealthCheckService>;

    const mockMongooseIndicator: jest.Mocked<MongooseHealthIndicator> = {
      pingCheck: jest.fn(),
    } as unknown as jest.Mocked<MongooseHealthIndicator>;

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: MongooseHealthIndicator, useValue: mockMongooseIndicator },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
    healthCheckService = moduleRef.get(HealthCheckService);
    mongooseHealthIndicator = moduleRef.get(MongooseHealthIndicator);
  });

  describe('check()', () => {
    it('returns status ok, uptime, and version when MongoDB is healthy', async () => {
      const terminusResult = {
        status: 'ok' as const,
        info: { mongodb: { status: 'up' as const } },
        error: {},
        details: { mongodb: { status: 'up' as const } },
      };

      mongooseHealthIndicator.pingCheck.mockResolvedValueOnce({ mongodb: { status: 'up' as const } });
      healthCheckService.check.mockImplementationOnce(async (indicators: Array<() => unknown>) => {
        for (const indicator of indicators) await indicator();
        return terminusResult;
      });

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.version).toBe('string');
    });

    it('calls HealthCheckService.check with a mongoose ping check', async () => {
      const terminusResult = {
        status: 'ok' as const,
        info: {},
        error: {},
        details: {},
      };
      healthCheckService.check.mockResolvedValueOnce(terminusResult);

      await controller.check();

      expect(healthCheckService.check).toHaveBeenCalledWith([expect.any(Function)]);
    });

    it('propagates error when MongoDB is not reachable', async () => {
      healthCheckService.check.mockRejectedValueOnce(new Error('MongoDB connection failed'));

      await expect(controller.check()).rejects.toThrow('MongoDB connection failed');
    });

    it('uses npm_package_version env var when set', async () => {
      const original = process.env['npm_package_version'];
      process.env['npm_package_version'] = '2.5.0';

      healthCheckService.check.mockResolvedValueOnce({
        status: 'ok' as const,
        info: {},
        error: {},
        details: {},
      });

      const result = await controller.check();
      expect(result.version).toBe('2.5.0');

      if (original === undefined) delete process.env['npm_package_version'];
      else process.env['npm_package_version'] = original;
    });

    it('falls back to 1.0.0 when npm_package_version is not set', async () => {
      const original = process.env['npm_package_version'];
      delete process.env['npm_package_version'];

      healthCheckService.check.mockResolvedValueOnce({
        status: 'ok' as const,
        info: {},
        error: {},
        details: {},
      });

      const result = await controller.check();
      expect(result.version).toBe('1.0.0');

      if (original !== undefined) process.env['npm_package_version'] = original;
    });
  });
});
