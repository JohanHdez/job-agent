# Roadmap: Job Agent SaaS MVP

## Overview

Job Agent evolves from a working CLI automation tool into a multi-user SaaS platform. The journey follows a strict dependency chain: infrastructure and security must be solid before any user-facing feature is safe to build. Auth and profile management come before search configuration, which unlocks the automation pipeline, which enables history and reporting. The React frontend wires into a fully operational backend. Seven phases, each delivering a coherent and verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - NestJS app scaffold, MongoDB + Redis connectivity, shared types audit, structured logging in DI, global auth guard
- [ ] **Phase 2: Auth + Users** - LinkedIn OAuth, Google OAuth, JWT refresh, per-user profile (CV upload + LinkedIn import), search config presets
- [x] **Phase 3: Sessions + BullMQ** - POST /sessions endpoint, SSE with MongoDB replay, BullMQ worker process isolated from NestJS, stub pipeline validated end-to-end (completed 2026-03-18)
- [x] **Phase 4: Pipeline — Search + Scoring** - CV parser in worker, multi-platform search, compatibility scoring 0-100, MongoDB deduplication, excluded companies filter, session limit enforcement (completed 2026-03-18)
- [ ] **Phase 5: Application Automation** - LinkedIn Easy Apply via worker, email apply via Claude API + SMTP, Redis rate limiter, CAPTCHA detection, application history with manual status
- [ ] **Phase 6: React Frontend** - OAuth login page, dashboard with live SSE progress, search config form, job results with scores, application history with CSV export, profile editor
- [ ] **Phase 7: Reports + Metrics** - Session reports (HTML/Markdown/PDF), emails log, aggregated metrics dashboard, CSV + PDF export

## Phase Details

### Phase 1: Foundation
**Goal**: The NestJS application boots with database connections, shared types are audited as the single source of truth, structured logging is wired into DI, and every API route is protected by a global JWT guard — so no domain module can be written without security or observability in place.
**Depends on**: Nothing (first phase)
**Requirements**: NF-06, NF-07, NF-09, NF-10, NF-11, NF-12, NF-13, NF-17
**Success Criteria** (what must be TRUE):
  1. NestJS app starts, connects to MongoDB and Redis, and GET /health returns `{ status, uptime, version }` in under 100ms
  2. Every API request without a valid JWT receives a 401 response — no route is accidentally public
  3. All packages/core shared types compile under TypeScript strict mode with zero errors and zero `any`
  4. Every NestJS module logs structured JSON (correlationId, userId, ISO timestamp) via the shared Winston factory — no `console.log` in any module
  5. CI/CD pipeline runs on every push: tsc --noEmit passes, secret scan passes, test coverage gate enforced
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Migrate user-service to apps/api, create packages/logger TypeScript source, pin TypeScript monorepo-wide
- [x] 01-02-PLAN.md — Wire NestJS infrastructure modules (Health, Logger, JwtGuard, CorrelationInterceptor) and write Jest tests
- [ ] 01-03-PLAN.md — Rewrite CI/CD pipeline with typecheck + Jest coverage + gitleaks gates
- [ ] 01-04-PLAN.md — [GAP CLOSURE] Rebuild packages/core dist and fix dev:services to build dependencies first

### Phase 2: Auth + Users
**Goal**: Users can authenticate via LinkedIn OAuth or Google OAuth, receive JWT access and refresh tokens, import their professional profile (via CV upload or LinkedIn API scan), edit profile fields, configure search preferences, and save up to 5 named presets — all data persisted per-user in MongoDB.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, PROF-01, PROF-02, PROF-03, PROF-04, SRCH-01, SRCH-02, NF-03
**Success Criteria** (what must be TRUE):
  1. User clicks "Sign in with LinkedIn" or "Sign in with Google", completes OAuth flow, and lands on the dashboard with a valid session that persists across browser tab closes
  2. User can upload a PDF CV and the system produces a ProfessionalProfileType with all critical fields (skills, seniority, experience, languages) populated
  3. User can import their LinkedIn profile and all work experience, education, and skills fields are populated in under 8 seconds
  4. User can edit profile fields (skills, seniority, languages, experience), save, and the next session uses the updated values
  5. User can create, switch between, and delete up to 5 named search presets; the active preset persists between sessions
**Plans**: 5 plans

Plans:
- [ ] 02-01-PLAN.md — Define SearchPresetType, Redis provider, extend User schema, create DTOs
- [ ] 02-02-PLAN.md — Migrate OAuth to code-exchange pattern, cookie-based refresh, auth tests
- [ ] 02-03-PLAN.md — Users REST API: profile CRUD, CV upload, preset CRUD with 5-cap
- [ ] 02-04-PLAN.md — Frontend auth migration: code-exchange callback, silent refresh, axios interceptor
- [ ] 02-05-PLAN.md — Frontend UI: ProfileSetupPage, profile edit mode, preset management in ConfigPage

### Phase 3: Sessions + BullMQ
**Goal**: Users can start a job search session via POST /sessions and watch real-time progress events in the browser via SSE — with events persisted to MongoDB so a page refresh or reconnect replays missed events from the correct position.
**Depends on**: Phase 2
**Requirements**: RT-01, NF-05
**Success Criteria** (what must be TRUE):
  1. POST /sessions returns 202 Accepted with a sessionId in under 200ms
  2. The browser EventSource receives progress events (job_found, application_made, session_complete) in real time without polling
  3. If the user refreshes the page mid-session, the SSE stream replays all missed events from the point of disconnect using Last-Event-ID
  4. A browser crash or OOM in the Playwright worker does not crash the NestJS API process — the API continues serving other requests
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Session event types (locked schema), Session Mongoose schema, Redis subscriber provider, BullMQ + SessionsModule registration
- [ ] 03-02-PLAN.md — SessionsService (session CRUD, ring-buffer event append, Redis Pub/Sub subscribe), SessionsController (POST /sessions 202, GET SSE, DELETE cancel), unit tests
- [ ] 03-03-PLAN.md — Standalone BullMQ worker process with mock data pipeline, Redis Pub/Sub publishing, MongoDB persistence, child_process.fork spawning from SessionsModule, end-to-end human verification

### Phase 4: Pipeline — Search + Scoring
**Goal**: The BullMQ worker runs the full non-destructive pipeline: resolve the user's active search preset, search jobs via JSearch REST API, score each vacancy 0-100 using a hybrid local + LLM engine, deduplicate against MongoDB history, enforce excluded companies filter, and deliver a sorted job list to the user via SSE events — all without touching any apply flow.
**Depends on**: Phase 3
**Requirements**: SRCH-03, AUTO-01, AUTO-02, AUTO-03, AUTO-04, HIST-04, APPLY-04, NF-02
**Success Criteria** (what must be TRUE):
  1. Searching across selected platforms returns at least 20 results per active platform (when available), each labeled by origin platform, sorted descending by compatibility score
  2. Every vacancy has a 0-100 compatibility score comparing skills, seniority, language, modality, and salary; scoring completes in under 500ms per vacancy
  3. Vacancies with the same URL or (company + title) already seen by this user are automatically excluded from results — applying twice to the same job is not possible
  4. Companies in the user's excludedCompanies list do not appear in results; the excluded count is visible in the session view
  5. User can mark a vacancy as "Not interested" and it disappears from future search results, recorded with status=dismissed
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — Define VacancyType, SearchConfigSnapshotType, JobSearchAdapter, ScoringAdapter interfaces; create Vacancy Mongoose schema with dedup indexes; register VacanciesModule
- [ ] 04-02-PLAN.md — Wire preset resolution into POST /sessions, create VacanciesService + VacanciesController with dismiss endpoint and session vacancy list
- [ ] 04-03-PLAN.md — Implement JSearch adapter, Claude scoring adapter, pipeline orchestrator; replace mock generator in worker with real pipeline

### Phase 5: Application Automation
**Goal**: The agent applies to compatible jobs on the user's behalf: LinkedIn Easy Apply via the BullMQ worker with a Redis rate limiter and CAPTCHA detection, personalized email applications via Claude API with an approval modal, per-session application limits, and a full traceable application history with manual status tracking.
**Depends on**: Phase 4
**Requirements**: APPLY-01, APPLY-02, APPLY-03, APPLY-04, HIST-01, HIST-02, HIST-03, NF-04
**Success Criteria** (what must be TRUE):
  1. For a LinkedIn Easy Apply vacancy, the agent completes the full multi-step form and submits; an ApplicationRecord with status=applied is created; the rate limiter enforces 8-12s between applications using Redis keyed by linkedinEmail
  2. When a CAPTCHA is detected during Easy Apply, the agent pauses the session immediately and the user receives an in-browser notification without any form being partially submitted
  3. For an email-apply vacancy, the user sees a preview modal with the AI-generated email, can edit it, and approves or discards before any email is sent
  4. The agent stops after reaching maxApplicationsPerSession and notifies the user; the counter is visible during execution
  5. User can view a paginated history of all applications filterable by date, company, platform, and status; clicking an application shows the full JD, score, sent email, and status change timeline
**Plans**: 4 plans

Plans:
- [ ] 05-01-PLAN.md — Define Phase 5 type contracts, extend Vacancy schema, create Application schema, email detection utility
- [ ] 05-02-PLAN.md — ApplicationsModule: ClaudeEmailDraftAdapter, EmailSenderService, CRUD service, REST controller, AppModule registration
- [ ] 05-03-PLAN.md — Extend User schema with smtpConfig, PUT/GET smtp-config endpoints, AES-256-GCM password encryption
- [ ] 05-04-PLAN.md — Frontend: EmailDraftModal, ApplicationDetailDrawer, StatusUpdateMenu, ApplicationFilters, CsvExportButton, SmtpConfigSection, PendingReviewQueue, ApplicationHistoryPage upgrade

### Phase 6: React Frontend
**Goal**: The full React 18 + Vite SaaS UI replaces the vanilla HTML configuration page: OAuth login, persistent sidebar navigation with avatar, dashboard with live session progress via SSE, search configuration form validated against AppConfigType, job results cards with score badges, application history with CSV export, and an editable profile page.
**Depends on**: Phase 5
**Requirements**: NAV-01, NF-01, NF-14, NF-15, NF-16
**Success Criteria** (what must be TRUE):
  1. Unauthenticated user sees the OAuth login page; authenticated user lands on the dashboard with a persistent sidebar showing profile avatar, "Search Jobs with AI", "Reports", and "Log Out"
  2. Dashboard loads in under 2 seconds; Lighthouse Performance score is >= 85 and Accessibility score is >= 90
  3. During an active session, the dashboard shows live progress updates (jobs found, applications made) without any manual page refresh
  4. All UI components render correctly from 360px mobile width; sidebar is collapsible on mobile viewports
  5. All errors display clear, actionable messages with a Retry button where applicable; no stack traces are shown to the user
**Plans**: TBD

### Phase 7: Reports + Metrics
**Goal**: Users get a complete read-only view of everything the agent has done: per-session reports with totals, platform breakdowns, and sent emails log; an aggregated metrics dashboard with charts; and export to CSV or PDF.
**Depends on**: Phase 6
**Requirements**: REPT-01, REPT-02, REPT-03, REPT-04
**Success Criteria** (what must be TRUE):
  1. At the end of each session, a report is available in the dashboard within 10 seconds showing total vacancies found/applied/skipped/failed, breakdown by platform and company, and average score
  2. The session report includes a table of all emails sent: company, role, recipient, subject, date, status; user can expand to view the full email body
  3. The metrics dashboard shows aggregated totals (total applications, user-reported response rate, top platforms, top companies) with recharts charts filterable by date range
  4. User can export any session report as CSV (data) or PDF (formatted); PDF generates in under 15 seconds
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/4 | In Progress|  |
| 2. Auth + Users | 4/5 | In Progress|  |
| 3. Sessions + BullMQ | 2/3 | Complete    | 2026-03-18 |
| 4. Pipeline — Search + Scoring | 3/3 | Complete   | 2026-03-18 |
| 5. Application Automation | 1/4 | In Progress|  |
| 6. React Frontend | 0/TBD | Not started | - |
| 7. Reports + Metrics | 0/TBD | Not started | - |
