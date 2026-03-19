import { createLogger, requestContext } from '@job-agent/logger';

describe('Logger utilities (from @job-agent/logger)', () => {
  describe('requestContext (AsyncLocalStorage)', () => {
    it('makes correlationId available via getStore() inside a run() block', (done) => {
      requestContext.run({ correlationId: 'test-correlation-id' }, () => {
        expect(requestContext.getStore()?.correlationId).toBe('test-correlation-id');
        done();
      });
    });

    it('makes userId available via getStore() when provided', (done) => {
      requestContext.run({ correlationId: 'abc', userId: 'user-123' }, () => {
        expect(requestContext.getStore()?.userId).toBe('user-123');
        done();
      });
    });

    it('returns undefined from getStore() when called outside a run() block', () => {
      // Ensure we are outside any context
      const store = requestContext.getStore();
      expect(store).toBeUndefined();
    });
  });

  describe('createLogger()', () => {
    it('returns a logger with info method', () => {
      const logger = createLogger('test-service');
      expect(typeof logger.info).toBe('function');
    });

    it('returns a logger with warn method', () => {
      const logger = createLogger('test-service');
      expect(typeof logger.warn).toBe('function');
    });

    it('returns a logger with error method', () => {
      const logger = createLogger('test-service');
      expect(typeof logger.error).toBe('function');
    });

    it('returns a logger with debug method', () => {
      const logger = createLogger('test-service');
      expect(typeof logger.debug).toBe('function');
    });

    it('creates independent logger instances per call', () => {
      const loggerA = createLogger('service-a');
      const loggerB = createLogger('service-b');
      expect(loggerA).not.toBe(loggerB);
    });
  });
});
