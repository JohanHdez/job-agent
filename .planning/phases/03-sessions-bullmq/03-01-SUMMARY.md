---
phase: 03-sessions-bullmq
plan: "01"
subsystem: infra
tags: [bullmq, ioredis, mongoose, nestjs, session-events, pub-sub]

# Dependency graph
requires:
  - phase: 02-auth-+-users
    provides: User schema pattern, RedisModule global provider pattern, AppModule structure
provides:
  - SessionStatus type and 7 typed session event interfaces in @job-agent/core
  - SessionEventUnion discriminated union and StoredSessionEvent for ring-buffer persistence
  - Session Mongoose schema with compound indexes (userId/status, userId/createdAt)
  - REDIS_SUBSCRIBER dedicated Pub/Sub injection token globally available
  - BullMQ registered at app root with search-session queue in SessionsModule
affects:
  - 03-02 (API endpoints consume Session schema, SessionsModule, and REDIS_SUBSCRIBER)
  - 03-03 (BullMQ worker process imports session types and uses search-session queue)

# Tech tracking
tech-stack:
  added: ["@nestjs/bullmq ^11.0.4", "bullmq ^5.71.0"]
  patterns:
    - "Dedicated subscriber ioredis instance separate from general-purpose REDIS_CLIENT"
    - "Session events stored as ring-buffer (StoredSessionEvent[]) with nextEventId monotonic counter"
    - "BullModule.forRootAsync at app root, BullModule.registerQueue per feature module"

key-files:
  created:
    - packages/core/src/types/session.types.ts
    - apps/api/src/modules/sessions/schemas/session.schema.ts
    - apps/api/src/common/redis/redis-subscriber.provider.ts
    - apps/api/src/modules/sessions/sessions.module.ts
  modified:
    - packages/core/src/types/index.ts
    - apps/api/src/common/redis/redis.module.ts
    - apps/api/src/app.module.ts
    - apps/api/package.json

key-decisions:
  - "REDIS_SUBSCRIBER is a separate ioredis connection — once subscribe() is called the connection enters subscriber mode and cannot run other commands"
  - "StoredSessionEvent stores data as Record<string, unknown> — schema-agnostic so adding new event fields never requires a migration"
  - "nextEventId field is a monotonic integer counter on the Session document — worker atomically increments and assigns IDs without a separate sequence collection"
  - "BullMQ connection uses url property (not host/port) in forRootAsync — consistent with ioredis URL format used by REDIS_CLIENT and REDIS_SUBSCRIBER"

patterns-established:
  - "Feature module pattern: register BullMQ queue and Mongoose model in module, add service/controller in next plan"
  - "Event interface discriminant: all event interfaces have a literal type field enabling exhaustive switch on SessionEventUnion"

requirements-completed: [RT-01, NF-05]

# Metrics
duration: 9min
completed: 2026-03-17
---

# Phase 03 Plan 01: Sessions Foundation Summary

**Session event types (7 interfaces + discriminated union), Session Mongoose schema with ring-buffer events, dedicated REDIS_SUBSCRIBER Pub/Sub provider, and BullMQ search-session queue registered in NestJS DI**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-17T18:59:05Z
- **Completed:** 2026-03-17T19:08:02Z
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 updated)

## Accomplishments
- Defined locked session event schema: `SessionStatus`, 7 typed event interfaces, `SessionEventUnion` discriminated union, and `StoredSessionEvent` — all in `@job-agent/core` and barrel-exported
- Created `Session` Mongoose schema with ring-buffer `events[]`, `nextEventId` counter, and two compound indexes covering per-user list queries
- Added `REDIS_SUBSCRIBER` as a second globally-available ioredis provider — dedicated for Pub/Sub subscriber mode (cannot share connection with REDIS_CLIENT)
- Registered `BullModule.forRootAsync` at app root and `search-session` queue inside `SessionsModule`, wired into `AppModule`

## Task Commits

Each task was committed atomically:

1. **Task 1: Define session event types and Session Mongoose schema** - `1625879` (feat)
2. **Task 2: Add Redis subscriber provider, BullMQ registration, and SessionsModule** - `3c1720d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/core/src/types/session.types.ts` - SessionStatus, 7 event interfaces, SessionEventUnion, StoredSessionEvent
- `packages/core/src/types/index.ts` - Added `export * from './session.types.js'` barrel re-export
- `apps/api/src/modules/sessions/schemas/session.schema.ts` - Session Mongoose class with all fields and compound indexes
- `apps/api/src/common/redis/redis-subscriber.provider.ts` - REDIS_SUBSCRIBER token and dedicated ioredis provider
- `apps/api/src/common/redis/redis.module.ts` - Extended to export both REDIS_CLIENT and REDIS_SUBSCRIBER globally
- `apps/api/src/modules/sessions/sessions.module.ts` - SessionsModule with BullMQ queue + Mongoose feature registration
- `apps/api/src/app.module.ts` - Added BullModule.forRootAsync and SessionsModule import
- `apps/api/package.json` - Added @nestjs/bullmq and bullmq dependencies

## Decisions Made
- REDIS_SUBSCRIBER uses a separate ioredis connection because subscriber mode locks the connection — the general-purpose REDIS_CLIENT must remain available for SET/GET/PUBLISH
- `StoredSessionEvent.data` is `Record<string, unknown>` (not a union) — allows new event fields to be stored without schema migration; TypeScript shape is enforced in the worker, not in MongoDB
- `nextEventId` is an integer on the Session document rather than a UUID or timestamp — simpler atomic increment with `$inc` in MongoDB update operations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing flaky test in `apps/api/src/modules/users/users.service.test.ts` (`throws RequestTimeoutException when runCvParser exceeds 7 seconds`) times out when running the full test suite. Confirmed pre-existing by running in isolation against HEAD before any changes. Out of scope for this plan — logged to deferred items.

## Next Phase Readiness
- Plan 02 (API endpoints) can now import `Session`, `SessionSchema`, and `SessionsModule` directly
- `REDIS_SUBSCRIBER` is globally injectable — SSE gateway in Plan 02 can subscribe to per-session Pub/Sub channels
- `search-session` BullMQ queue is available in DI — Plan 03 (worker) registers a processor against this queue name

---
*Phase: 03-sessions-bullmq*
*Completed: 2026-03-17*
