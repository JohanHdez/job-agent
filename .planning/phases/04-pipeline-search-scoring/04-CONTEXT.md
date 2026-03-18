# Phase 4: Pipeline — Search + Scoring - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

The BullMQ worker runs the full non-destructive pipeline: resolve the user's active search preset, search jobs via the JSearch REST API (RapidAPI), score each vacancy 0-100 using a hybrid local + LLM engine, persist vacancies to a dedicated MongoDB collection, deduplicate against history, enforce excluded companies filter, and emit real-time `job_found` SSE events — all without touching any apply flow.

This phase replaces the `mock-data.generator.ts` stub in the worker with the real pipeline. The worker architecture, event schema, and BullMQ/Redis/MongoDB infrastructure from Phase 3 remain unchanged.

</domain>

<decisions>
## Implementation Decisions

### Search integration
- Use **JSearch API (RapidAPI)** for all job searches — NOT Playwright scraping for Phase 4
- Worker makes paginated requests to JSearch until minimum **20 results** are collected per search
- Search parameters sourced from the user's **active preset**: `keywords`, `location`, `jobType` (modality)
- Do NOT do external research on JSearch API during planning — use JSearch specs directly from the API docs

### Preset wiring at session start
- `POST /sessions` resolves the user's active preset at session creation time and **embeds a `SearchConfigSnapshot` in the Session MongoDB document** (not just `{}` as in Phase 3 stub)
- The BullMQ worker reads the embedded config from MongoDB (existing pattern) — no payload bloat
- This ensures the session config is immutable and reproducible even if the user changes their preset mid-session

### Vacancy storage model
- Create a dedicated **`vacancies` MongoDB collection** (not embedded in session events)
- Required fields: `job_id` (unique index, from JSearch), `title`, `company`, `description`, `url`, `location`, `posted_at`, `compatibility_score`
- Each vacancy is related to the current session via a `sessionId` field
- Each vacancy is owned by a user via a `userId` field (row-level security per NF-08)
- Deduplication: a vacancy with the same `url` OR `(company + title)` already seen by this user is skipped — checked against the `vacancies` collection history

### Hybrid scoring engine
- **Two layers — run in order:**

  **Layer 1 — Local TypeScript filter (fast, free):**
  - Filter out vacancies missing required fields (title, company, description, url)
  - Filter out vacancies containing negative keywords from user's `excludedCompanies` list
  - Filter out already-seen URLs or (company + title) deduplication hits
  - Assign score = 0 and mark `reason = 'filtered_local'` to skipped items

  **Layer 2 — LLM batch scoring (Claude API, claude-sonnet-4-6):**
  - Send **5 job descriptions per LLM call** in a single message (batch to amortize latency)
  - Request JSON response: `[{ "index": 0, "score": 0-100, "reason": "<max 15 words>" }, ...]`
  - Prompt must be minimalist — optimized for token cost, not verbosity
  - Scoring criteria: skills match vs `ProfessionalProfileType.skills`, seniority match, language match, modality match, salary (if present)
  - NF-02 target: < 500ms per vacancy at p95. With batching of 5, total LLM call budget is < 2.5s for a batch

- Scoring is **stateless per batch** — no accumulated context between batches

### SSE event flow
- Worker emits **`job_found`** events (locked Phase 3 schema) as each vacancy passes scoring and is saved to DB
  - Note: user referred to this as `job_discovered` in their notes — this maps to the locked `job_found` event type; planner must NOT introduce a new event type
- Worker emits **`job_skipped`** for vacancies filtered by deduplication, excluded companies, or score < `minScoreToApply`
- Worker emits **`session_complete`** after processing all paginated results (when total vacancies found ≥ 20 or JSearch exhausted)
- All events go through the existing Redis Pub/Sub channel → NestJS SSE gateway (Phase 3 infrastructure, unchanged)

### Deduplication strategy
- Scope: **per-user** — a user never sees the same vacancy twice across sessions
- Match criteria: `url` (exact) OR `(company + title)` (case-insensitive, trimmed)
- Vacancies are stored in the `vacancies` collection permanently (no TTL) — this IS the history
- "Not interested" (HIST-04): adds a `status: 'dismissed'` field to the vacancy document — marks it as excluded from all future searches without deleting it

### Session limit enforcement (APPLY-04 in scope for Phase 4)
- `maxApplicationsPerSession` from the user's active preset is passed in `SearchConfigSnapshot`
- Worker tracks application count and stops applying (but continues searching) when limit is reached
- A `session_complete` event includes the totals (found, applied, skipped, failed) per Phase 3 schema

### Future-proofing (decouple for tiering)
- Wrap JSearch calls behind a `JobSearchAdapter` interface so the API provider can be swapped (e.g., Adzuna)
- Wrap LLM scoring behind a `ScoringAdapter` interface so AI scoring can be disabled per user tier
- These are adapter interfaces in the worker — no impact on NestJS API layer

### Claude's Discretion
- Exact Mongoose schema for `vacancies` collection (indexes, TTL if any)
- JSearch API pagination implementation (page size, retry on rate limit)
- LLM batch scoring prompt exact wording (must be minimalist)
- MongoDB index strategy for deduplication lookups (url + userId, company + title + userId)
- Error handling when JSearch returns < 20 results (partial results are acceptable — emit what was found)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Types and contracts
- `packages/core/src/types/index.ts` — barrel export; session event types (`SessionEventUnion`, `JobFoundEvent`, `JobSkippedEvent`, `SessionCompleteEvent`) are defined here
- `packages/core/src/types/config.types.ts` — `AppConfig` / `SearchConfigSnapshot` shape; `PlatformId` enum; `AppConfig.search.excludedCompanies`, `AppConfig.matching.minScoreToApply`, `AppConfig.matching.maxApplicationsPerSession`
- `packages/core/src/types/cv.types.ts` — `ProfessionalProfileType` — scoring layer compares job descriptions against this type

### Worker (extend, don't replace)
- `apps/api/src/workers/search-session.worker.ts` — standalone BullMQ worker; Phase 4 replaces the `generateMockSessionEvents()` call site with the real pipeline; architecture unchanged
- `apps/api/src/workers/mock-data.generator.ts` — Phase 3 stub to be replaced; keep the file as reference for event shapes

### Phase 3 infrastructure (read-only — do not modify)
- `.planning/phases/03-sessions-bullmq/03-CONTEXT.md` — locked event schema, Redis Pub/Sub channel naming, ring-buffer MongoDB append pattern, cancellation check pattern
- `apps/api/src/modules/sessions/` — NestJS SessionsModule, SSE endpoint, POST /sessions — Phase 4 only modifies POST /sessions to embed preset config into the session document

### Requirements
- `.planning/REQUIREMENTS.md` — SRCH-03, AUTO-01, AUTO-02, AUTO-03, AUTO-04, HIST-04, APPLY-04, NF-02

### Phase 2 context (user/profile patterns)
- `.planning/phases/02-auth-+-users/02-CONTEXT.md` — active preset resolution pattern (`activePresetId` on User document), getUserId() JWT pattern, row-level security pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/workers/search-session.worker.ts` — fully wired BullMQ worker; the `processSession()` function is the exact extension point for Phase 4
- `packages/cv-parser/` — CV parsing already implemented; NOT used directly in Phase 4 worker (profile already in MongoDB from Phase 2); worker reads `ProfessionalProfileType` from the User document in MongoDB
- `packages/core/src/types/` — `JobFoundEvent`, `JobSkippedEvent`, `SessionCompleteEvent` shapes; `AppConfig` search fields — all already defined
- `ioredis` + `mongoose` — already in worker's process; no new dependencies needed for pipeline wiring

### Established Patterns
- Worker reads session config from MongoDB by `sessionId` (not from BullMQ job payload) — already in place, Phase 4 extends this by populating `config` field at session creation
- Ring-buffer MongoDB append: `$push { $each: [event], $slice: -100 }` — reuse for each `job_found` event
- Redis Pub/Sub publish: `publisher.publish(channel, JSON.stringify(storedEvent))` — use for each `job_found` event
- Cancellation check before each event emission — pattern already implemented in worker loop

### Integration Points
- `POST /sessions` (SessionsController) → must look up `User.activePresetId`, load preset, and embed `SearchConfigSnapshot` in Session document before enqueuing BullMQ job
- Worker `processSession()` → reads `session.config` (now populated) → builds JSearch query → calls scoring adapter → emits `job_found` events via existing Redis Pub/Sub
- `vacancies` MongoDB collection → new; related to `sessions` collection via `sessionId`; related to `users` collection via `userId`
- `ScoringAdapter` → calls Claude API (`claude-sonnet-4-6`) with batch of 5 job descriptions → returns `[{ index, score, reason }]`

</code_context>

<specifics>
## Specific Ideas

- Scoring prompt must be minimalist — optimize for token cost, not verbosity. Score 5 jobs per LLM call. Return JSON `[{ "index": 0, "score": 0-100, "reason": "<max 15 words>" }]`.
- `JobSearchAdapter` interface wraps JSearch (RapidAPI) so it can be swapped for Adzuna or disabled per tier in the future.
- `ScoringAdapter` interface wraps the LLM call so scoring can be disabled for free-tier users without touching pipeline logic.
- Worker must remain fully async end-to-end — `POST /sessions` must return < 200ms regardless of pipeline duration.
- User noted: "job_discovered" in their context = `job_found` in the locked Phase 3 event schema. Do NOT introduce a new event type.

</specifics>

<deferred>
## Deferred Ideas

- Playwright-based scraping for Indeed/Computrabajo — using JSearch API for Phase 4 instead; Playwright scraping deferred to v2+ or a future phase
- Per-tier AI scoring toggle (disable for free users) — architecture is prepared via `ScoringAdapter` interface but the actual tiering logic belongs to a future billing/tier phase
- Adzuna or other API provider swap — `JobSearchAdapter` interface is in place but alternative providers are v2+
- Greenhouse / other ATS platform support — already deferred in REQUIREMENTS.md

</deferred>

---

*Phase: 04-pipeline-search-scoring*
*Context gathered: 2026-03-17*
