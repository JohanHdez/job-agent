---
phase: 02-auth-+-users
plan: 03
subsystem: api
tags: [nestjs, mongodb, mongoose, users, profile, cv-parser, jwt, multer]

# Dependency graph
requires:
  - phase: 02-auth-+-users-plan-01
    provides: User schema with profile/searchPresets fields, DTOs, UsersService upsert methods

provides:
  - UsersService profile merge (fill-empty-only semantics)
  - UsersService CV import with 7s timeout (importCvProfile)
  - UsersService preset CRUD with 5-preset cap
  - UsersService profile completeness check
  - UsersController with 10 REST endpoints
  - NF-08 row-level security enforced at both service and controller layers

affects:
  - Phase 03 (job search): needs active preset from /users/presets/active
  - Phase 04 (frontend): consumes /users/me, /users/profile, /users/presets endpoints
  - Any agent calling user data APIs

# Tech tracking
tech-stack:
  added: [multer (memoryStorage for CV upload), @types/multer]
  patterns:
    - "TDD: failing tests first (RED), then implementation (GREEN)"
    - "Fill-empty-only merge: incoming data only fills null/empty fields, never overwrites"
    - "Promise.race for timeouts: CV parse paired with 7s reject timer"
    - "getUserId(req) helper: all controller methods extract userId from JWT, never from body"

key-files:
  created:
    - apps/api/src/modules/users/users.controller.ts
    - apps/api/src/modules/users/users.service.test.ts
    - apps/api/src/modules/users/users.controller.test.ts
    - apps/api/src/types/pdf-parse.d.ts
  modified:
    - apps/api/src/modules/users/users.service.ts
    - apps/api/src/modules/users/users.module.ts
    - apps/api/tsconfig.json

key-decisions:
  - "mergeProfile uses fill-empty-only semantics: existing non-empty fields (including arrays with items) are never overwritten by incoming CV data"
  - "CV parse timeout uses Promise.race with 7000ms — RequestTimeoutException on expiry, always cleans up temp file in finally"
  - "PATCH /users/presets/active declared before PATCH /users/presets/:id to prevent NestJS route shadowing"
  - "getUserId() helper in controller centralizes JWT userId extraction, preventing accidental body injection (NF-08)"
  - "pdf-parse.d.ts type declaration added to apps/api to resolve missing types when cv-parser source is resolved via tsconfig paths"
  - "Controller tests mock both @job-agent/cv-parser and token-cipher to avoid ESM/CommonJS boundary issues"

patterns-established:
  - "Row-level security pattern: all service methods accept userId as parameter, use { _id: userId } as MongoDB filter"
  - "Controller NF-08 pattern: getUserId(req) is the only source of userId — never req.body.userId"
  - "Preset cap enforcement: check array.length >= 5 before push, throw BadRequestException"

requirements-completed:
  - AUTH-04
  - PROF-01
  - PROF-02
  - PROF-03
  - PROF-04
  - SRCH-01
  - SRCH-02
  - NF-03
  - NF-08

# Metrics
duration: 9min
completed: 2026-03-17
---

# Phase 02 Plan 03: Users REST API Summary

**UsersController (10 endpoints) + UsersService profile/preset CRUD with fill-empty-only CV merge, 7s timeout, and JWT row-level security (NF-08)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-17T01:35:19Z
- **Completed:** 2026-03-17T01:44:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- 10 REST endpoints: PATCH /users/me, GET|PATCH /users/profile, POST /users/profile/cv, GET|POST /users/presets, PATCH /users/presets/active, PATCH|DELETE /users/presets/:id
- Profile merge with fill-empty-only semantics — CV import never overwrites manual edits
- CV upload pipeline: multer memoryStorage → temp file → runCvParser → mergeProfile, with 7s timeout and guaranteed temp file cleanup
- Search preset CRUD with 5-preset cap enforced (throws BadRequestException on 6th)
- All endpoints verified to use JWT userId, never body userId (NF-08 row-level security)
- 46 tests pass: 28 service tests + 18 controller tests

## Task Commits

1. **Task 1: UsersService profile merge, CV import, preset CRUD** - `645eeb2` (feat)
2. **Task 2: UsersController + module wiring + controller tests** - `f68f47a` (feat)

## Files Created/Modified

- `apps/api/src/modules/users/users.service.ts` - Added 10 new methods: findById, updateUser, mergeProfile, updateProfile, checkProfileCompleteness, importCvProfile, getPresets, createPreset, updatePreset, deletePreset, setActivePreset
- `apps/api/src/modules/users/users.service.test.ts` - 28 unit tests including PROF-01 upsertFromLinkedIn verification and NF-08 security assertions
- `apps/api/src/modules/users/users.controller.ts` - 10 REST endpoints with JWT guard at class level, getUserId() helper
- `apps/api/src/modules/users/users.controller.test.ts` - 18 unit tests including NF-08 body injection prevention
- `apps/api/src/modules/users/users.module.ts` - Added UsersController to controllers array
- `apps/api/tsconfig.json` - Added @job-agent/core and @job-agent/cv-parser path aliases
- `apps/api/src/types/pdf-parse.d.ts` - Type declaration for pdf-parse (no @types package available)

## Decisions Made

- **mergeProfile fill-empty-only:** Incoming data only fills null/empty fields. Arrays with existing items are preserved. This is the correct semantics for CV import — never overwrite manual edits.
- **Promise.race timeout:** `importCvProfile` uses `Promise.race([runCvParser(path), timeout])` for the 7s NF-03 constraint. The `finally` block always cleans up the temp PDF file.
- **Route ordering:** `@Patch('presets/active')` must be declared before `@Patch('presets/:id')` in the class body — NestJS matches routes in declaration order.
- **getUserId() helper:** Centralized JWT userId extraction handles both ObjectId (with `.toHexString()`) and plain string `_id` values. Used in every controller method.
- **pdf-parse.d.ts:** Added a local type declaration to resolve the missing `pdf-parse` types when ts-jest resolves `@job-agent/cv-parser` source through the tsconfig path alias.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing WorkExperience required fields in test stub**
- **Found during:** Task 1 (service test RED phase)
- **Issue:** `description` and `technologies` are required fields on `WorkExperience` (not optional), causing TypeScript errors in the test stub
- **Fix:** Added `description: ['Built systems']` and `technologies: ['TypeScript']` to the stub
- **Files modified:** apps/api/src/modules/users/users.service.test.ts
- **Verification:** TypeScript compilation error resolved; tests pass
- **Committed in:** 645eeb2 (Task 1 commit)

**2. [Rule 3 - Blocking] Added token-cipher mock to service tests**
- **Found during:** Task 1 (GREEN phase, upsertFromLinkedIn test)
- **Issue:** `encryptToken` throws at module load time when `TOKEN_CIPHER_KEY` env var is absent in test environment
- **Fix:** Added `jest.mock('../../common/crypto/token-cipher.js', () => ({ encryptToken: jest.fn()... }))`
- **Files modified:** apps/api/src/modules/users/users.service.test.ts
- **Verification:** upsertFromLinkedIn test passes without TOKEN_CIPHER_KEY in env
- **Committed in:** 645eeb2 (Task 1 commit)

**3. [Rule 3 - Blocking] Added @job-agent/cv-parser and token-cipher mocks to controller tests**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** cv-parser uses `"type": "module"` (ESM) but api workspace uses CommonJS; importing service in controller test caused `SyntaxError: Cannot use import statement outside a module`
- **Fix:** Added `jest.mock('@job-agent/cv-parser', ...)` and `jest.mock('../../common/crypto/token-cipher.js', ...)` at the top of the controller test
- **Files modified:** apps/api/src/modules/users/users.controller.test.ts
- **Verification:** All 18 controller tests pass
- **Committed in:** f68f47a (Task 2 commit)

**4. [Rule 3 - Blocking] Added pdf-parse.d.ts type declaration**
- **Found during:** Task 2 (GREEN phase, first test run)
- **Issue:** ts-jest resolved `@job-agent/cv-parser` source via tsconfig path alias and encountered `pdf-parse` module with no `@types/pdf-parse` package, causing `TS7016: Could not find a declaration file` error
- **Fix:** Created `apps/api/src/types/pdf-parse.d.ts` with a minimal type declaration for the module
- **Files modified:** apps/api/src/types/pdf-parse.d.ts (created)
- **Verification:** TypeScript error resolved; all tests pass
- **Committed in:** f68f47a (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking)
**Impact on plan:** All fixes were necessary for tests to run. No scope creep — all changes serve the original plan's test coverage goals.

## Issues Encountered

- Fake timers test for 7s CV parse timeout required `jest.useFakeTimers()` + `jest.advanceTimersByTime(8000)` with a 15s jest timeout override. The `--forceExit` flag is needed in CI because the fake timer leaves a dangling handle, which is acceptable since the underlying behavior is correct.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Users REST API is complete. All 10 endpoints are operational and tested.
- Phase 03 (job search) can read the active preset via `GET /users/presets` + `activePresetId` on the user document.
- Phase 04 (frontend) has complete endpoint contracts for profile management, CV upload, and search preset configuration.
- multer is available at the workspace root — the `apps/api` package does not need its own multer dependency (resolved via npm workspaces hoisting).

---
*Phase: 02-auth-+-users*
*Completed: 2026-03-17*
