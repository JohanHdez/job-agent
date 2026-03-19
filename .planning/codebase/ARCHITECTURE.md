# Architecture

**Analysis Date:** 2025-03-11

## Pattern Overview

**Overall:** Multi-tier monorepo with server-driven agent orchestration, stateless API backend, and pluggable multi-platform job search with real-time Server-Sent Events (SSE) streaming.

**Key Characteristics:**
- **Server-centric pipeline** — All job search, parsing, and application logic runs server-side in `packages/api` via Express
- **SSE-based progress streaming** — Client receives real-time events (`job_found`, `job_applied`, `session_complete`) via EventSource
- **Plugin-based platform system** — Platforms (LinkedIn, Indeed, Greenhouse, etc.) plugged into unified job search interface
- **Stateless microservices** — Future user-service (NestJS) will be independent; currently API handles orchestration
- **Structured logging** — Winston logger with AsyncLocalStorage for correlation IDs and request context

## Layers

**CLI Entry Point:**
- Purpose: Server launcher — spawns API process and opens browser
- Location: `apps/cli/src/index.ts`
- Contains: Node child_process spawner, chalk-based console messaging
- Depends on: `packages/api/dist/server.js` (built Express server)
- Used by: `npm start` command

**API Server (Express):**
- Purpose: HTTP gateway for all agent operations and file I/O
- Location: `packages/api/src/server.ts` and `packages/api/src/routes/`
- Contains: Route handlers, middleware (CORS, error handling, correlation), SSE streaming logic
- Depends on: `@job-agent/core` (types), `@job-agent/cv-parser`, `@job-agent/job-search`, `@job-agent/ats-apply`, `@job-agent/linkedin-mcp`, `@job-agent/reporter`
- Used by: Browser UI (vanilla HTML or React), CLI launcher
- Routes:
  - `GET/POST /api/config` — Read/write `config.yaml`
  - `POST /api/cv/upload` — Upload CV file
  - `GET /api/cv` — Check uploaded CV status
  - `POST /api/run` — Start agent pipeline (returns sessionId)
  - `GET /api/run/progress` — SSE stream of raw progress events
  - `GET /api/search/events` — SSE stream of typed semantic events
  - `GET /api/report` — Return session summary + applications

**Agent Pipeline (runPipeline in agent.routes.ts):**
- Purpose: Orchestrates 8-step job search and application workflow
- Location: `packages/api/src/routes/agent.routes.ts` (lines 337-721)
- Contains: Sequential pipeline steps, event emission, error handling
- Depends on: CV parser, job search, scoring, LinkedIn agent, ATS apply, reporter
- Steps:
  1. Load `config.yaml`
  2. Find CV file in `cv/` directory
  3. Parse CV → extract professional profile
  4. Multi-platform job search (LinkedIn, Indeed, etc.)
  5. Score and rank jobs against profile
  6. Apply via LinkedIn Easy Apply + ATS APIs (Greenhouse/Lever)
  7. Save output files (`applications.json`, `session-summary.json`, `jobs-found.json`)
  8. Generate HTML/Markdown report

**Core Type Layer:**
- Purpose: Single source of truth for all domain models
- Location: `packages/core/src/types/`
- Contains: `ProfessionalProfile`, `JobListing`, `ApplicationRecord`, `AppConfig`, SSE event types
- Used by: All packages and apps (imported from `@job-agent/core`)

**CV Parser:**
- Purpose: Extract text from PDF/DOCX, parse via Claude API into `ProfessionalProfile`
- Location: `packages/cv-parser/src/`
- Contains: PDF/DOCX extraction, Claude API prompts, parsing logic
- Depends on: Claude API (ANTHROPIC_API_KEY)
- Produces: `output/profile.json`

**Job Search (Multi-Platform):**
- Purpose: Unified interface for searching jobs across multiple platforms
- Location: `packages/job-search/src/`
- Contains: `runMultiPlatformSearch()` orchestrator, platform-specific adapters in `platforms/`
- Platforms: LinkedIn (HTTP guest API), Indeed, Computrabajo, Bumeran, GetOnBoard, InfoJobs, Greenhouse API
- Produces: Flat `JobListing[]` array with normalized fields

**LinkedIn MCP Agent (Browser Automation):**
- Purpose: Playwright-based LinkedIn Easy Apply automation
- Location: `packages/linkedin-mcp/src/`
- Contains: Browser automation via Playwright, bilingual selectors, job ranking scorer, LinkedIn session management
- Depends on: LinkedIn credentials from `.env` (LINKEDIN_EMAIL, LINKEDIN_PASSWORD)
- Produces: Applied jobs, Easy Apply submission confirmations
- Key submodules:
  - `browser/` — Playwright selectors, login flow, page navigation
  - `scoring/` — Job ranking algorithm (skill match, seniority, experience)
  - `tools/` — MCP tool definitions for Claude integration (future)

**ATS Apply (Greenhouse/Lever):**
- Purpose: Automated application submission to ATS platforms
- Location: `packages/ats-apply/src/`
- Contains: ATS detection, Greenhouse API calls, form filling
- Depends on: Job metadata (URL, form fields)
- Produces: Application status, confirmation IDs

**Reporter:**
- Purpose: Generate HTML and Markdown reports from session results
- Location: `packages/reporter/src/`
- Contains: Template rendering, PDF generation, summary statistics
- Depends on: `SessionSummary`, `ApplicationRecord[]`
- Produces: `output/report.html`, `output/report.md`

**Web App (React + Vite):**
- Purpose: Modern SPA frontend (Phase 2, not active in MVP)
- Location: `apps/web/src/`
- Contains: Route definitions, feature pages (login, config, history, etc.), Zustand store
- Depends on: `packages/api` (HTTP client)
- Routes: `/`, `/login`, `/auth/callback`, `/config`, `/profile`, `/history`, `/report`

**Microservices (NestJS, Future):**
- Purpose: Stateless user auth and profile management (Phase 2)
- Location: `apps/microservices/user-service/src/`
- Contains: Auth controllers, JWT strategies, Mongoose user schema
- Depends on: MongoDB (MONGO_USER_SERVICE_URI)
- Modules: `AuthModule`, `UsersModule`

**Logger (Shared):**
- Purpose: Structured Winston logging with correlation context
- Location: `packages/logger/src/`
- Contains: `createLogger()` factory, AsyncLocalStorage for request context
- Injected by: `correlationMiddleware` in `packages/api/src/common/logger/correlation.middleware.ts`
- Logs: Service name, correlationId, userId, timestamp, JSON format in production

## Data Flow

**Full Agent Run (POST /api/run → SSE /api/search/events):**

1. **User submits config in UI**
   - Browser sends POST to `/api/run` with optional `config` in body
   - API creates in-memory `SessionState` with sessionId
   - Returns immediately with `{ sessionId }`

2. **Pipeline starts asynchronously**
   - `runPipeline()` launches as fire-and-forget Promise
   - Emits `progress` events to `GET /api/run/progress` subscribers
   - Emits semantic events (job_found, job_applied, etc.) to `GET /api/search/events` subscribers
   - Both SSE streams replay buffered events for late-connecting clients

3. **CV Parsing**
   - Reads CV from `cv/` directory
   - Calls `@job-agent/cv-parser.runCvParser(cvPath, outputPath)`
   - Saves `profile.json` to `output/`

4. **Keyword Enrichment**
   - Merges user keywords with CV-derived keywords (headline, top 6 tech stack items)
   - Deduplicates case-insensitively
   - Emits enrichment details to progress stream

5. **Job Search**
   - Calls `@job-agent/job-search.runMultiPlatformSearch(config, maxPerPlatform, callback)`
   - For each selected platform, calls platform adapter
   - Each job receives `compatibilityScore: 0` initially
   - Emits `job_found` semantic event per job
   - Collects all jobs into flat array

6. **Scoring & Filtering**
   - Calls `@job-agent/linkedin-mcp/scoring.rankJobs(allJobs, profile, 0)`
   - Returns same array with `compatibilityScore` (0–100) populated
   - Segments jobs by score buckets for reporting
   - Saves `jobs-found.json` to `output/`

7. **Application Submission**
   - **LinkedIn Easy Apply:** If LinkedIn selected, spawns browser, logs in, searches, applies via Playwright
   - **ATS APIs:** For jobs above minScore from non-LinkedIn platforms, detects ATS type, submits via API
   - Both methods emit `job_applied` semantic events with method and confirmationId
   - Rate-limits submissions (3–5s between searches, 8–12s between applications)

8. **Output Generation**
   - Saves `applications.json` (all ApplicationRecord objects)
   - Saves `session-summary.json` (SessionSummary stats)
   - Calls `@job-agent/reporter.generateReport()` → produces HTML + Markdown
   - Emits final `session_complete` event with success/failure status

**State Management:**

- **In-Memory Session:** `SessionState` lives in `agent.routes.ts` module scope; holds progress/semantic event buffers and active SSE client connections
- **Persistent Output:** All results written to `output/` directory; read via `GET /api/report`
- **Configuration:** Loaded from `config.yaml` at pipeline start; can be updated via POST `/api/config`
- **CV Storage:** Uploaded to `cv/` directory; only first PDF/DOCX file is processed

## Key Abstractions

**JobListing:**
- Purpose: Unified representation of a job across all platforms
- Fields: `id`, `title`, `company`, `location`, `modality`, `description`, `requiredSkills`, `postedAt`, `applyUrl`, `hasEasyApply`, `compatibilityScore`, `platform`
- Used by: Job search adapters, scoring, ATS detection, reporter

**ApplicationRecord:**
- Purpose: Result of applying to a single job
- Fields: `job` (JobListing), `status` (applied|failed|skipped|already_applied|easy_apply_not_available), `appliedAt`, `applicationMethod`, `confirmationId`, `errorMessage`
- Used by: Pipeline tracking, reporter, SSE events

**ProfessionalProfile:**
- Purpose: Parsed CV data structure
- Fields: `fullName`, `email`, `phone`, `location`, `headline`, `summary`, `seniority`, `yearsOfExperience`, `skills[]`, `techStack[]`, `languages[]`, `experience[]`, `education[]`
- Generated by: CV parser
- Used by: Job scoring algorithm, keyword enrichment, application form filling

**AppConfig:**
- Purpose: User search and application preferences
- Fields: `search` (keywords, location, modality, platforms, maxJobsToFind), `matching` (minScoreToApply, maxApplicationsPerSession), `coverLetter` (language, tone), `report` (format), `applicationDefaults` (work auth, sponsorship, salary, etc.)
- Stored in: `config.yaml` (YAML serialized)
- Used by: Pipeline every step for behavior customization

**SSE Event Union:**
- Purpose: Type-safe streaming event discriminated by `type` field
- Types: `job_found`, `job_applied`, `job_skipped`, `session_complete`, `captcha_detected`, `progress`
- Each carries relevant metadata (jobId, score, method, reason, timestamp)
- Used by: Browser EventSource listener for real-time UI updates

## Entry Points

**npm start:**
- Location: `apps/cli/src/index.ts` (executed as CommonJS via `node apps/cli/dist/index.js`)
- Triggers: Spawns Express server as child process, opens browser to `http://localhost:3000`
- Responsibilities: Process lifecycle management, browser launch, error reporting

**GET http://localhost:3000:**
- Location: `apps/ui/index.html` (served statically from `packages/api/src/server.ts`)
- Triggers: Initial page load from CLI browser open
- Responsibilities: Present config form, CV upload, run button

**POST /api/run:**
- Location: `packages/api/src/routes/agent.routes.ts` (line 105)
- Triggers: User clicks "Start Search" button
- Responsibilities: Create session, validate config, launch async pipeline

**Future: Auth Flow (POST /auth/login, /auth/callback):**
- Location: `apps/microservices/user-service/src/modules/auth/` (not wired to main flow yet)
- Strategies: Google OAuth, LinkedIn OAuth, JWT validation
- Responsibilities: User identity, session tokens, permission enforcement

## Error Handling

**Strategy:** Try-catch blocks at each pipeline step; non-fatal errors emit warning-level events and continue; fatal errors (missing config, no CV) stop pipeline immediately.

**Patterns:**

- **Config loading (step 1):** Missing `config.yaml` → error message, pipeline stops, returns 404
- **CV finding (step 2):** No PDF/DOCX in `cv/` → error message, stops
- **CV parsing (step 3):** Claude API timeout or bad PDF → error logged, stops (could be made non-fatal)
- **Job search (step 4):** Platform adapter timeout → logs warning, continues with 0 jobs from that platform
- **Scoring (step 5):** Fails non-fatally → uses raw jobs without scores, logs warning, continues
- **LinkedIn Easy Apply (step 6):** CAPTCHA detected → stops, emits `captcha_detected` SSE event, pauses
- **ATS Apply (step 6):** Individual job fails → logs error, stores failed ApplicationRecord, continues with next job
- **Report generation (step 8):** Non-fatal; if fails, pipeline still marks session complete
- **Global catch:** Catches unhandled errors, emits `session_complete` with `success: false`, ends pipeline

**Middleware Error Handler:**
- Location: `packages/api/src/middleware/error.middleware.ts`
- Catches all Express route errors, logs with correlationId, returns 500 JSON

## Cross-Cutting Concerns

**Logging:**
- Tool: Winston (structured JSON in production, pretty-printed in dev)
- Injection: `createLogger(serviceName)` factory from `@job-agent/logger`
- Context: Correlation IDs attached via `requestContext` AsyncLocalStorage from `correlationMiddleware`
- All events in pipeline logged with `[Agent]` prefix via `emit()` helper

**Validation:**
- Config: Loaded via `yaml.load()` and cast to `AppConfig` type (runtime type-checking via TypeScript)
- CV: Filename checked with regex `/\.(pdf|docx)$/i`
- Job URLs: Parsed by `new URL()` for safety
- ATS endpoints: Validated against known hostname patterns

**Authentication:**
- LinkedIn: Email + password from `.env` (LINKEDIN_EMAIL, LINKEDIN_PASSWORD) passed to browser automation
- Greenhouse: Token-based (board slug) embedded in search URL
- Lever: Currently API-based, not implemented yet
- User microservice: Will use JWT when wired up

**Rate Limiting:**
- LinkedIn search: 3–5s random delay between page scrolls
- LinkedIn Easy Apply: 8–12s random delay between submissions
- ATS Apply: 3–5s random delay between submissions
- Implemented via `setTimeout(random() * duration)` in pipeline

**Bilingual Support:**
- All Playwright selectors in `linkedin-mcp/src/browser/` dual-language (EN + ES)
- Example: `[aria-label="Easy Apply"], [aria-label="Solicitud sencilla"]`
- Regex patterns handle variants: `phone|teléfono|telefono`, etc.

---

*Architecture analysis: 2025-03-11*
