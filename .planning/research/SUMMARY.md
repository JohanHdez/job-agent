# Project Research Summary

**Project:** Job Agent — CLI-to-SaaS Evolution
**Domain:** Job Search Automation SaaS (Brownfield Migration)
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

Job Agent is a brownfield migration of a working CLI-based LinkedIn automation tool into a multi-tenant SaaS product. The existing codebase has the hardest parts already built and proven: Playwright automation with bilingual EN/ES selectors, Claude API-powered CV parsing, multi-platform search (LinkedIn + Indeed + Computrabajo), and MCP server architecture. The migration challenge is not building features from scratch — it is safely lifting single-user CLI infrastructure into a multi-user SaaS environment without breaking what already works. The recommended approach is a NestJS Modular Monolith acting as the HTTP/SSE gateway, with Playwright automation workers decoupled via BullMQ (Redis-backed), React 19 + Vite on the frontend, and MongoDB for all persistence. Existing packages are consumed as internal libraries, not rewritten.

The most critical architectural decision is keeping Playwright workers in a separate Node.js process from the NestJS API server. This is non-negotiable: a browser crash must never take down the API. The second most critical decision is eliminating all in-memory state (session state, progress events, job deduplication) in favor of MongoDB + Redis. Both of these are currently gaps in the codebase (confirmed in CONCERNS.md) and represent the highest-risk items if not addressed in Phase 1. Every other feature is standard, well-documented SaaS work.

The feature dependency chain is strictly linear: OAuth + JWT must come before per-user profile, which must come before per-user search config, which must come before automation, which must come before history and reporting. There are no parallel tracks until Phase 4-5 (pipeline steps) and Phase 6 (React frontend) can run concurrently once the Phase 3 BullMQ + SSE contract is stable. The binding scalability constraint at all scales is LinkedIn rate limits, not compute — the Redis rate limiter keyed by credential pair is the single most important infrastructure piece after MongoDB connectivity.

---

## Key Findings

### Recommended Stack

The stack is largely locked by what is already installed and working. The frontend is React 19.2.0 + Vite 7.3.1 with TanStack Query v5, Zustand v5, and Tailwind CSS v4 — all installed and verified from package.json. The backend is NestJS 10.3.8 with Mongoose 8.4.1, passport 0.7.x (must NOT be upgraded to 1.0 — breaking API), JWT, and the full OAuth strategy set for LinkedIn and Google. The existing automation packages (Playwright 1.44.1, @anthropic-ai/sdk 0.78.0, @modelcontextprotocol/sdk 1.0.4) must not be changed. Critical missing pieces are: `shadcn/ui` (not yet initialized), `axios` (HTTP client for frontend), `react-hook-form + zod` (form handling), `ioredis` (Redis session + rate limiting), `@nestjs/throttler` (API rate limiting), `@nestjs/bullmq` (worker queue), `cookie-parser` (refresh token transport), and `supertest` (NestJS integration tests). Zod belongs in `packages/core` and is shared across both the frontend form layer and the backend config validation layer — it does not replace `class-validator` in NestJS DTO binding.

**Core technologies:**
- React 19 + Vite 7: UI framework + build tool — already installed, React 19 is backwards compatible with "18+" requirement in CLAUDE.md
- NestJS 10 Modular Monolith: API gateway + domain orchestrator — replaces packages/api (Express), NOT microservices for MVP
- BullMQ (Redis): Playwright worker queue — critical isolation layer; Playwright must not run inside NestJS
- MongoDB + Mongoose 8: Primary persistence — flexible document model suits variable job fields across platforms
- Redis + ioredis: Session state, BullMQ queues, rate limiter — solves all three CONCERNS.md blocking issues
- TanStack Query v5 + Zustand v5: Frontend server state + UI state — already installed, standard pattern
- Tailwind CSS v4 + shadcn/ui: Styling + component library — Tailwind v4 has no tailwind.config.js (CSS-native config)
- Winston + packages/logger: Structured logging — factory already built, migration to all packages pending
- passport 0.7.x: OAuth strategies — do NOT upgrade to 1.0; all installed strategies target 0.6-0.7 API

### Expected Features

The feature dependency chain runs in strict linear order from auth through reporting. Table stakes and differentiators are clear, and what NOT to build is well-defined.

**Must have (table stakes):**
- OAuth login (LinkedIn + Google) with JWT access + refresh tokens — users expect SSO; per-user data isolation is a critical trust requirement
- Per-user profile from CV upload or LinkedIn import — core input to the automation pipeline
- Per-user search config persisted in MongoDB (not config.yaml) — required for multi-device, multi-session access
- Automated multi-platform search + compatibility scoring 0-100 — the reason the product exists; scoring without noise
- Cross-session job deduplication — applying twice to the same job destroys user credibility
- LinkedIn Easy Apply automation with rate limiting (8-12s) and CAPTCHA detection — account safety is non-negotiable
- Full application history with filters by date, platform, company, status — users need proof of what happened
- Session reports with totals, sent emails log, and job links — minimum viable audit trail

**Should have (differentiators — to build):**
- Real-time session progress via SSE — users watch the agent work live; trust and engagement differentiator
- Email apply via Claude API with approval modal — AI-generated emails + user review before send; LATAM differentiator
- Aggregated metrics dashboard — response rate, top platforms, most-applied companies
- Multiple search presets — power users run different configs for different job types
- Manual application status tracking — interview scheduled, offer received, rejected (closes the loop)

**Defer (v2+):**
- Mobile app (React Native + Expo SDK 51+) — web-first MVP; shared packages/hooks ready for Phase 2
- Auto-apply on Indeed/Computrabajo — LinkedIn Easy Apply is the only reliable programmatic flow for MVP
- Subscription/payments — MVP is personal/team use; monetization is Phase 3+
- Automated email reply tracking — inbox access requires Gmail/Outlook OAuth; high privacy sensitivity
- ML-based scoring — Claude API is fast and accurate enough; custom ML is months of work

**SaaS hardening required (exist in code, need multi-user treatment):**
- config.yaml → MongoDB per-user config document
- output/ files → per-user MongoDB or S3 storage (no shared filesystem)
- Single LinkedIn session → per-user browser session isolation in BullMQ worker
- In-memory rate limiter → Redis-backed per-credential-pair rate tracking
- In-memory deduplication → MongoDB persistent per-user job history

### Architecture Approach

The architecture is a NestJS Modular Monolith (HTTP/SSE gateway) + Playwright worker processes decoupled via BullMQ. React frontend communicates exclusively via HTTP + SSE to NestJS. Existing packages (cv-parser, job-search, linkedin-mcp, ats-apply, reporter) are consumed as internal libraries by NestJS modules and workers — they are not rewritten. MongoDB uses single-instance with domain-namespaced collections; Redis serves BullMQ queues, JWT refresh tokens, and per-credential rate limit locks. Maximum BullMQ concurrency is 2-3 Playwright workers to respect LinkedIn rate limits.

**Major components:**
1. React 19 + Vite (apps/web) — auth UI, config form, dashboard, session progress via EventSource, history, reports
2. NestJS Modular Monolith (apps/microservices/api) — AuthModule, UsersModule, JobsModule, ApplicationsModule, SessionsModule; HTTP port 4000
3. BullMQ Playwright Workers (apps/microservices/api/src/worker.main.ts) — isolated Node.js process; runs cv-parser, job-search, linkedin-mcp, ats-apply, reporter pipeline; emits progress via BullMQ
4. MongoDB — collections: users, sessions, jobs, applications; all queries scoped by userId
5. Redis — BullMQ queues, JWT refresh token store, apply rate limiter (12s window per credential pair), active session lock
6. packages/ (existing libraries) — packages/core (types), packages/logger (Winston factory), packages/cv-parser, packages/job-search, packages/linkedin-mcp, packages/ats-apply, packages/reporter

### Critical Pitfalls

1. **In-memory session state blocks multi-tenancy (P-01)** — all session state must go to MongoDB scoped by userId + sessionId from day one; any module-level Map or Set holding per-session data is a blocker; must be in Phase 1
2. **Playwright inside NestJS request handler causes OOM crashes (P-05)** — Playwright must run only in BullMQ worker process; any playwright import in apps/microservices/ or packages/api/src/ is a critical defect; BullMQ worker scaffold must be in Phase 3 before any automation is wired
3. **Missing userId scope on MongoDB queries exposes all users' data (P-04)** — every Mongoose find/update in jobs, applications, and sessions services must include userId filter; enforce from the first data endpoint; add cross-user query test to CI
4. **LinkedIn ban from cross-user rate limit bypass (P-02)** — Redis-backed rate limiter keyed by (userId, linkedinEmail) is required before running automation with multiple users; per-process setTimeout is not sufficient for concurrent sessions
5. **SSE event loss on client reconnect (P-06)** — persist every progress event to MongoDB; SSE endpoint must replay from MongoDB using Last-Event-ID; in-memory EventEmitter alone is not acceptable

---

## Implications for Roadmap

Based on combined research, the dependency graph is strict and phases cannot be reordered. The architecture, features, and pitfall research all converge on the same seven-phase sequence.

### Phase 1: Foundation
**Rationale:** Nothing compiles, connects, or is secure without this. Shared types, MongoDB connectivity, Redis connectivity, NestJS app scaffold, structured logging in DI, and global auth guard must all exist before any domain module is written.
**Delivers:** Working NestJS app with database connections, shared types audit complete, packages/logger wired to NestJS DI, global JwtAuthGuard as APP_GUARD
**Addresses:** Per-user data isolation prerequisite (FEATURES.md table stakes), config.yaml migration groundwork
**Avoids:** P-01 (in-memory state), P-03 (token encryption from day one), P-04 (userId scope enforced from first query), P-09 (global auth guard, not per-controller), P-11 (no static CV file serving), P-13 (Zod CV parser confidence score)

### Phase 2: Auth + Users
**Rationale:** Every subsequent feature is user-scoped. Without working OAuth + JWT there is no safe surface to deploy, no per-user config, and no CV to parse.
**Delivers:** LinkedIn OAuth + Google OAuth flows, JWT access + refresh tokens, per-user profile endpoints, CV upload to GridFS/S3, per-user AppConfigType in MongoDB
**Addresses:** Authentication & Identity (FEATURES.md table stakes), Profile Management (FEATURES.md table stakes), Search Configuration persistence
**Avoids:** P-03 (AES-256-GCM encryption for OAuth tokens before any credential is stored), P-04 (userId scoping on UsersModule queries)
**Uses:** passport 0.7.x + passport-linkedin-oauth2 + passport-google-oauth20, @nestjs/jwt, cookie-parser, ioredis (refresh token store)

### Phase 3: Sessions Module + BullMQ Worker Scaffold
**Rationale:** This is the backbone of the automation product. Validate the async pipeline and SSE bridge with a stub worker before introducing Playwright risk. All subsequent phases plug real pipeline steps into this scaffold.
**Delivers:** POST /sessions (202 Accepted + sessionId), GET /sessions/:id/events (SSE with MongoDB replay), BullMQ worker process bootstrapped and processing queue, end-to-end SSE flow validated with stub implementation
**Addresses:** Real-time session progress (FEATURES.md differentiator), SaaS hardening of SSE
**Avoids:** P-05 (BullMQ isolation established before any Playwright code is added), P-06 (MongoDB event persistence + Last-Event-ID replay from day one)

### Phase 4: Pipeline — CV Parser + Job Search
**Rationale:** These are non-destructive pipeline steps with no LinkedIn interaction. Safe to test and iterate. Validates full data pipeline from CV upload to scored job list before automation risk is introduced.
**Delivers:** Worker runs cv-parser from GridFS/S3 buffer, worker runs multi-platform search (LinkedIn, Indeed, Computrabajo), scored JobListing[] persisted to MongoDB, GET /jobs endpoint, real-time job_found events in browser
**Addresses:** Automated job search + scoring (FEATURES.md table stakes), Platform selection (LinkedIn + Indeed + Computrabajo)
**Avoids:** P-08 (MongoDB deduplication with unique compound index from first job persist), P-13 (CV parser confidence score check in worker)
**Note:** React frontend development can begin in parallel here once Phase 3 API contract is stable.

### Phase 5: Application Automation
**Rationale:** Most complex and highest-risk phase. LinkedIn credential handling, rate limiting, CAPTCHA, and multi-step form parsing all converge here. Building after safer pipeline steps reduces debugging surface area significantly.
**Delivers:** Worker applies via Easy Apply and ATS handlers, Redis rate limiter enforced (12s per credential pair), ApplicationRecord persisted per attempt, CAPTCHA detection pauses session + SSE alert, GET /applications history, PATCH /applications/:id manual status
**Addresses:** Easy Apply automation (FEATURES.md table stakes), application history (FEATURES.md table stakes), CAPTCHA detection (FEATURES.md table stakes)
**Avoids:** P-02 (Redis rate limiter keyed by linkedinEmail, not per-process), P-05 (already isolated in worker from Phase 3), P-07 (Easy Apply confirmation modal assertion), P-08 (dedup fully enforced)

### Phase 6: React Frontend
**Rationale:** Can run partially in parallel with Phase 4-5 once Phase 3 API contract is stable. Full integration requires Phase 4-5 to complete. Frontend depends on NestJS auth (Phase 2) and SSE (Phase 3) being stable first.
**Delivers:** OAuth login page, dashboard with live SSE session progress, search config form wired to AppConfigType, job results with score badges, application history with CSV export, CV upload + profile editor
**Addresses:** All frontend-facing features from FEATURES.md, shadcn/ui initialization, react-hook-form + zod form validation
**Avoids:** P-10 (Zod validation on config form before save), P-11 (CV served only via authenticated endpoint)
**Uses:** shadcn/ui (npx shadcn@latest init), axios with JWT interceptor, react-hook-form + zod, TanStack Query v5, Zustand v5, Tailwind CSS v4 (no tailwind.config.js)

### Phase 7: Reports + Export + Metrics Dashboard
**Rationale:** Read-only aggregation over data produced in earlier phases. No other phase depends on it. Safe to defer until core automation loop is proven end-to-end.
**Delivers:** packages/reporter writing to MongoDB session document, GET /sessions/:id/report (HTML/Markdown), GET /applications/export (CSV stream), aggregated metrics dashboard (total applications, response rate, top job titles)
**Addresses:** Session reports (FEATURES.md table stakes), emails log, metrics dashboard (FEATURES.md differentiator)
**Avoids:** P-12 (timeout on Claude API calls in email apply module)

### Phase Ordering Rationale

- Foundation before Auth because NestJS DI, MongoDB connectivity, and shared types must exist before any module is written
- Auth before everything else because all data is user-scoped; without JWT there is no safe API surface
- Sessions + BullMQ scaffold before pipeline because the worker isolation pattern must be proven with a stub before Playwright is introduced — this prevents P-05 from ever occurring
- CV Parser + Job Search before Application Automation because non-destructive steps validate the pipeline safely before LinkedIn credentials are used
- React Frontend runs from Phase 4 onward in parallel; full integration waits for Phase 5 completion
- Reports last because they are pure aggregation with no upstream dependencies

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (BullMQ + SSE):** BullMQ progress event bridging to NestJS SSE with MongoDB persistence is a moderately complex integration; review @nestjs/bullmq processor patterns and QueueEvents listener API before writing
- **Phase 5 (Application Automation):** LinkedIn Easy Apply form detection is the most brittle part of the system; CAPTCHA handling + credential isolation + Redis rate limit coordination all meet here; detailed task-level planning recommended
- **Phase 6 (React Frontend):** shadcn/ui initialization with Tailwind CSS v4 (no tailwind.config.js) may differ from documented v3 setup steps; verify before scaffolding

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Standard NestJS app bootstrap + Mongoose + ioredis — well-documented patterns
- **Phase 2 (Auth + Users):** NestJS + Passport OAuth flows are extensively documented; existing strategies already installed
- **Phase 4 (Pipeline):** Calling existing package functions from BullMQ worker is straightforward; packages already work in CLI mode
- **Phase 7 (Reports):** Read-only aggregation queries + CSV streaming — standard NestJS patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions read directly from installed package.json files; MISSING packages are standard, established choices solving documented gaps |
| Features | HIGH | Derived from PROJECT.md requirements doc + direct codebase analysis (CONCERNS.md, INTEGRATIONS.md); no speculation |
| Architecture | HIGH | Based on direct codebase analysis, PROJECT.md constraints, and established NestJS + BullMQ patterns; one key assumption (BullMQ for worker isolation) is the strongest available pattern for this use case |
| Pitfalls | HIGH | All critical pitfalls are directly documented in CONCERNS.md; not inferred from general knowledge |

**Overall confidence:** HIGH

### Gaps to Address

- **TypeScript version mismatch across monorepo:** packages/core uses TypeScript 5.4.5; apps/web uses ~5.9.3. Subtle type incompatibilities possible when shared types are consumed. Resolve by upgrading to a common version (5.9.x recommended) — architect task in Phase 1.
- **Playwright version update:** 1.44 is mid-2024; latest 1.x has improved Chromium detection evasion relevant to LinkedIn. Update caret range to `^1.44.1` and run install:browsers. Minor risk, schedule during Phase 4.
- **packages/logger migration:** The shared logger factory exists but migration of all packages to use it is pending. Must complete before NestJS modules are wired (Phase 1 task).
- **NestJS BullMQ concurrency limit:** 2-3 Playwright workers is the stated safe maximum for LinkedIn rate limits. This is a soft constraint based on observed behavior, not a published LinkedIn limit. Validate during Phase 5 with staged rollout.
- **GridFS vs S3 for CV storage:** ARCHITECTURE.md mentions GridFS or S3-compatible storage. The choice has infrastructure implications (GridFS = zero new services; S3 = external dependency). Decide before Phase 2 implementation begins.

---

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — MVP requirements, tech stack constraints, key architectural decisions
- `.planning/codebase/CONCERNS.md` — In-memory session state debt, scaling limits, rate limiting gaps, security vulnerabilities
- `.planning/codebase/ARCHITECTURE.md` — Current system structure and existing package inventory
- `apps/web/package.json`, `apps/microservices/user-service/package.json`, `packages/*/package.json` — Exact installed versions (read 2026-03-11)
- `CLAUDE.md` — Non-negotiable coding rules, naming conventions, testing gates

### Secondary (MEDIUM confidence)
- NestJS 10.x BullMQ processor + QueueEvents patterns: training data aligned with official documentation
- LinkedIn rate limit constraints (3-5s search, 8-12s apply): directly observed in existing codebase implementation
- Tailwind CSS v4 CSS-native configuration: training data as of August 2025

### Tertiary (LOW confidence)
- BullMQ concurrency sweet spot (2-3 workers) for LinkedIn safety: based on rate limit reasoning, not empirical measurement from this codebase

---

*Research completed: 2026-03-11*
*Ready for roadmap: yes*
