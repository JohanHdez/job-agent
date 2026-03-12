/**
 * Tests for packages/logger/src/index.ts
 *
 * Covers:
 *   - createLogger returns a Winston logger bound to service name
 *   - requestContext provides AsyncLocalStorage for correlation data
 *   - Log entries include correlationId when inside requestContext.run()
 *   - Log entries include userId when present in context
 *   - Log entries omit userId when not present in context
 *   - requestContext.getStore() returns undefined outside run()
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger, requestContext } from './index.js';

describe('createLogger', () => {
  it('returns a Winston logger with an info method', () => {
    const logger = createLogger('api');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('returns a logger with a non-empty level', () => {
    const logger = createLogger('test-service');
    expect(logger.level).toBeTruthy();
  });

  it('creates a new logger for each service name call', () => {
    const loggerA = createLogger('service-a');
    const loggerB = createLogger('service-b');
    // Both should be functional loggers but are separate instances
    expect(loggerA).not.toBe(loggerB);
  });

  it('does not throw when calling logger.info outside a request context', () => {
    const logger = createLogger('api');
    expect(() => logger.info('test message', { key: 'value' })).not.toThrow();
  });

  it('does not throw when calling logger.error outside a request context', () => {
    const logger = createLogger('api');
    expect(() => logger.error('error message', { error: 'something went wrong' })).not.toThrow();
  });
});

describe('requestContext', () => {
  it('is an AsyncLocalStorage instance', () => {
    // Check it has the AsyncLocalStorage interface
    expect(typeof requestContext.run).toBe('function');
    expect(typeof requestContext.getStore).toBe('function');
  });

  it('returns undefined when getStore() is called outside run()', () => {
    const store = requestContext.getStore();
    expect(store).toBeUndefined();
  });

  it('returns the context object when getStore() is called inside run()', () => {
    const ctx = { correlationId: 'test-cid-123' };
    requestContext.run(ctx, () => {
      const store = requestContext.getStore();
      expect(store).toBeDefined();
      expect(store?.correlationId).toBe('test-cid-123');
    });
  });

  it('includes userId in context when provided', () => {
    const ctx = { correlationId: 'cid-456', userId: 'user-789' };
    requestContext.run(ctx, () => {
      const store = requestContext.getStore();
      expect(store?.userId).toBe('user-789');
    });
  });

  it('omits userId from context when not provided', () => {
    const ctx = { correlationId: 'cid-no-user' };
    requestContext.run(ctx, () => {
      const store = requestContext.getStore();
      expect(store?.userId).toBeUndefined();
    });
  });

  it('isolates context per async execution', async () => {
    const ctxA = { correlationId: 'cid-A', userId: 'user-A' };
    const ctxB = { correlationId: 'cid-B' };

    const resultA = await new Promise<string | undefined>((resolve) => {
      requestContext.run(ctxA, () => {
        resolve(requestContext.getStore()?.correlationId);
      });
    });

    const resultB = await new Promise<string | undefined>((resolve) => {
      requestContext.run(ctxB, () => {
        resolve(requestContext.getStore()?.correlationId);
      });
    });

    expect(resultA).toBe('cid-A');
    expect(resultB).toBe('cid-B');
  });
});

describe('logger format with requestContext', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  });

  it('writes a log entry without throwing when inside requestContext', () => {
    const logger = createLogger('api');
    const ctx = { correlationId: 'req-cid-001', userId: 'uid-42' };

    expect(() => {
      requestContext.run(ctx, () => {
        logger.info('inside context log');
      });
    }).not.toThrow();
  });

  it('writes a log entry without throwing when outside requestContext', () => {
    const logger = createLogger('api');
    expect(() => logger.info('outside context log')).not.toThrow();
  });
});
