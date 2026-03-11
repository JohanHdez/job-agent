import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Global JWT guard — applied to all routes except those decorated with @Public().
 * Returns 401 with { error: 'UNAUTHORIZED' } for missing or invalid tokens.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
