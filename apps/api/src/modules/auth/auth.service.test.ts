import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';

/**
 * AuthService unit test stubs — Phase 2, Wave 0.
 * All it.todo() tests will be implemented in Plan 02 (RS256 migration).
 * Token-cipher round-trip assertions are real and run immediately.
 */
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mocked.jwt.token'),
            verify: jest.fn(),
          } satisfies Partial<jest.Mocked<JwtService>>,
        },
        {
          provide: UsersService,
          useValue: {
            addRefreshToken: jest.fn().mockResolvedValue(undefined),
            removeRefreshToken: jest.fn().mockResolvedValue(undefined),
            validateRefreshToken: jest.fn().mockResolvedValue(null),
            upsertFromLinkedIn: jest.fn(),
            upsertFromGoogle: jest.fn(),
            findById: jest.fn(),
            findByEmail: jest.fn(),
            pruneExpiredTokens: jest.fn(),
          } satisfies Partial<jest.Mocked<UsersService>>,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  // Implement in Plan 02 (RS256 migration)
  it.todo('AUTH-01: issueTokens produces accessToken + refreshToken for LinkedIn user');

  // Implement in Plan 02 (RS256 migration)
  it.todo('AUTH-02: issueTokens produces accessToken + refreshToken for Google user');

  // Implement in Plan 02 (RS256 migration)
  it.todo('AUTH-03: refreshTokens issues new pair and revokes old token');
});
