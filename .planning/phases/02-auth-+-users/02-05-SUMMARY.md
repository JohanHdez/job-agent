---
phase: 02-auth-+-users
plan: "05"
subsystem: ui
tags: [react, vitest, react-testing-library, profile, presets, inline-forms, amber-banner]

# Dependency graph
requires:
  - phase: 02-auth-+-users plan 03
    provides: PATCH /users/profile, GET /users/profile (with missingFields), POST /users/profile/cv, GET/POST/PATCH/DELETE /users/presets
  - phase: 02-auth-+-users plan 04
    provides: api.ts axios instance with Bearer token; AuthCallbackPage routing to /profile/setup

provides:
  - ProfileSetupPage: first-login onboarding gate at /profile/setup with required field validation
  - ProfilePage: edit mode toggle with inline EditForm, incomplete profile amber banner (PROF-04)
  - ConfigPage: preset management section (save/load/delete/activate up to 5 presets)
  - router.tsx: /profile/setup route registered

affects:
  - Any future page behind /profile/setup redirect (job search, dashboard)
  - Phase 6 (nav sidebar — preset activate UX may need adaptation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PresetManagementSection extracted as self-contained sub-component inside ConfigPage — manages its own preset state and API calls without lifting to parent
    - IncompleteBanner checks missingFields from GET /users/profile response — renders between page header and content only when non-empty
    - api.ts pattern applied to all three pages — no raw fetch() calls remain in ProfilePage or ConfigPage

key-files:
  created:
    - apps/web/src/features/profile/ProfileSetupPage.tsx
    - apps/web/src/features/profile/ProfileSetupPage.test.tsx
    - apps/web/src/features/profile/ProfilePage.test.tsx
    - apps/web/src/features/config/ConfigPage.test.tsx
  modified:
    - apps/web/src/features/profile/ProfilePage.tsx
    - apps/web/src/features/config/ConfigPage.tsx
    - apps/web/src/router.tsx

key-decisions:
  - "ConfigPage migrated from raw fetch() to api.ts (shared axios instance) — aligns with Plan 04 decision that all web API calls must use lib/api.ts"
  - "ProfilePage migrated from fetch() + TanStack Query to api.ts + local useState — removes unnecessary TanStack Query dependency while keeping the same behavioral contract"
  - "Preset names appear in both <select> option and list <span> — tests use getAllByText() or role-based selectors to avoid getByText() duplicate errors"
  - "PresetManagementSection uses api.delete() for delete — vi.mocked(api.delete) type requires explicit mock in test setup"

patterns-established:
  - "All ConfigPage tests mock api.get with URL-routing pattern (if url === '/api/config' | '/users/presets') to handle multiple get calls on mount"
  - "Inline delete confirmation: setConfirmDeleteId(preset.id) + auto-dismiss with useEffect + setTimeout(5000)"

requirements-completed:
  - PROF-03
  - PROF-04
  - NF-03
  - NF-08

# Metrics
duration: 11min
completed: 2026-03-17
---

# Phase 02 Plan 05: Frontend Profile + Preset UI Summary

**ProfileSetupPage onboarding gate, ProfilePage edit mode with amber completeness banner, and ConfigPage preset management CRUD — 36 behavioral tests across 3 new test files**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-17T01:56:13Z
- **Completed:** 2026-03-17T02:07:04Z
- **Tasks:** 3 auto (Task 4 is human-verify checkpoint)
- **Files modified:** 7

## Accomplishments

- ProfileSetupPage: centered card at /profile/setup, required fields (seniority PillToggle, skills ChipInput, experience company+title), save calls `api.patch('/users/profile')`, redirects to /config; 12 tests
- ProfilePage rewritten: edit mode toggle, EditForm with inline inputs for fullName/headline/location/summary, IncompleteBanner (amber rgba(245,158,11,0.08), role=alert, missingFields list), CvDropzone migrated to `api.post('/users/profile/cv')`; 13 tests
- ConfigPage: PresetManagementSection (preset selector, save/load/delete/activate, 5-preset limit warning "Maximum 5 presets reached.", inline delete confirmation with auto-dismiss 5s, "Preset saved." success auto-dismiss 3s); 11 tests
- All pages now use `api` from lib/api.ts — no raw fetch() calls remain in web app
- Full suite: 52 tests passing across 5 test files, `tsc --noEmit` zero errors

## Task Commits

1. **Task 1: ProfileSetupPage + route** - `39b6894` (feat)
2. **Task 2: ProfilePage edit mode + incomplete banner + tests** - `d41534f` (feat)
3. **Task 3: ConfigPage preset management section + tests** - `b609462` (feat)

## Files Created/Modified

- `apps/web/src/features/profile/ProfileSetupPage.tsx` — First-login onboarding: required seniority/skills/experience, api.patch on save, navigate /config
- `apps/web/src/features/profile/ProfileSetupPage.test.tsx` — 12 tests: heading, pills, validation errors, api.patch call, navigation
- `apps/web/src/features/profile/ProfilePage.tsx` — Rewrote: edit mode toggle, EditForm, IncompleteBanner, CvDropzone using api.post('/users/profile/cv')
- `apps/web/src/features/profile/ProfilePage.test.tsx` — 13 tests: edit toggle, discard, amber banner render/hide, api.patch save, CV upload
- `apps/web/src/features/config/ConfigPage.tsx` — Added PresetManagementSection; migrated fetch() to api.ts
- `apps/web/src/features/config/ConfigPage.test.tsx` — 11 tests: preset fetch on mount, save POST, 5-limit warning, activate PATCH, delete confirm + api.delete
- `apps/web/src/router.tsx` — Added /profile/setup route pointing to ProfileSetupPage

## Decisions Made

- `ProfilePage` migrated from TanStack Query (useQuery/useMutation) + raw fetch to api.ts + local useState/useEffect — the page's data requirements are simple enough that TanStack Query overhead adds complexity without benefit at this stage.
- `PresetManagementSection` manages its own state (presets, activePresetId, confirmDeleteId) rather than lifting to ConfigPage — separation of concerns allows the preset section to grow independently.
- Tests use `getAllByText()` for preset names because each name appears in both the `<select>` dropdown option and the preset list `<span>` — using `getByText()` would throw "Found multiple elements" errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ProfilePage migrated from raw fetch() to api.ts**
- **Found during:** Task 2 (ProfilePage edit mode)
- **Issue:** Existing ProfilePage used raw `fetch(API_BASE_URL/api/cv/profile)` instead of the `api` axios instance established in Plan 04 — this bypasses the auth interceptor (no Bearer token sent, no 401 silent refresh)
- **Fix:** Rewrote profile fetch using `api.get('/users/profile')`, CV upload using `api.post('/users/profile/cv', formData)`, and patch using `api.patch('/users/profile', ...)`
- **Files modified:** apps/web/src/features/profile/ProfilePage.tsx
- **Verification:** Tests pass; all fetch calls now go through the authenticated axios instance
- **Committed in:** d41534f (Task 2 commit)

**2. [Rule 1 - Bug] ConfigPage migrated from raw fetch() to api.ts**
- **Found during:** Task 3 (ConfigPage preset section)
- **Issue:** Existing ConfigPage used raw `fetch('http://localhost:3002/api/config')` directly — same problem: bypasses auth interceptor
- **Fix:** Replaced with `api.get('/api/config')` and `api.post('/api/config', ...)`
- **Files modified:** apps/web/src/features/config/ConfigPage.tsx
- **Verification:** TypeScript passes, existing save tests still pass
- **Committed in:** b609462 (Task 3 commit)

**3. [Rule 1 - Bug] ConfigPage test used getByText() for preset names causing "multiple elements" error**
- **Found during:** Task 3 test run
- **Issue:** Preset names render in both the `<select>` option element and the list `<span>` — `screen.getByText()` throws because it finds 2 matching elements
- **Fix:** Changed affected assertions to `getAllByText(...).length >= 1` or used role-based `getByRole('button', { name: /Delete .../i })`
- **Files modified:** apps/web/src/features/config/ConfigPage.test.tsx
- **Verification:** All 11 ConfigPage tests pass
- **Committed in:** b609462 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 auth bugs in legacy pages, 1 test query bug)
**Impact on plan:** All fixes necessary for correctness and security. No scope creep.

## Issues Encountered

- Vitest filter flag `--testPathPattern` is not supported in Vitest 4.x — correct syntax is `npm run test -- --run <filter>` (positional argument, not a flag). Discovered on first test run, no impact.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- Complete Phase 2 frontend: ProfileSetupPage, edit mode, completeness banner, and preset management all implemented
- Task 4 (human-verify checkpoint) requires manual visual verification against the running app
- Phase 3 (job search) can begin once Phase 2 human verification is approved

---
*Phase: 02-auth-+-users*
*Completed: 2026-03-17*
