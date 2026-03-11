# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** The agent applies to compatible jobs on the user's behalf — so they never have to manually browse, filter, or fill application forms again.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 7 (Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-11 — Roadmap created from requirements + research

Progress: [░░░░░░░░░░] 0%

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: NestJS Modular Monolith over microservices — simpler for MVP, modules can be extracted later
- [Pre-Phase 1]: Playwright workers must run in BullMQ worker process, never inside NestJS request handler — browser crash must not take down the API
- [Pre-Phase 1]: All session state and job deduplication must be in MongoDB from day one — no in-memory Maps or Sets
- [Pre-Phase 1]: Redis rate limiter keyed by (userId, linkedinEmail) required before multi-user automation — per-process setTimeout is not sufficient
- [Pre-Phase 1]: passport 0.7.x must NOT be upgraded to 1.0 — all installed OAuth strategies target 0.6-0.7 API

### Pending Todos

None yet.

### Blockers/Concerns

- [Research]: TypeScript version mismatch across monorepo — packages/core uses 5.4.5, apps/web uses ~5.9.3; resolve in Phase 1 architect task
- [Research]: GridFS vs S3 for CV storage undecided — must decide before Phase 2 implementation begins
- [Research]: shadcn/ui not yet initialized — Tailwind CSS v4 setup differs from v3 docs; verify before Phase 6 scaffolding
- [Research]: BullMQ 2-3 worker concurrency limit for LinkedIn safety is a soft constraint, not empirically validated for this codebase

## Session Continuity

Last session: 2026-03-11
Stopped at: Roadmap created, STATE.md initialized — ready to run /gsd:plan-phase 1
Resume file: None
