import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new JwtAuthGuard(reflector);
  });

  describe('canActivate()', () => {
    it('returns true for routes decorated with @Public()', () => {
      reflector.getAllAndOverride.mockReturnValueOnce(true);

      const mockContext = createMockContext();
      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('calls super.canActivate when route is not @Public()', () => {
      reflector.getAllAndOverride.mockReturnValueOnce(false);

      // Spy on the AuthGuard base canActivate
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(false);

      const mockContext = createMockContext();
      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
      expect(superCanActivate).toHaveBeenCalledWith(mockContext);

      superCanActivate.mockRestore();
    });

    it('calls super.canActivate when @Public() metadata is undefined', () => {
      reflector.getAllAndOverride.mockReturnValueOnce(undefined);

      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const mockContext = createMockContext();
      guard.canActivate(mockContext);

      expect(superCanActivate).toHaveBeenCalledWith(mockContext);

      superCanActivate.mockRestore();
    });
  });
});

/** Creates a minimal mock ExecutionContext for unit testing. */
function createMockContext(): ExecutionContext {
  const handler = jest.fn();
  const classRef = jest.fn();

  return {
    getHandler: () => handler,
    getClass: () => classRef,
    switchToHttp: () => ({
      getRequest: () => ({ headers: {} }),
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}
