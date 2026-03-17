# Phase 3: Sessions + BullMQ - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can start a job search session via `POST /sessions` and watch real-time progress events in the browser via SSE — with events persisted to MongoDB so a page refresh or reconnect replays missed events from the correct position.

This phase delivers the infrastructure only: session lifecycle management, BullMQ worker process isolation, Redis Pub/Sub event bridge, SSE endpoint with Last-Event-ID replay, and a stubbed pipeline with realistic mock job data. The actual search, scoring, and application logic belongs to Phases 4 and 5.

</domain>

<decisions>
## Implementation Decisions

### Worker ↔ API event bridge
- Use **Redis Pub/Sub** to bridge BullMQ worker (separate process) → NestJS API (holds open SSE connections)
- Worker publishes events to a Redis channel keyed by `sessionId`; NestJS subscribes on SSE connect
- This keeps Worker and API fully decoupled — a worker crash does not affect the API process or other sessions
- `ioredis` is already installed; add a dedicated subscriber client instance (pub/sub requires a dedicated connection)

### Concurrent session policy
- **One active session per user at a time** (MVP constraint)
- `POST /sessions` while a session with `status: running` exists for that user → `409 Conflict` with body `{ code: "SESSION_ALREADY_ACTIVE", sessionId: "<existing>" }`
- User must wait for session to complete or call `DELETE /sessions/:id` to cancel before starting a new one
- Session statuses: `queued` → `running` → `completed` | `cancelled` | `failed`

### SSE replay strategy (Last-Event-ID)
- Session MongoDB document embeds an **`events` array** (not a separate collection)
- Maximum **100 events** per session stored in the array; oldest events are dropped when limit is reached (ring buffer semantics)
- Each stored event has: `{ id: number, type: string, data: object, timestamp: ISO string }`
- `id` is a monotonically increasing integer per session (starting at 1) — used as the SSE `id:` field
- On reconnect with `Last-Event-ID: N`: stream replays all stored events where `event.id > N`, then switches to live pub/sub
- Events TTL: Session documents are kept indefinitely (no expiry) — session history is part of the application record

### Event schema (locked in Phase 3)
- Lock the full event type union in `packages/core/src/types/session.types.ts` now — Phase 4 replaces stub data, not the schema
- Event types defined and produced in Phase 3 (with stub/mock data):
  - `session_started` — `{ sessionId, userId, config: SearchConfigSnapshot, timestamp }`
  - `job_found` — `{ jobId, title, company, location, platform, compatibilityScore, url, timestamp }`
  - `job_skipped` — `{ jobId, reason: 'score_too_low' | 'already_applied' | 'excluded_company', timestamp }`
  - `application_made` — `{ jobId, method: 'easy_apply' | 'email', status: 'success' | 'failed', timestamp }`
  - `session_complete` — `{ sessionId, totals: { found, applied, skipped, failed }, durationMs, timestamp }`
  - `session_error` — `{ code, message, recoverable: boolean, timestamp }`
  - `captcha_detected` — `{ jobId, platform, timestamp }` (worker pauses, emits this, waits for resume)
- **Stub data must be realistic**: mock `job_found` events use real-looking JSON (title, company, location, score, URL) so the React frontend can be fully implemented against this schema in Phase 6
- Phase 4 replaces the mock job generator with the real search + scoring pipeline; event shape is unchanged

### BullMQ worker design
- Single `search-session` queue; worker concurrency = **2** (LinkedIn safety constraint from prior decisions)
- Worker process spawned as a separate Node.js process (not a NestJS child module) — crash isolation requirement
- Worker reads session config from MongoDB (not passed in job payload) to avoid large BullMQ payloads
- Job payload: `{ sessionId: string, userId: string }` — minimal
- Worker publishes to Redis channel `session:{sessionId}:events` as JSON strings

### Claude's Discretion
- BullMQ job retry strategy (backoff, max attempts) for failed sessions
- Exact Mongoose schema for Session document (indexes, field ordering)
- NestJS SSE endpoint implementation pattern (@Sse decorator vs raw res.write)
- Redis subscriber connection management (reconnect on failure)
- Mock data generator implementation (static fixtures vs faker.js)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Types and contracts
- `packages/core/src/types/index.ts` — barrel export; session event types will be added here
- `packages/core/src/types/config.types.ts` — `AppConfigType` / `SearchConfigSnapshot` shape for session config
- `packages/core/src/types/cv.types.ts` — `ProfessionalProfileType` (referenced in session start payload)

### Existing infrastructure (extend, don't replace)
- `apps/api/src/modules/auth/` — JWT guard already global; sessions endpoint is protected automatically
- `apps/api/src/app.module.ts` — add SessionsModule, BullMQ registration, Redis pub/sub config here
- `apps/api/src/common/crypto/token-cipher.ts` — AES-256-GCM pattern; reuse if any session secrets need encryption

### Redis client
- `ioredis` already in `apps/api/package.json` — use the existing RedisModule (@Global) from Phase 2 for the publisher; add a second dedicated subscriber ioredis instance (pub/sub requires dedicated connection)

### Requirements
- `.planning/REQUIREMENTS.md` — RT-01 (SSE real-time), NF-05 (100 concurrent users)

### Phase 2 context (auth patterns to follow)
- `.planning/phases/02-auth-+-users/02-CONTEXT.md` — token delivery pattern, getUserId() from JWT, row-level security pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/modules/` — auth, health, logger, users modules already present; add `sessions/` module following same structure
- `ioredis` (^5.3.2) — already installed; use for both BullMQ backing store and pub/sub bridge
- `rxjs` (7.8.1) — available via NestJS; use `Observable` + `fromEvent` or `Subject` for NestJS @Sse stream if needed
- Phase 2 `getUserId()` pattern in UsersController — replicate for session ownership enforcement

### Established Patterns
- NestJS module structure: `sessions/sessions.module.ts`, `sessions.controller.ts`, `sessions.service.ts`, `schemas/session.schema.ts`
- Global JWT guard + `@Public()` escape hatch — no extra auth wiring needed for sessions endpoints
- `createLogger(serviceName)` from `@job-agent/logger` — use in both SessionsService and worker process
- `packages/core` as single source of truth — define `SessionEventType` union there, import in API and worker

### Integration Points
- `POST /sessions` → SessionsService → creates MongoDB Session doc → enqueues BullMQ job → returns `{ sessionId }` (202)
- `GET /sessions/:id/events` → NestJS SSE endpoint → subscribes to Redis pub/sub channel → streams to browser
- Worker process → publishes to Redis `session:{sessionId}:events` → NestJS re-emits to SSE clients
- Worker also writes each event to Session.events array in MongoDB (for replay)
- `DELETE /sessions/:id` → sets status=cancelled → worker detects cancellation flag on next tick → stops

</code_context>

<specifics>
## Specific Ideas

- "Lock the event schema and validate the Redis ↔ SSE bridge immediately" — Phase 3 is about proving the infrastructure works, not building real search logic
- Mock `job_found` events must use realistic JSON (real-looking job titles, companies, scores, URLs) so the React frontend in Phase 6 can be fully built against this schema without waiting for Phase 4
- Phase 3 keeps scope focused on NF-05 (100 concurrent users) and RT-01 (real-time SSE without polling) — the pipeline is intentionally a stub

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-sessions-bullmq*
*Context gathered: 2026-03-17*
