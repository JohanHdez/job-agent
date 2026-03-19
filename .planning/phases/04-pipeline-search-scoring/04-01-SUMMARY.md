---
phase: 04-pipeline-search-scoring
plan: "01"
subsystem: api
tags: [typescript, mongoose, nestjs, types, vacancy, scoring, search]

# Dependency graph
requires:
  - phase: 03-sessions-bullmq
    provides: Session schema pattern, AppModule registration pattern
  - phase: 01-foundation
    provides: packages/core type system, @job-agent/core barrel
provides:
  - VacancyType, VacancyStatus, SearchConfigSnapshotType in packages/core
  - JobSearchAdapter, RawJobResult, SearchParams interface contracts
  - ScoringAdapter, ScoredJob, ScoringInput interface contracts
  - JobSkippedEvent.reason extended with 'missing_fields'
  - Vacancy Mongoose schema with 4 dedup indexes
  - VacanciesModule registered in AppModule
affects:
  - 04-02 (NestJS wiring — VacanciesModule imported, types consumed)
  - 04-03 (worker pipeline — VacancyType, JobSearchAdapter, ScoringAdapter implemented)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapter interface pattern: JobSearchAdapter and ScoringAdapter decouple provider implementations from pipeline logic"
    - "Dedup index pattern: userId+url unique + userId+company+title unique (case-insensitive collation) for per-user vacancy deduplication"
    - "VacancyStatus state machine: new → applied | dismissed | failed"

key-files:
  created:
    - packages/core/src/types/vacancy.types.ts
    - packages/core/src/types/search-adapter.types.ts
    - packages/core/src/types/scoring-adapter.types.ts
    - apps/api/src/modules/vacancies/schemas/vacancy.schema.ts
    - apps/api/src/modules/vacancies/vacancies.module.ts
  modified:
    - packages/core/src/types/session.types.ts
    - packages/core/src/types/index.ts
    - apps/api/src/app.module.ts

key-decisions:
  - "VacancyType.filterReason is optional string union — only populated when a vacancy is dropped before persistence (missing_fields, excluded_company, duplicate, score_below_threshold)"
  - "ScoringAdapter.scoreBatch takes up to 5 jobs per call — callers are responsible for batching to stay within LLM token limits"
  - "VacanciesModule exports MongooseModule so downstream modules inject InjectModel(Vacancy.name) without re-importing the schema"
  - "userId+company+title dedup index uses collation strength 2 (case-insensitive) to catch duplicate postings with different title casing"

patterns-established:
  - "Adapter interface pattern: all swappable pipeline providers implement a named interface from packages/core"
  - "Schema dedup via compound unique indexes: per-user URL uniqueness plus per-user semantic uniqueness"

requirements-completed: [SRCH-03, AUTO-03, AUTO-04, HIST-04]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 4 Plan 01: Type Contracts and Vacancy Schema Summary

**VacancyType, JobSearchAdapter, ScoringAdapter interfaces defined in packages/core with Mongoose Vacancy schema and per-user dedup indexes registered in AppModule**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T11:55:54Z
- **Completed:** 2026-03-18T12:00:56Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Defined VacancyType with full field set (jobId, title, company, description, url, location, platform, postedAt, compatibilityScore, scoreReason, status, userId, sessionId, discoveredAt, filterReason) and SearchConfigSnapshotType in packages/core
- Defined JobSearchAdapter and ScoringAdapter swappable provider interfaces with SearchParams, RawJobResult, ScoringInput, ScoredJob supporting types
- Extended JobSkippedEvent.reason union with 'missing_fields' for semantic correctness in pipeline filtering
- Created Vacancy Mongoose schema with 4 indexes: userId+url unique, userId+company+title unique (case-insensitive), sessionId+score, userId+discoveredAt
- Registered VacanciesModule in AppModule; both packages/core and apps/api compile with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase 4 type contracts and extend JobSkippedEvent** - `e1c16bd` (feat)
2. **Task 2: VacanciesModule with Mongoose schema and dedup indexes** - `5b762bb` (feat)

**Plan metadata:** (docs commit — created below)

## Files Created/Modified
- `packages/core/src/types/vacancy.types.ts` - VacancyType, VacancyStatus, SearchConfigSnapshotType
- `packages/core/src/types/search-adapter.types.ts` - JobSearchAdapter, RawJobResult, SearchParams
- `packages/core/src/types/scoring-adapter.types.ts` - ScoringAdapter, ScoredJob, ScoringInput
- `packages/core/src/types/session.types.ts` - JobSkippedEvent.reason extended with 'missing_fields'
- `packages/core/src/types/index.ts` - barrel re-exports for three new type files
- `apps/api/src/modules/vacancies/schemas/vacancy.schema.ts` - Vacancy Mongoose schema with 4 indexes
- `apps/api/src/modules/vacancies/vacancies.module.ts` - VacanciesModule exporting MongooseModule
- `apps/api/src/app.module.ts` - VacanciesModule imported and registered

## Decisions Made
- VacancyType.filterReason is an optional union type — only set when a vacancy is dropped before completion, not for all vacancies
- ScoringAdapter.scoreBatch accepts up to 5 jobs — callers batch externally to manage LLM token limits
- VacanciesModule exports MongooseModule so downstream modules (Phase 4 plan 02+) can inject the Vacancy model token without duplicating schema registration
- userId+company+title unique index uses collation strength 2 to catch same-job postings with minor title casing differences

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 4 type contracts are in place and compilable
- VacanciesModule is registered and the Mongoose model is available for injection
- Phase 4 Plan 02 can immediately wire the search pipeline service using JobSearchAdapter and ScoringAdapter
- Phase 4 Plan 03 worker implementation has concrete interface contracts to implement against

---
*Phase: 04-pipeline-search-scoring*
*Completed: 2026-03-18*
