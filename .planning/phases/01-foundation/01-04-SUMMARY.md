---
phase: 01-foundation
plan: "04"
subsystem: infra
tags: [typescript, packages/core, dist, dev-scripts, sse-types]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: packages/core with SsePayload and SseProgressPayload defined in source

provides:
  - packages/core/dist/ with up-to-date SsePayload and SseProgressPayload declarations
  - dev:services script that rebuilds packages/core before starting watchers

affects:
  - packages/api (Express gateway that imports @job-agent/core SSE types)
  - apps/api (NestJS monolith started by dev:services)
  - UAT tests 1 and 2 (cold start smoke, GET /health)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build-before-watch: upstream workspace packages must be built before downstream watchers start"

key-files:
  created: []
  modified:
    - package.json

key-decisions:
  - "dev:services prefixes concurrently with 'npm run build -w packages/core &&' so stale dist never blocks downstream compilation"

patterns-established:
  - "Build-before-watch pattern: any script that starts file watchers on downstream packages must first build all upstream workspace dependencies"

requirements-completed:
  - NF-06

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 01 Plan 04: Gap Closure — packages/core Stale Dist Summary

**dev:services script now builds packages/core before starting watchers, eliminating the stale-dist TS2305 error that blocked SsePayload imports in packages/api**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-16T00:00:00Z
- **Completed:** 2026-03-16T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Confirmed packages/core/dist/ already contained SsePayload and SseProgressPayload (dist was not stale at execution time)
- Updated root package.json dev:services script to run `npm run build -w packages/core &&` before concurrently, preventing future stale-dist issues
- Verified npm run typecheck exits 0 with no TS2305 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Rebuild packages/core and fix dev:services to build dependencies first** - `9289770` (fix)

**Plan metadata:** pending (created with this summary)

## Files Created/Modified

- `package.json` - Updated dev:services script to build packages/core before starting watchers

## Decisions Made

- dev:services now uses the build-before-watch pattern: `npm run build -w packages/core && concurrently ...`. This adds ~2 seconds to dev startup but guarantees downstream packages never compile against stale type declarations.

## Deviations from Plan

None - plan executed exactly as written.

Note: The dist was already up-to-date when this plan ran (a previous session had run the build). The typecheck already passed. The only change required was the dev:services script update, which is the preventive fix specified in the plan.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- packages/core/dist/ is current and includes all SSE types
- dev:services guards against future stale-dist issues
- npm run typecheck exits 0 — UAT tests 1 and 2 (cold start smoke, GET /health) are unblocked

---
*Phase: 01-foundation*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: package.json
- FOUND: packages/core/dist/types/job.types.d.ts
- FOUND: commit 9289770
