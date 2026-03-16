---
phase: 02-auth-+-users
plan: 02
subsystem: auth
tags: [jwt, rs256, passport, nestjs, crypto]

# Dependency graph
requires:
  - phase: 02-auth-+-users
    plan: 01
    provides: "auth.module.ts HS256 skeleton, jwt.strategy.ts HS256 skeleton, auth.service.test.ts todo stubs"

provides:
  - "auth.module.ts signs JWTs with RS256 using JWT_PRIVATE_KEY (createPrivateKey)"
  - "jwt.strategy.ts verifies RS256 tokens using JWT_PUBLIC_KEY PEM string"
  - "auth.service.test.ts has 5 passing real assertions (issueTokens + refreshTokens)"
  - ".env.example documents JWT_PRIVATE_KEY + JWT_PUBLIC_KEY with deprecation note for JWT_SECRET"

affects: [02-03, 02-04, 02-05, auth, users, profiles]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RS256 asymmetric JWT: sign with createPrivateKey(privPem), verify with raw PEM string in passport-jwt"
    - "Base64-encoded PEM in env vars: Buffer.from(env, 'base64').toString('utf8') decode pattern"
    - "JwtModuleOptions publicKey must be string | Buffer — KeyObject is not accepted by @nestjs/jwt"

key-files:
  created: []
  modified:
    - apps/api/src/modules/auth/auth.module.ts
    - apps/api/src/modules/auth/strategies/jwt.strategy.ts
    - apps/api/src/modules/auth/auth.service.test.ts
    - .env.example

key-decisions:
  - "JwtModuleOptions.publicKey typed as string | Buffer (not KeyObject) — pass raw PEM string, not createPublicKey() result"
  - "createPrivateKey(privPem) used for signing (jwt.Secret includes KeyObject so privateKey field accepts it)"
  - "JWT_SECRET fully removed from source files; only appears as deprecated comment in .env.example"

patterns-established:
  - "RS256 pattern: auth.module.ts uses createPrivateKey for privateKey, raw PEM string for publicKey"
  - "Env var decode: Buffer.from(process.env['KEY'] ?? '', 'base64').toString('utf8')"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 2 Plan 02: RS256 JWT Migration Summary

**Migrated JWT signing from HS256 symmetric secret to RS256 asymmetric key pair using Node crypto's createPrivateKey and base64-encoded PEM env vars**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T13:40:13Z
- **Completed:** 2026-03-13T13:43:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- auth.module.ts now signs tokens with RS256 using JWT_PRIVATE_KEY (createPrivateKey)
- jwt.strategy.ts now verifies RS256 tokens using JWT_PUBLIC_KEY PEM string and algorithms: ['RS256']
- auth.service.test.ts replaced all it.todo() stubs with 5 real passing assertions
- .env.example documents JWT_PRIVATE_KEY, JWT_PUBLIC_KEY with generation instructions, and deprecates JWT_SECRET

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate auth.module.ts and jwt.strategy.ts to RS256** - `710e050` (feat)
2. **Task 2: Write real auth.service tests and document env vars** - `5f2f1c4` (test)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `apps/api/src/modules/auth/auth.module.ts` - RS256 JwtModule.registerAsync with createPrivateKey + pubPem string
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts` - algorithms: ['RS256'], JWT_PUBLIC_KEY for secretOrKey
- `apps/api/src/modules/auth/auth.service.test.ts` - 5 real assertions for issueTokens and refreshTokens
- `.env.example` - JWT_PRIVATE_KEY + JWT_PUBLIC_KEY documented; JWT_SECRET deprecated

## Decisions Made
- **publicKey as string not KeyObject:** `JwtModuleOptions.publicKey` is typed `string | Buffer` — passing `createPublicKey()` KeyObject caused a TypeScript error. Fixed by passing the decoded PEM string directly. This is consistent with how passport-jwt accepts the public key in `secretOrKey`.
- **createPrivateKey for privateKey field:** `jwt.Secret` (used by `JwtModuleOptions.privateKey`) includes `KeyObject`, so createPrivateKey() is the correct and type-safe approach for signing.
- **JWT_SECRET fully removed from source:** Both auth.module.ts and jwt.strategy.ts now exclusively use JWT_PRIVATE_KEY / JWT_PUBLIC_KEY. JWT_SECRET only exists as a deprecated comment in .env.example.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error: publicKey must be string | Buffer, not KeyObject**
- **Found during:** Task 1 (Migrate auth.module.ts and jwt.strategy.ts to RS256)
- **Issue:** Plan's code sample used `createPublicKey(pubPem)` which returns a `KeyObject`. `JwtModuleOptions.publicKey` only accepts `string | Buffer`.
- **Fix:** Changed `publicKey: createPublicKey(pubPem)` to `publicKey: pubPem` (raw PEM string). Removed `createPublicKey` import. `tsc --noEmit` now exits 0.
- **Files modified:** apps/api/src/modules/auth/auth.module.ts
- **Verification:** `tsc --noEmit` exits 0
- **Committed in:** `710e050` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type mismatch bug in plan sample)
**Impact on plan:** The fix is semantically equivalent — passport-jwt accepts a PEM string for RS256 verification. No scope creep, no behavioral change.

## Issues Encountered
- @nestjs/jwt's `publicKey` field does not accept Node's `KeyObject` type — only `string | Buffer`. The plan's reference pattern used `createPublicKey()` which is incorrect for this library version. Resolved by passing the decoded PEM string directly (which passport-jwt uses internally the same way).

## User Setup Required

**External services require manual configuration before RS256 JWT auth works at runtime.**

Generate an RS256 key pair and set the env vars:
```bash
# Generate private key (PEM → base64)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
cat private.pem | base64 -w 0  # → JWT_PRIVATE_KEY value

# Extract public key (PEM → base64)
openssl rsa -in private.pem -pubout -out public.pem
cat public.pem | base64 -w 0   # → JWT_PUBLIC_KEY value
```

Add to `.env`:
```
JWT_PRIVATE_KEY=<base64 private key output>
JWT_PUBLIC_KEY=<base64 public key output>
```

## Next Phase Readiness
- RS256 JWT infrastructure is complete — all future plans in Phase 2 depend on this migration
- auth.service tests cover AUTH-01/02/03 with real assertions
- Requirements AUTH-01, AUTH-02, AUTH-03 marked complete
- Ready for Plan 02-03 (users module / OAuth callbacks)

---
*Phase: 02-auth-+-users*
*Completed: 2026-03-13*
