---
phase: 03-sessions-bullmq
plan: "02"
subsystem: api
tags: [nestjs, sessions, sse, bullmq, redis-pubsub, tdd, unit-tests]

# Dependency graph
requires:
  - phase: 03-sessions-bullmq
    plan: "01"
    provides: Session schema, SessionsModule, REDIS_SUBSCRIBER, search-session BullMQ queue
provides:
  - SessionsService with createSession, findByIdForUser, cancelSession, appendEvent, subscribeToEvents
  - SessionsController with POST /sessions (202), GET /:id/events (SSE), DELETE /:id (200)
  - CreateSessionDto for POST /sessions body
  - Full unit test coverage for both service and controller
affects:
  - 03-03 (BullMQ worker calls appendEvent and publishes to Redis channels consumed by SSE)
  - 04 (Frontend SSE client connects to GET /sessions/:id/events)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSE via raw res.write (not @Sse decorator) — allows Last-Event-ID replay and ownership validation before headers"
    - "Validation-first SSE: findByIdForUser throws 404 BEFORE Content-Type header is set"
    - "Ring-buffer via two atomic MongoDB ops: $inc nextEventId then $push $slice:-100"
    - "Redis Pub/Sub teardown via RxJS close$ Subject — unsubscribes and removes listener on SSE close"

key-files:
  created:
    - apps/api/src/modules/sessions/sessions.service.ts
    - apps/api/src/modules/sessions/sessions.service.test.ts
    - apps/api/src/modules/sessions/sessions.controller.ts
    - apps/api/src/modules/sessions/sessions.controller.test.ts
    - apps/api/src/modules/sessions/dto/create-session.dto.ts
  modified:
    - apps/api/src/modules/sessions/sessions.module.ts

key-decisions:
  - "SSE uses raw res.write not @Sse decorator — raw approach allows ownership check before setting Content-Type: text/event-stream, preventing partial responses on 404"
  - "config passed as empty {} in createSession for now — Phase 4 wires real preset resolution from user document"
  - "SessionsService exports from SessionsModule — allows the BullMQ worker (Plan 03) to import service methods without circular deps"

# Metrics
duration: 15min
completed: 2026-03-17
---

# Phase 03 Plan 02: Sessions API Surface Summary

**SessionsService (5 methods) and SessionsController (3 endpoints) implementing the real-time SSE session API with Last-Event-ID replay, Redis Pub/Sub, and 18 unit tests all passing**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-17T22:30:42Z
- **Completed:** 2026-03-17T22:45:50Z
- **Tasks:** 2
- **Files modified:** 6 (5 created, 1 updated)

## Accomplishments

- Implemented `SessionsService` with full session lifecycle: `createSession` (409 conflict guard, BullMQ enqueue), `findByIdForUser` (ownership-scoped fetch), `cancelSession` (status + completedAt), `appendEvent` (atomic $inc + $push/$slice ring buffer), `subscribeToEvents` (Redis Pub/Sub with RxJS teardown)
- Implemented `SessionsController` with 3 endpoints: `POST /sessions` (202, JWT userId, empty config placeholder), `GET /:id/events` (SSE with validation-first ownership check, Last-Event-ID replay, Redis Pub/Sub subscription), `DELETE /:id` (200, cancel session)
- Created `CreateSessionDto` with optional `presetId` for POST body
- Updated `SessionsModule` to wire both `SessionsController` (controllers) and `SessionsService` (providers + exports)
- 18 unit tests written using TDD (RED then GREEN) — 10 service tests + 8 controller tests

## Task Commits

Each task was committed atomically:

1. **Task 1: SessionsService — session CRUD, event persistence, Redis Pub/Sub** - `94f848c` (feat)
2. **Task 2: SessionsController — REST endpoints + SSE stream + module wiring** - `cdf4d68` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/api/src/modules/sessions/sessions.service.ts` - SessionsService with 5 methods, ConflictException 409 guard, ring-buffer appendEvent, Redis Pub/Sub subscribeToEvents
- `apps/api/src/modules/sessions/sessions.service.test.ts` - 10 unit tests covering all service behaviors
- `apps/api/src/modules/sessions/sessions.controller.ts` - SessionsController with POST/GET SSE/DELETE, getUserId helper (NF-08 pattern), Last-Event-ID replay
- `apps/api/src/modules/sessions/sessions.controller.test.ts` - 8 unit tests including SSE header validation and replay logic
- `apps/api/src/modules/sessions/dto/create-session.dto.ts` - CreateSessionDto with optional presetId
- `apps/api/src/modules/sessions/sessions.module.ts` - Added SessionsController + SessionsService wiring

## Decisions Made

- SSE uses raw `res.write` not `@Sse` decorator — enables ownership validation with `findByIdForUser` BEFORE `Content-Type: text/event-stream` is set, preventing partial 404 responses on invalid session IDs
- Session `config` is passed as `{}` in `createSession` for now — Phase 4 will resolve the user's active preset and pass the real config snapshot
- `SessionsService` is exported from `SessionsModule` — the BullMQ worker (Plan 03) needs to call `appendEvent` without circular module dependencies

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing flaky test in `apps/api/src/modules/users/users.service.test.ts` (`throws RequestTimeoutException when runCvParser exceeds 7 seconds`) times out when running the full test suite. Confirmed pre-existing (documented in 03-01 Summary). Out of scope for this plan.

## Self-Check: PASSED

All 6 files exist on disk. Both task commits (94f848c, cdf4d68) found in git log.

## Next Phase Readiness

- Plan 03 (BullMQ worker) can now call `SessionsService.appendEvent` to persist events and publish to Redis channels
- Plan 03 worker publishes to `session:{sessionId}:events` channels — SSE gateway already subscribes via `subscribeToEvents`
- Plan 04 (frontend) can connect to `GET /sessions/:id/events` and receive live progress over SSE with automatic missed-event replay
