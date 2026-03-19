---
phase: 02-auth-+-users
plan: "02"
subsystem: auth
tags: [auth, oauth, redis, jwt, security, cookie, code-exchange]
dependency_graph:
  requires:
    - 02-01  # Redis provider, User schema, token-cipher
  provides:
    - Redis-backed one-time auth code exchange (storeAuthCode/exchangeCode)
    - httpOnly cookie refresh token rotation
    - Hardened CORS with explicit methods
  affects:
    - apps/web (frontend must POST to /auth/exchange instead of reading URL params)
    - Any client consuming POST /auth/refresh (must send cookie, not body)
tech_stack:
  added:
    - cookie-parser@^1.4.7 (httpOnly cookie parsing in Express/NestJS)
    - "@types/cookie-parser@^1.4.10"
  patterns:
    - Redis GETDEL for atomic one-time code consumption
    - httpOnly + Secure + SameSite=Strict cookie for refresh token
    - UUID v4 as ephemeral auth code (30s TTL)
    - Passthrough @Res decorator for cookie setting without breaking NestJS response handling
key_files:
  created:
    - apps/api/src/modules/auth/auth.service.test.ts
    - apps/api/src/modules/auth/auth.controller.test.ts
    - apps/api/src/common/crypto/token-cipher.test.ts
  modified:
    - apps/api/src/modules/auth/auth.service.ts
    - apps/api/src/modules/auth/auth.controller.ts
    - apps/api/src/main.ts
    - apps/api/package.json
decisions:
  - "Auth code uses randomUUID() (crypto built-in UUID v4) rather than nanoid — no extra dependency, crypto module already imported"
  - "REFRESH_COOKIE_OPTIONS extracted as module-level const — avoids duplicating cookie options in exchange, refresh, and logout"
  - "buildMockReq returns unknown cast — AuthenticatedRequest is unexported from controller; unknown cast is safer than as any"
metrics:
  duration_seconds: 427
  completed_date: "2026-03-17"
  tasks_completed: 1
  files_changed: 7
---

# Phase 02 Plan 02: Code-Exchange Auth Pattern Summary

**One-liner:** Redis-backed one-time auth code exchange that eliminates tokens from OAuth redirect URLs, with httpOnly SameSite=Strict cookie-based refresh token rotation and hardened CORS config.

## What Was Built

Migrated the OAuth authentication flow from the insecure URL-param pattern (tokens exposed in browser history, server logs, referrer headers) to a secure code-exchange pattern:

1. **`AuthService.storeAuthCode(tokens)`** — stores a `TokenPairDto` in Redis under `auth:code:<uuid-v4>` with a 30-second TTL. Returns the UUID to use as a redirect code.

2. **`AuthService.exchangeCode(code)`** — atomically consumes a code via Redis `GETDEL`. Returns the `TokenPairDto` if valid, throws `UnauthorizedException` if the code is absent, expired, or already used.

3. **`POST /auth/exchange`** — new public endpoint. Accepts `{ code: UUID }`, calls `exchangeCode()`, returns `{ accessToken, expiresIn }` in the JSON body, and sets `refresh_token` as an httpOnly Secure SameSite=Strict cookie (path: `/auth/refresh`, maxAge: 7 days).

4. **`POST /auth/refresh`** — migrated from body-based to cookie-based. Reads `req.cookies['refresh_token']`, issues new token pair, rotates the cookie.

5. **`POST /auth/logout`** — migrated to read refresh token from cookie and clear it on logout.

6. **OAuth callbacks** — both LinkedIn and Google callbacks now call `storeAuthCode()` and redirect with `?code=<uuid>` only — no tokens in the URL.

7. **CORS hardening** — added explicit `methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']` to the NestJS CORS config.

8. **cookie-parser** — installed and registered as global middleware in `main.ts` before the validation pipe.

## Test Coverage

All 26 tests pass across 3 test files:

- **`auth.service.test.ts`** (8 tests): storeAuthCode UUID format, 30s TTL Redis SETEX call, exchangeCode happy path, GETDEL atomicity, invalid code 401, double-use 401, issueTokens shape
- **`auth.controller.test.ts`** (13 tests): exchange body shape, httpOnly cookie options, 401 for invalid code, refresh reads cookie not body, refresh returns body shape, refresh rotates cookie, 401 without cookie, PROF-01 identity fields on req.user (name/email/photo/headline), no tokens in redirect URL, no accessToken/refreshToken params in redirect
- **`token-cipher.test.ts`** (8 tests): encrypt output format (3 hex segments), random IV per call, round-trip, unicode round-trip, corrupted ciphertext throws, wrong format throws, missing key throws for encrypt, missing key throws for decrypt

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] cookie-parser not installed**
- **Found during:** Task 1 action step 8
- **Issue:** `req.cookies` requires `cookie-parser` middleware, which was not in `apps/api` dependencies
- **Fix:** Installed `cookie-parser@^1.4.7` and `@types/cookie-parser@^1.4.10` in `apps/api` workspace; added `app.use(cookieParser())` before `useGlobalPipes` in `main.ts`
- **Files modified:** `apps/api/package.json`, `apps/api/src/main.ts`, `package-lock.json`
- **Commit:** 9bef679

**2. [Rule 1 - Bug] Test file cast strategy for AuthenticatedRequest**
- **Found during:** TDD GREEN phase — ts-jest compilation
- **Issue:** `AuthenticatedRequest` is unexported from `auth.controller.ts`; direct `Request` assignment fails ts-jest's type check for `linkedinCallback` parameter
- **Fix:** Changed `buildMockReq` return type to `Request` with `as unknown as` cast, and used `as unknown as Parameters<typeof controller.linkedinCallback>[0]` at OAuth callback call sites to avoid `as any`
- **Files modified:** `apps/api/src/modules/auth/auth.controller.test.ts`
- **Commit:** 9bef679

## Self-Check

### Files
- [x] `apps/api/src/modules/auth/auth.service.ts` — contains `storeAuthCode` and `exchangeCode`
- [x] `apps/api/src/modules/auth/auth.controller.ts` — contains `@Post('exchange')`, `httpOnly: true`, no URLSearchParams
- [x] `apps/api/src/main.ts` — contains `cookieParser()` and CORS methods array
- [x] `apps/api/src/modules/auth/auth.service.test.ts` — created
- [x] `apps/api/src/modules/auth/auth.controller.test.ts` — created
- [x] `apps/api/src/common/crypto/token-cipher.test.ts` — created

### Commits
- b2ef255 — test(02-02): TDD RED phase, 3 test files
- 9bef679 — feat(02-02): GREEN phase, all implementations

## Self-Check: PASSED
