import { SetMetadata } from '@nestjs/common';

/** Metadata key used by JwtAuthGuard to identify public routes. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route or controller as publicly accessible.
 * Routes decorated with @Public() bypass the global JwtAuthGuard.
 *
 * @example
 * @Get('health')
 * @Public()
 * getHealth() { ... }
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
