---
phase: 04-pipeline-search-scoring
plan: "02"
subsystem: api
tags: [typescript, nestjs, mongoose, vacancies, sessions, preset-resolution, tdd]

# Dependency graph
requires:
  - phase: 04-01
    provides: VacancyType, SearchConfigSnapshotType, VacanciesModule with Vacancy schema
  - phase: 02-auth-+-users
    provides: User schema with searchPresets and activePresetId fields
  - phase: 03-sessions-bullmq
    provides: SessionsService, SessionsModule wiring patterns
provides:
  - POST /sessions resolves active preset and embeds SearchConfigSnapshotType in session document
  - BadRequestException (NO_ACTIVE_PRESET) when user has no active preset
  - BadRequestException (PRESET_NOT_FOUND) when activePresetId references missing preset
  - VacanciesService with findBySession, updateStatus, checkDuplicate, insertMany
  - VacanciesController: GET /vacancies/session/:sessionId and PATCH /vacancies/:id/status
  - UpdateVacancyStatusDto with @IsIn validation
affects:
  - 04-03 (worker pipeline — can call VacanciesService.insertMany and checkDuplicate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Preset snapshot pattern: session config is resolved at creation time and frozen — historical sessions retain accurate config even after preset edits"
    - "Ownership guard pattern: all vacancy queries filter by userId for NF-08 row-level security"
    - "E11000 partial insert pattern: insertMany with ordered:false + insertedDocs extraction for bulk vacancy persistence"

key-files:
  created:
    - apps/api/src/modules/vacancies/vacancies.service.ts
    - apps/api/src/modules/vacancies/vacancies.controller.ts
    - apps/api/src/modules/vacancies/dto/update-vacancy-status.dto.ts
    - apps/api/src/modules/vacancies/vacancies.service.test.ts
  modified:
    - apps/api/src/modules/sessions/sessions.service.ts
    - apps/api/src/modules/sessions/sessions.controller.ts
    - apps/api/src/modules/sessions/sessions.module.ts
    - apps/api/src/modules/sessions/sessions.service.test.ts
    - apps/api/src/modules/vacancies/vacancies.module.ts

key-decisions:
  - "createSession signature changed from (userId, config) to (userId) — service resolves config internally from user's active preset, callers cannot inject arbitrary config"
  - "SessionsModule registers User model via MongooseModule.forFeature to avoid circular dependency with UsersModule"
  - "VacanciesModule exports both VacanciesService and MongooseModule — service for worker pipeline use, MongooseModule for direct model injection in other modules"
  - "checkDuplicate uses $regex with case-insensitive flag for company+title matching because MongoDB collation on the unique index does not apply to find queries — explicit regex ensures consistent behavior"

patterns-established:
  - "Internal config resolution pattern: NestJS service resolves snapshot internally rather than accepting raw config from controller — prevents misconfigured sessions"
  - "findOneAndUpdate with userId filter: atomic ownership check + update in single MongoDB round trip"

requirements-completed: [HIST-04, APPLY-04, AUTO-03]

# Metrics
duration: 7min
completed: 2026-03-18
---

# Phase 4 Plan 02: Preset Resolution and Vacancies REST Layer Summary

**SessionsService resolves active preset into SearchConfigSnapshotType at creation time; VacanciesService exposes findBySession, updateStatus (dismiss), checkDuplicate, and insertMany with NF-08 ownership enforcement throughout**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-18T12:03:31Z
- **Completed:** 2026-03-18T12:10:53Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- SessionsService.createSession now resolves the user's active preset and embeds a full SearchConfigSnapshotType in the session document — session config is no longer an empty {}
- BadRequestException guards added for missing activePresetId (NO_ACTIVE_PRESET) and missing preset (PRESET_NOT_FOUND)
- VacanciesService created with findBySession (sorted by score desc), updateStatus (with NotFoundException), checkDuplicate (url OR company+title case-insensitive), and insertMany (E11000 partial insert handling)
- VacanciesController exposes GET /vacancies/session/:sessionId and PATCH /vacancies/:id/status under JwtAuthGuard
- 21 unit tests total (13 sessions, 8 vacancies) — all pass, tsc exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire preset resolution into POST /sessions** - `9b2e3d6` (feat)
2. **Task 2: Create VacanciesService and VacanciesController** - `a0a6dfc` (feat)

**Plan metadata:** (docs commit — created below)

## Files Created/Modified
- `apps/api/src/modules/sessions/sessions.service.ts` - createSession now takes userId only, resolves preset, throws on missing preset
- `apps/api/src/modules/sessions/sessions.controller.ts` - removed empty config stub, calls createSession(userId)
- `apps/api/src/modules/sessions/sessions.module.ts` - added User model registration for SessionsService injection
- `apps/api/src/modules/sessions/sessions.service.test.ts` - updated to new signature, added 4 preset-resolution tests
- `apps/api/src/modules/vacancies/vacancies.service.ts` - VacanciesService with findBySession, updateStatus, checkDuplicate, insertMany
- `apps/api/src/modules/vacancies/vacancies.controller.ts` - GET session/:sessionId and PATCH :id/status endpoints
- `apps/api/src/modules/vacancies/dto/update-vacancy-status.dto.ts` - @IsIn(['dismissed','applied','failed']) DTO
- `apps/api/src/modules/vacancies/vacancies.service.test.ts` - 8 unit tests covering all service methods
- `apps/api/src/modules/vacancies/vacancies.module.ts` - wired controller, service, exports both

## Decisions Made
- `createSession` signature changed from `(userId, config)` to `(userId)` — service resolves config internally so callers cannot inject misconfigured snapshots
- SessionsModule registers User model directly rather than importing UsersModule — avoids potential circular dependency while keeping the model available for injection
- VacanciesModule exports VacanciesService (for worker pipeline use in Plan 03) and MongooseModule (for direct model injection downstream)
- `checkDuplicate` uses `$regex` with case-insensitive flag rather than relying on the compound index collation — MongoDB collation affects index lookups but not `find` query comparison semantics

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- POST /sessions now resolves the real preset config — the BullMQ worker will receive a SearchConfigSnapshotType it can use for actual LinkedIn search parameters
- VacanciesService.insertMany and checkDuplicate are ready for Phase 4 Plan 03 worker pipeline integration
- PATCH /vacancies/:id/status is available for the web frontend dismiss feature (HIST-04)

---
*Phase: 04-pipeline-search-scoring*
*Completed: 2026-03-18*
