---
phase: 04-pipeline-search-scoring
plan: "03"
subsystem: api-workers
tags: [typescript, mongoose, bullmq, jsearch, anthropic, pipeline, scoring, sse]

# Dependency graph
requires:
  - phase: 04-pipeline-search-scoring/04-01
    provides: JobSearchAdapter, ScoringAdapter, SearchConfigSnapshotType, VacancyType interfaces
  - phase: 03-sessions-bullmq
    provides: BullMQ worker architecture, SessionModel, Redis SSE publisher
provides:
  - JSearchAdapter: fetches real jobs from RapidAPI with pagination and publisher->PlatformId mapping
  - ClaudeScoringAdapter: scores batches of 5 jobs via claude-sonnet-4-6-20250514
  - runSearchPipeline: orchestrates search->filter->dedup->score->persist->emit pipeline
  - Updated search-session.worker.ts: calls real pipeline instead of mock generator
affects:
  - Phase 5 ATS apply (pipeline provides vacancies with 'new' status ready for application)
  - Phase 6 frontend (job_found SSE events power the live session stream UI)

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk (apps/api dependency) — Claude API for batch job scoring"
  patterns:
    - "Adapter injection pattern: pipeline receives adapter/scorer as constructor params — fully mockable in tests"
    - "Duck-typed AnyModel interface: avoids Mongoose generic type incompatibilities with exactOptionalPropertyTypes"
    - "BATCH_SIZE=5 scoring loop: groups filtered jobs into 5-job batches before calling LLM"
    - "Ring-buffer event persistence: $push + $slice -100 keeps last 100 events per session"
    - "Graceful degradation: ClaudeScoringAdapter returns score=0 on API error so pipeline continues"

key-files:
  created:
    - apps/api/src/workers/adapters/jsearch.adapter.ts
    - apps/api/src/workers/adapters/claude-scoring.adapter.ts
    - apps/api/src/workers/pipeline.ts
    - apps/api/src/workers/adapters/jsearch.adapter.test.ts
    - apps/api/src/workers/adapters/claude-scoring.adapter.test.ts
    - apps/api/src/workers/pipeline.test.ts
  modified:
    - apps/api/src/workers/search-session.worker.ts
    - .env.example

key-decisions:
  - "AnyModel duck-type interface instead of Model<T> — avoids Mongoose generic incompatibilities with exactOptionalPropertyTypes strict mode"
  - "Pipeline emits 'missing_fields' (not 'excluded_company') for vacancies missing required fields — separate semantic reasons per plan requirement"
  - "JSearchAdapter.platform is 'linkedin' as default but actual per-result platform comes from job_publisher field via resolvePlatform()"
  - "ClaudeScoringAdapter uses claude-sonnet-4-6-20250514 model with max_tokens=1024 and 500-char description truncation"

patterns-established:
  - "Adapter injection: all external dependencies (JSearch API, Claude API, MongoDB, Redis) passed into runSearchPipeline via PipelineContext — no global state, fully testable"
  - "PUBLISHER_TO_PLATFORM map: case-insensitive partial matching maps JSearch job_publisher strings to PlatformId"

requirements-completed: [SRCH-03, AUTO-01, AUTO-02, AUTO-04, NF-02, APPLY-04]

# Metrics
duration: 21min
completed: 2026-03-18
---

# Phase 4 Plan 03: Search Pipeline (JSearch + Claude Scoring) Summary

**Real search pipeline replaces mock generator: JSearchAdapter (RapidAPI) + ClaudeScoringAdapter (claude-sonnet-4-6) wired into BullMQ worker with per-platform iteration, local filtering, dedup, batch scoring, and SSE event emission**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-18T12:03:44Z
- **Completed:** 2026-03-18T12:25:00Z
- **Tasks:** 2
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- Implemented JSearchAdapter fetching from `jsearch.p.rapidapi.com/search` with pagination, `PUBLISHER_TO_PLATFORM` map for `job_publisher` -> `PlatformId` mapping (LinkedIn -> linkedin, Indeed -> indeed, fallback -> linkedin)
- Implemented ClaudeScoringAdapter sending batches of up to 5 jobs to `claude-sonnet-4-6-20250514`, parsing JSON response, clamping scores 0-100, returning score=0 on API error (graceful degradation)
- Implemented `runSearchPipeline` orchestrating: per-platform search (20 results min), excluded companies filter, missing fields filter (reason: 'missing_fields'), dedup check against vacancies history, BATCH_SIZE=5 LLM scoring, VacancyModel.create persistence, SSE event emission (job_found, job_skipped, session_complete)
- Pipeline enforces `maxApplicationsPerSession` limit (APPLY-04) — stops as soon as `totals.found >= config.maxApplicationsPerSession`
- Pipeline checks cancellation before each batch — stops if session status == 'cancelled'
- Updated search-session.worker.ts — removed `generateMockSessionEvents` import, now loads session config and user profile from MongoDB, creates adapters from env vars, calls `runSearchPipeline`
- Added `RAPIDAPI_KEY` to `.env.example`
- 25 tests pass: 5 JSearch adapter tests + 8 Claude scoring tests + 12 pipeline tests

## Task Commits

Each task was committed atomically:

1. **Task 1: JSearchAdapter and ClaudeScoringAdapter with tests** — `71e61c1` (feat)
2. **Task 2: Pipeline orchestrator and worker replacement** — `72327eb` (feat)

## Files Created/Modified

- `apps/api/src/workers/adapters/jsearch.adapter.ts` — JSearchAdapter implementing JobSearchAdapter
- `apps/api/src/workers/adapters/claude-scoring.adapter.ts` — ClaudeScoringAdapter implementing ScoringAdapter
- `apps/api/src/workers/pipeline.ts` — runSearchPipeline orchestrator
- `apps/api/src/workers/adapters/jsearch.adapter.test.ts` — 13 tests (field mapping, pagination, publisher->platform mapping)
- `apps/api/src/workers/adapters/claude-scoring.adapter.test.ts` — included in 13 adapter tests
- `apps/api/src/workers/pipeline.test.ts` — 12 tests (platform iteration, filter flow, batch scoring, APPLY-04, cancellation)
- `apps/api/src/workers/search-session.worker.ts` — replaced mock generator with real pipeline
- `.env.example` — added RAPIDAPI_KEY

## Decisions Made

- AnyModel duck-type interface to avoid Mongoose generic incompatibilities with exactOptionalPropertyTypes — `Model<T>` assignments across strict schema boundaries fail with this compiler flag
- Pipeline emits reason 'missing_fields' for incomplete vacancies and 'excluded_company' for blocked companies — separate semantic reasons per plan requirement
- JSearchAdapter.platform is 'linkedin' as default; per-result platform determined from job_publisher via PUBLISHER_TO_PLATFORM case-insensitive matching
- ClaudeScoringAdapter uses claude-sonnet-4-6-20250514 with 500-char description truncation to keep prompts within token budget

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mongoose Model generic type incompatibility with exactOptionalPropertyTypes**
- **Found during:** Task 2 TypeScript check
- **Issue:** `Model<SessionDocumentRaw>` (strict: false schema) could not be assigned to `Model<unknown>` even with `as unknown as Model<unknown>` — Mongoose's `countDocuments().$where().exec()` return type mismatch under `exactOptionalPropertyTypes: true`
- **Fix:** Introduced `AnyModel` duck-typed interface with only the methods actually used by the pipeline (`findById`, `findByIdAndUpdate`, `updateOne`) — avoids the full Model generic signature incompatibility
- **Files modified:** `apps/api/src/workers/pipeline.ts`, `apps/api/src/workers/search-session.worker.ts`
- **Commit:** `72327eb`

## User Setup Required

Two API keys required before the pipeline can execute real searches:

| Key | Source | Used by |
|-----|--------|---------|
| `RAPIDAPI_KEY` | [RapidAPI Dashboard](https://rapidapi.com) → My Apps → Security | JSearchAdapter |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com) → API Keys | ClaudeScoringAdapter |

Both keys are documented in `.env.example`.

## Next Phase Readiness

- Worker now produces real vacancy documents in MongoDB with status='new' — ready for Phase 5 ATS apply pipeline
- `job_found` SSE events carry full vacancy data (title, company, score, url, platform) — ready for Phase 6 frontend live stream display
- JSearchAdapter can be replaced by any `JobSearchAdapter` implementation — adapter pattern is established
- ClaudeScoringAdapter can be replaced by a heuristic fallback if needed

---
*Phase: 04-pipeline-search-scoring*
*Completed: 2026-03-18*

## Self-Check: PASSED

- FOUND: apps/api/src/workers/adapters/jsearch.adapter.ts
- FOUND: apps/api/src/workers/adapters/claude-scoring.adapter.ts
- FOUND: apps/api/src/workers/pipeline.ts
- FOUND: apps/api/src/workers/search-session.worker.ts
- FOUND: commit 71e61c1
- FOUND: commit 72327eb
- TypeScript: zero errors (npx tsc --noEmit exits 0)
- Tests: 25 passing (12 pipeline + 13 adapters)
