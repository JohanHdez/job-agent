---
phase: 03-sessions-bullmq
plan: "03"
subsystem: api
tags: [nestjs, bullmq, worker-process, redis-pubsub, mongodb, mock-data, faker, sse, crash-isolation]

# Dependency graph
requires:
  - phase: 03-sessions-bullmq
    plan: "01"
    provides: Session schema, SessionsModule, REDIS_SUBSCRIBER, search-session BullMQ queue
  - phase: 03-sessions-bullmq
    plan: "02"
    provides: SessionsService (appendEvent, subscribeToEvents), SessionsController (POST/GET SSE/DELETE)

provides:
  - Standalone BullMQ worker process (search-session.worker.ts) with crash isolation via child_process.fork
  - Mock session event generator using @faker-js/faker (mock-data.generator.ts)
  - Full end-to-end pipeline: POST /sessions -> BullMQ queue -> worker process -> Redis Pub/Sub -> SSE -> browser
  - Ring-buffer MongoDB persistence ($push $slice:-100) and Redis Pub/Sub event broadcasting from worker
  - Graceful SIGTERM shutdown on worker process

affects:
  - 04 (Frontend SSE client connects to the validated GET /sessions/:id/events endpoint)
  - Phase 4 real search pipeline replaces mock-data.generator.ts with actual LinkedIn automation

# Tech tracking
tech-stack:
  added:
    - "@faker-js/faker — realistic mock job/company/location data for Phase 3 stub events"
  patterns:
    - "child_process.fork for BullMQ worker spawning — crash isolation without Cluster API complexity"
    - "Worker uses its own mongoose.connect and ioredis instances — zero NestJS dependencies in worker process"
    - "Ring-buffer event persistence: atomic $inc nextEventId then $push $slice:-100 in two MongoDB ops"
    - "Cancellation check inside event loop: worker reads session.status before each event, exits if 'cancelled'"
    - "Worker stdout/stderr piped and prefixed in API console — [worker:stdout] / [worker:stderr] prefix pattern"
    - "Auto-respawn placeholder in worker.on('exit') handler — production respawn logic deferred to Phase 4"

key-files:
  created:
    - apps/api/src/workers/search-session.worker.ts
    - apps/api/src/workers/mock-data.generator.ts
  modified:
    - apps/api/src/modules/sessions/sessions.module.ts

key-decisions:
  - "child_process.fork chosen over BullMQ sandboxed processor — simpler path resolution for monorepo dist/ layout"
  - "Worker has its own ioredis + mongoose connections — no shared state with NestJS process, ensures crash isolation"
  - "mock-data.generator.ts is Phase 3 stub — Phase 4 replaces call site with real LinkedIn pipeline without touching worker architecture"
  - "Worker concurrency set to 2 (BullMQ default max for LinkedIn safety rate limits per CLAUDE.md)"

patterns-established:
  - "Worker pattern: standalone Node.js entry point (not NestJS) with own DB/Redis connections + SIGTERM handler"
  - "Module lifecycle: OnModuleInit spawns worker, OnModuleDestroy sends SIGTERM"

requirements-completed:
  - RT-01
  - NF-05

# Metrics
duration: 10min
completed: 2026-03-17
---

# Phase 03 Plan 03: BullMQ Worker Process Summary

**Standalone BullMQ worker with @faker-js/faker mock events completing the Phase 3 end-to-end pipeline: POST /sessions -> queue -> worker -> Redis Pub/Sub -> SSE stream**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-17T22:47:43Z
- **Completed:** 2026-03-17T22:49:22Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint approved)
- **Files modified:** 3 (2 created, 1 updated)

## Accomplishments

- Created `search-session.worker.ts` as a standalone Node.js process (not NestJS): owns its own ioredis publisher and mongoose connection, creates a BullMQ `Worker` on the `search-session` queue with `concurrency: 2`, publishes each event to `session:{sessionId}:events` Redis channel, persists events to MongoDB via ring-buffer ($push $slice:-100), checks for cancellation on each iteration, handles SIGTERM gracefully
- Created `mock-data.generator.ts` exporting `generateMockSessionEvents` — generates a realistic sequence (session_started, 5-8 job_found, 1-2 job_skipped, 2-3 application_made, session_complete) using `@faker-js/faker` with correct totals; documented as Phase 3 stub to be replaced in Phase 4
- Updated `sessions.module.ts` with `OnModuleInit` / `OnModuleDestroy` lifecycle hooks using `child_process.fork` to spawn the compiled worker JS, pipe stdout/stderr with `[worker:stdout]` / `[worker:stderr]` prefixes, and send SIGTERM on module destroy
- Human E2E verification checkpoint approved — full pipeline validated: POST /sessions (202), SSE stream with live events, 409 on duplicate active session, Last-Event-ID replay, worker crash isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create mock data generator and BullMQ worker process** - `a3f966a` (feat)
2. **Task 2: Wire worker spawning in SessionsModule and verify compilation** - `f3603aa` (feat)
3. **Task 3: Verify end-to-end session flow** - checkpoint approved (no code commit — human verification)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/api/src/workers/search-session.worker.ts` - Standalone BullMQ worker: ioredis publisher, mongoose connection, event loop with ring-buffer persistence and Redis Pub/Sub broadcast, SIGTERM handler
- `apps/api/src/workers/mock-data.generator.ts` - Phase 3 mock event generator using @faker-js/faker; exports `generateMockSessionEvents(sessionId, userId): SessionEventUnion[]`
- `apps/api/src/modules/sessions/sessions.module.ts` - Added `OnModuleInit` (fork worker) and `OnModuleDestroy` (SIGTERM kill) lifecycle hooks

## Decisions Made

- `child_process.fork` chosen over BullMQ's built-in sandboxed processor — the monorepo `dist/` layout made the relative path for `fork` more predictable than BullMQ's `processor` file URL resolution
- Worker maintains its own `ioredis` publisher and `mongoose.connect` — no shared state with the NestJS API process; a crash in the worker cannot propagate to the API
- `mock-data.generator.ts` is an explicit Phase 3 stub — Phase 4 replaces the `generateMockSessionEvents` call site with real LinkedIn Playwright automation without changing the worker architecture
- Worker `concurrency: 2` aligns with BullMQ rate-limiting guidance in CLAUDE.md (LinkedIn safety constraint)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both files compiled with zero TypeScript errors. Pre-existing flaky timeout test in `users.service.test.ts` (documented in 03-01 and 03-02 summaries) remains out of scope.

## User Setup Required

None - no external service configuration required beyond what Phase 3 Plan 01 established (MongoDB + Redis).

## Self-Check

- `apps/api/src/workers/search-session.worker.ts` — exists (commit a3f966a)
- `apps/api/src/workers/mock-data.generator.ts` — exists (commit a3f966a)
- `apps/api/src/modules/sessions/sessions.module.ts` — updated (commit f3603aa)
- Commits a3f966a and f3603aa confirmed in git log

## Self-Check: PASSED

## Next Phase Readiness

- Phase 3 is fully complete: all three plans (schema + types, API surface, worker process) delivered and E2E verified
- Phase 4 (Frontend SSE client + real search pipeline) can connect to `GET /sessions/:id/events` for live progress streaming
- Phase 4 replaces `generateMockSessionEvents` with real LinkedIn automation in `search-session.worker.ts` — worker architecture remains unchanged
- `SessionsService.appendEvent` remains the canonical write path for events — worker can also call it if direct MongoDB access is removed in Phase 4 refactor

---
*Phase: 03-sessions-bullmq*
*Completed: 2026-03-17*
