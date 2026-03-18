---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in-progress
stopped_at: Completed 04-pipeline-search-scoring 04-03-PLAN.md
last_updated: "2026-03-18T12:26:10.320Z"
last_activity: 2026-03-12 — Plan 01-02 complete (NestJS infrastructure modules)
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 15
  completed_plans: 14
  percent: 75
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in-progress
stopped_at: Completed 01-foundation plan 01-02
last_updated: "2026-03-12T23:52:00Z"
last_activity: 2026-03-11 — Roadmap created from requirements + research
progress:
  [████████░░] 75%
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** The agent applies to compatible jobs on the user's behalf — so they never have to manually browse, filter, or fill application forms again.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 7 (Foundation)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-03-12 — Plan 01-02 complete (NestJS infrastructure modules)

Progress: [██░░░░░░░░] 10%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-foundation P01 | 14 | 3 tasks | 26 files |
| Phase 01-foundation P04 | 5 | 1 tasks | 1 files |
| Phase 02-auth-+-users P01 | 3 | 2 tasks | 12 files |
| Phase 02-auth-+-users P02 | 7 | 1 tasks | 7 files |
| Phase 02-auth-+-users P03 | 9 | 2 tasks | 7 files |
| Phase 02-auth-+-users PP04 | 6 | 2 tasks | 9 files |
| Phase 02-auth-+-users PPP05 | 11 | 3 tasks | 7 files |
| Phase 03-sessions-bullmq P01 | 9 | 2 tasks | 8 files |
| Phase 03-sessions-bullmq P02 | 15 | 2 tasks | 6 files |
| Phase 03-sessions-bullmq P03 | 10 | 3 tasks | 3 files |
| Phase 04-pipeline-search-scoring PP01 | 5 | 2 tasks | 7 files |
| Phase 04-pipeline-search-scoring P02 | 7 | 2 tasks | 9 files |
| Phase 04-pipeline-search-scoring P03 | 21 | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: NestJS Modular Monolith over microservices — simpler for MVP, modules can be extracted later
- [Pre-Phase 1]: Playwright workers must run in BullMQ worker process, never inside NestJS request handler — browser crash must not take down the API
- [Pre-Phase 1]: All session state and job deduplication must be in MongoDB from day one — no in-memory Maps or Sets
- [Pre-Phase 1]: Redis rate limiter keyed by (userId, linkedinEmail) required before multi-user automation — per-process setTimeout is not sufficient
- [Pre-Phase 1]: passport 0.7.x must NOT be upgraded to 1.0 — all installed OAuth strategies target 0.6-0.7 API
- [Phase 01-foundation]: npm overrides forces typescript 5.9.3 monorepo-wide; @nestjs/cli nested install persists but workspace source compiles against single version
- [Phase 01-foundation]: apps/api tsconfig.json excludes test files to prevent Plan 02 stubs from blocking Plan 01 tsc check
- [Phase 01-02]: JWT guard uses HS256 with JWT_SECRET in Phase 1; RS256 with asymmetric keys deferred to Phase 2 (OAuth token issuance)
- [Phase 01-02]: Coverage exclusions: auth/users (Phase 2), main.ts, app.module.ts, *.module.ts, *.constants.ts, correlation.interceptor.ts (requires live HTTP context)
- [Phase 01-02]: packages/api renamed to @job-agent/express-api to resolve workspace name collision with apps/api NestJS monolith
- [Phase 01-foundation]: dev:services prefixes concurrently with 'npm run build -w packages/core &&' so stale dist never blocks downstream compilation (build-before-watch pattern)
- [Phase 02-auth-+-users]: RedisModule is @Global() imported in AppModule — provides REDIS_CLIENT to all modules without per-module import
- [Phase 02-auth-+-users]: User schema uses Schema.Types.Mixed (type: Object) for profile/searchPresets — avoids nested schema class, TypeScript enforces shape
- [Phase 02-auth-+-users]: Auth code uses randomUUID() (crypto built-in UUID v4) rather than nanoid — no extra dependency, crypto module already imported
- [Phase 02-auth-+-users]: REFRESH_COOKIE_OPTIONS extracted as module-level const — avoids duplicating cookie options across exchange, refresh, and logout
- [Phase 02-auth-+-users]: mergeProfile uses fill-empty-only semantics: incoming CV data only fills null/empty fields, never overwrites manual edits
- [Phase 02-auth-+-users]: getUserId() helper in UsersController centralizes JWT userId extraction — all 10 endpoints read userId from JWT, never from body (NF-08)
- [Phase 02-auth-+-users]: PATCH /presets/active declared before /presets/:id to prevent NestJS route shadowing
- [Phase 02-auth-+-users]: initApiAuth pattern injects store accessors into axios interceptor at runtime — avoids circular import between api.ts and auth.store.ts
- [Phase 02-auth-+-users]: All API calls in apps/web must import from src/lib/api.ts — never raw fetch or new axios instances
- [Phase 02-auth-+-users]: ProfilePage and ConfigPage migrated from raw fetch() to api.ts — all web API calls now use the shared authenticated axios instance
- [Phase 02-auth-+-users]: PresetManagementSection manages its own state locally — separation of concerns without lifting preset state to ConfigPage parent
- [Phase 03-sessions-bullmq]: REDIS_SUBSCRIBER is a separate ioredis connection — subscriber mode locks connection, cannot share with REDIS_CLIENT
- [Phase 03-sessions-bullmq]: BullModule.forRootAsync at app root, BullModule.registerQueue per feature module (search-session queue in SessionsModule)
- [Phase 03-sessions-bullmq]: StoredSessionEvent.data is Record<string,unknown> — schema-agnostic, no migration needed for new event fields; nextEventId is monotonic int counter on Session document
- [Phase 03-sessions-bullmq]: SSE uses raw res.write not @Sse decorator — enables ownership validation before Content-Type header is set
- [Phase 03-sessions-bullmq]: Session config passed as empty {} in createSession — Phase 4 wires real preset resolution
- [Phase 03-sessions-bullmq]: child_process.fork chosen over BullMQ sandboxed processor — simpler path resolution for monorepo dist/ layout
- [Phase 03-sessions-bullmq]: Worker has its own ioredis + mongoose connections — no shared state with NestJS process, ensures crash isolation
- [Phase 03-sessions-bullmq]: mock-data.generator.ts is Phase 3 stub — Phase 4 replaces call site with real LinkedIn pipeline without touching worker architecture
- [Phase 04-pipeline-search-scoring]: VacanciesModule exports MongooseModule so downstream modules inject InjectModel(Vacancy.name) without re-importing the schema
- [Phase 04-pipeline-search-scoring]: ScoringAdapter.scoreBatch batches up to 5 jobs per call — callers are responsible for batching to stay within LLM token limits
- [Phase 04-pipeline-search-scoring]: userId+company+title dedup index uses collation strength 2 (case-insensitive) to catch duplicate postings with different title casing
- [Phase 04-pipeline-search-scoring]: createSession signature changed to (userId) only — service resolves SearchConfigSnapshotType internally from user's active preset, callers cannot inject arbitrary config
- [Phase 04-pipeline-search-scoring]: VacanciesModule exports VacanciesService and MongooseModule — service for worker pipeline use in Plan 03, MongooseModule for direct model injection downstream
- [Phase 04-pipeline-search-scoring]: AnyModel duck-type interface avoids Mongoose generic incompatibilities with exactOptionalPropertyTypes
- [Phase 04-pipeline-search-scoring]: Pipeline emits missing_fields for incomplete vacancies, excluded_company for blocked companies - separate semantic reasons per plan
- [Phase 04-pipeline-search-scoring]: JSearchAdapter maps job_publisher to PlatformId via case-insensitive PUBLISHER_TO_PLATFORM map, not hardcoded to linkedin

### Pending Todos

None yet.

### Blockers/Concerns

- [Research]: TypeScript version mismatch across monorepo — packages/core uses 5.4.5, apps/web uses ~5.9.3; resolve in Phase 1 architect task
- [Research]: GridFS vs S3 for CV storage undecided — must decide before Phase 2 implementation begins
- [Research]: shadcn/ui not yet initialized — Tailwind CSS v4 setup differs from v3 docs; verify before Phase 6 scaffolding
- [Research]: BullMQ 2-3 worker concurrency limit for LinkedIn safety is a soft constraint, not empirically validated for this codebase

## Session Continuity

Last session: 2026-03-18T12:26:10.316Z
Stopped at: Completed 04-pipeline-search-scoring 04-03-PLAN.md
Resume file: None
