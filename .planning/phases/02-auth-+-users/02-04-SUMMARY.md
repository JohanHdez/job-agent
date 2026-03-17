---
phase: 02-auth-+-users
plan: "04"
subsystem: auth
tags: [zustand, axios, vitest, react-testing-library, jwt, httponly-cookie, oauth, silent-refresh]

# Dependency graph
requires:
  - phase: 02-auth-+-users plan 02
    provides: POST /auth/exchange and POST /auth/refresh backend endpoints with httpOnly cookie

provides:
  - Zustand auth store with accessToken-only state (refreshToken fully removed)
  - Axios API client with Bearer token request interceptor and 401 silent-refresh response interceptor
  - AuthCallbackPage: code-exchange flow with profile-aware routing (new users to /profile/setup, returning to /config)
  - App.tsx: initApiAuth wiring + silent refresh on mount to recover session from httpOnly cookie
  - Vitest test infrastructure for apps/web with jsdom + @testing-library/jest-dom

affects:
  - profile-setup (reads from /profile/setup route)
  - any future authenticated features (all use the shared api.ts axios instance)

# Tech tracking
tech-stack:
  added:
    - vitest 4.x — test runner for apps/web
    - "@testing-library/react" — component rendering in tests
    - "@testing-library/user-event" — user interaction simulation
    - "@testing-library/jest-dom" — DOM matchers (toBeInTheDocument etc.)
    - jsdom — browser environment for Node test runner
    - "@vitest/coverage-v8" — V8 coverage provider
    - axios 1.x — HTTP client with interceptor support
  patterns:
    - initApiAuth dependency injection pattern: avoids circular import between api.ts and auth.store.ts
    - Queued refresh subscribers: concurrent 401s wait for one refresh then all retry with new token
    - vi.fn() inline in vi.mock factory (not external variable) to avoid hoisting ReferenceError

key-files:
  created:
    - apps/web/vitest.config.ts
    - apps/web/src/lib/api.ts
    - apps/web/src/store/auth.store.test.ts
    - apps/web/src/features/auth/AuthCallbackPage.test.tsx
    - apps/web/src/test-setup.ts
  modified:
    - apps/web/package.json
    - apps/web/src/store/auth.store.ts
    - apps/web/src/features/auth/AuthCallbackPage.tsx
    - apps/web/src/App.tsx

key-decisions:
  - "initApiAuth(getToken, setToken, logout) pattern injects store functions into interceptor at runtime — avoids circular import between api.ts and auth.store.ts"
  - "vi.mock factory must use vi.fn() directly (not external variables) due to Vitest hoisting — vi.mocked() used after mock for typed access"
  - "test-setup.ts imports @testing-library/jest-dom globally so all test files get toBeInTheDocument and other DOM matchers without explicit import"

patterns-established:
  - "All API calls in apps/web must import from apps/web/src/lib/api.ts — never raw fetch or new axios instances"
  - "Auth store exports useAuthStore with accessToken only — refreshToken never touches JavaScript"
  - "Silent refresh on App mount: post to /auth/refresh with withCredentials, then /auth/me to restore full user state"

requirements-completed:
  - AUTH-03
  - NF-08

# Metrics
duration: 6min
completed: 2026-03-17
---

# Phase 02 Plan 04: Frontend Auth Code-Exchange Flow Summary

**Axios API client with 401 silent-refresh interceptor, Zustand store migrated to accessToken-only, and AuthCallbackPage rewritten for code-exchange with profile-aware routing (new users → /profile/setup, returning → /config)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-17T01:47:18Z
- **Completed:** 2026-03-17T01:53:07Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Vitest test infrastructure for apps/web established (jsdom, @testing-library/react, jest-dom matchers, coverage via V8)
- Axios instance with Bearer token injection and transparent 401-retry via httpOnly cookie silent refresh
- Auth store migrated: `refreshToken` and `setTokens` completely removed, `setAccessToken(at)` is the only token setter
- AuthCallbackPage rewired from URL-param tokens to one-time code exchange; routes new users to `/profile/setup` and returning users to `/config`
- App.tsx wires initApiAuth once and attempts silent session recovery on every page load
- 16 tests across 2 test files proving the security contract

## Task Commits

1. **Task 1: Setup Vitest, API client, migrate auth store, auth store tests** - `43cab2b` (feat)
2. **Task 2: Rewrite AuthCallbackPage + silent refresh in App.tsx + callback tests** - `573928c` (feat)

## Files Created/Modified

- `apps/web/vitest.config.ts` — Vitest configuration: jsdom environment, jest-dom setup, V8 coverage
- `apps/web/src/lib/api.ts` — Axios instance with Bearer token interceptor and 401 silent-refresh queue
- `apps/web/src/store/auth.store.ts` — Migrated: refreshToken removed, setAccessToken replaces setTokens
- `apps/web/src/store/auth.store.test.ts` — 5 behavioral tests proving security contract (no refreshToken, no setTokens, logout clears correctly)
- `apps/web/src/features/auth/AuthCallbackPage.tsx` — Code-exchange flow: reads ?code=, calls /auth/exchange, /auth/me, /users/profile; routes to /profile/setup or /config
- `apps/web/src/features/auth/AuthCallbackPage.test.tsx` — 11 tests covering both routing paths, error states, missing code, and API failures
- `apps/web/src/App.tsx` — Added initApiAuth wiring and silent refresh useEffect on mount
- `apps/web/src/test-setup.ts` — Imports @testing-library/jest-dom for all tests
- `apps/web/package.json` — Added test/test:watch/test:cov scripts and axios + vitest dependencies

## Decisions Made

- `initApiAuth(getToken, setToken, logout)` pattern injects store accessors into the axios interceptor at runtime, avoiding the circular import that would occur if api.ts imported auth.store.ts directly.
- `vi.mock` factory functions cannot reference external variables due to Vitest hoisting; `vi.fn()` used inline, then `vi.mocked()` used outside the factory for typed access.
- `src/test-setup.ts` imports `@testing-library/jest-dom` globally so all test files get `toBeInTheDocument` and other DOM matchers without per-file imports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing axios dependency**
- **Found during:** Task 1 (creating api.ts)
- **Issue:** axios was not in apps/web package.json; import would fail at runtime
- **Fix:** `npm install axios --workspace=apps/web`
- **Files modified:** apps/web/package.json, package-lock.json
- **Verification:** TypeScript compiles, api.ts import resolves
- **Committed in:** 43cab2b (Task 1 commit)

**2. [Rule 1 - Bug] Added @testing-library/jest-dom setup file**
- **Found during:** Task 2 test run
- **Issue:** `toBeInTheDocument` and `not.toBeInTheDocument` threw "Invalid Chai property" because jest-dom matchers were not loaded
- **Fix:** Created src/test-setup.ts importing @testing-library/jest-dom; updated vitest.config.ts setupFiles
- **Files modified:** apps/web/src/test-setup.ts, apps/web/vitest.config.ts
- **Verification:** All 16 tests pass
- **Committed in:** 573928c (Task 2 commit)

**3. [Rule 1 - Bug] Fixed TypeScript errors in App.tsx and auth.store.test.ts**
- **Found during:** Task 2 TypeScript check
- **Issue:** `logout` destructured in App.tsx but unused (noUnusedLocals); `Record<string, unknown>` cast requires double cast via `unknown` in strict mode
- **Fix:** Removed unused `logout` from destructuring; changed cast to `as unknown as Record<string, unknown>`
- **Files modified:** apps/web/src/App.tsx, apps/web/src/store/auth.store.test.ts
- **Verification:** `tsc --noEmit` exits 0
- **Committed in:** 573928c (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking dependency, 2 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

- Vitest `vi.mock` factory hoisting caused ReferenceError when referencing `vi.fn()` assigned to external const — resolved by moving `vi.fn()` inline into the factory and using `vi.mocked()` for typed access outside.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- Frontend auth flow complete: code-exchange, silent refresh, and 401 retry are all wired
- apps/web has a working Vitest setup ready for future component and hook tests
- Plan 02-05 (ProfileSetupPage) can proceed — AuthCallbackPage already redirects to /profile/setup

---
*Phase: 02-auth-+-users*
*Completed: 2026-03-17*
