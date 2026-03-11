# Architecture

**Analysis Date:** 2026-03-10

## Pattern Overview

**Overall:** Modular monorepo with layered microservice and package architecture. Separation of concerns across:
- **Shared layer** (`packages/core`) — types and configuration only, no runtime dependencies
- **Package layer** (`packages/*`) — domain logic organized by concern (CV parsing, job search, LinkedIn automation, ATS applications, reporting)
- **Service layer** (`apps/microservices/`) — NestJS-based stateless microservices (user-service, future job-search-service, ats-apply-service)
- **Gateway layer** (`packages/api`) — Express REST API serving the UI and orchestrating backend calls
- **CLI/UI layer** (`apps/cli`, `apps/ui`) — User-facing entry points: CLI launcher and vanilla HTML/JS dashboard

**Key Characteristics:**
- Type-safe shared types in `@job-agent/core` — single source of truth for all interfaces
- Stateless packages connected via HTTP and MCP (Model Context Protocol)
- Structured logging via Winston factory at `packages/logger` with AsyncLocalStorage for correlation IDs
- Multi-platform job search (7 platforms) via HTTP-only searchers, no browser automation in main flow
- LinkedIn automation isolated in MCP server (`packages/linkedin-mcp`) for decoupled, in-process tool access

## Layers

**Core/Shared Types:**
- Purpose: Define all interfaces, enums, and DTOs consumed by packages and services
- Location: `packages/core/src/types/`
- Contains: TypeScript interfaces for jobs, CV profiles, config, application records
- Depends on: Nothing (no runtime dependencies)
- Used by: Every package and microservice

**Logger Service:**
- Purpose: Centralized structured logging with correlation ID and service name injection
- Location: `packages/logger/src/index.ts`
- Contains: Winston logger factory, AsyncLocalStorage for request context
- Depends on: Winston, chalk
- Used by: API gateway and all microservices

**CV Parser Package:**
- Purpose: Extract professional profile from PDF/DOCX files using Claude API
- Location: `packages/cv-parser/src/`
- Contains: PDF parsers, profile builders, extractors (skills, experience, etc.)
- Depends on: Claude API via Anthropic SDK, `@job-agent/core` types
- Used by: API routes and CLI flow

**Job Search Package:**
- Purpose: Multi-platform job discovery via HTTP (no browser)
- Location: `packages/job-search/src/`
- Contains: Per-platform searcher implementations (LinkedIn, Indeed, Computrabajo, Bumeran, Getonboard, Infojobs, Greenhouse)
- Depends on: HTTP clients (axios), `@job-agent/core` types
- Used by: API routes, agent orchestration

**LinkedIn MCP Server:**
- Purpose: Automate LinkedIn job searches, detail fetches, and Easy Apply submissions
- Location: `packages/linkedin-mcp/src/`
- Contains: Playwright browser automation, bilingual selectors, job scoring, rate limiting
- Depends on: Playwright, MCP SDK, `@job-agent/core` types, job-search package
- Used by: API routes via child process execution

**ATS/Application Handler Package:**
- Purpose: Detect application form fields and submit applications
- Location: `packages/ats-apply/src/`
- Contains: Form detectors (LinkedIn, Greenhouse, Lever, email), cover letter generation, form handlers
- Depends on: Claude API, SMTP transports, `@job-agent/core` types
- Used by: LinkedIn MCP during Easy Apply, API routes

**Reporter Package:**
- Purpose: Generate Markdown and HTML reports from application results
- Location: `packages/reporter/src/`
- Contains: Report templates, formatters for applications and statistics
- Depends on: `@job-agent/core` types
- Used by: API routes post-completion

**API Gateway:**
- Purpose: REST endpoint layer for UI interaction and orchestration
- Location: `packages/api/src/`
- Contains: Express routes for config, CV, jobs, and agent orchestration
- Depends on: All packages above, winston logger
- Used by: CLI launcher, vanilla HTML UI

**User Microservice (NestJS):**
- Purpose: User authentication (LinkedIn/Google OAuth), profile management
- Location: `apps/microservices/user-service/src/`
- Contains: Auth guards, JWT strategies, MongoDB user schemas
- Depends on: NestJS, MongoDB/Mongoose, passport strategies
- Used by: Future—currently not integrated with main flow

## Data Flow

**Initialization Flow:**

1. `npm start` launches CLI (`apps/cli/src/index.ts`)
2. CLI spawns API server as child process (`packages/api/dist/server.js`)
3. CLI opens browser to `http://localhost:3000/index.html`
4. Static UI files served from `apps/ui/`

**Agent Execution Flow (POST /api/run):**

1. User uploads CV via form → `POST /api/cv/upload`
2. API parses CV → `runCvParser()` from `@job-agent/cv-parser` → saves `output/profile.json`
3. User sets config in UI → `POST /api/config` → saves `config.yaml`
4. User clicks "Start Search" → `POST /api/run` initiates agent session
5. Agent runs pipeline:
   - Calls `runMultiPlatformSearch()` from `@job-agent/job-search` → HTTP-only searches across platforms
   - Jobs returned as array of `JobListing` objects with compatibility scores
   - Spawns LinkedIn MCP server as child process for Easy Apply
   - MCP server uses Playwright to interact with LinkedIn UI (searches, applies via Easy Apply buttons)
   - Each application recorded as `ApplicationRecord` with status
   - ATS form detector and cover letter generator activated via MCP tools
6. Results written to:
   - `output/applications.json` — array of `ApplicationRecord` objects
   - `output/jobs-found.json` — all discovered jobs
   - `output/profile.json` — parsed CV profile

**Progress Streaming (GET /api/run/progress):**

1. Client opens SSE connection during agent execution
2. API broadcasts `ProgressEvent` objects (step, message, level) to all connected clients
3. UI updates progress bar and log in real time
4. Session state maintained in memory at `agentRouter` scope

**Report Generation:**

1. Agent completion triggers reporter via `runReporter()`
2. Reporter reads `output/applications.json`, `output/profile.json`, `output/jobs-found.json`
3. Generates `output/report.md` and `output/report.html`
4. UI displays summary stats and application list
5. Report artifacts served from `GET /output/` static route

**State Management:**

- **Configuration:** YAML file on disk (`config.yaml`), validated at startup, typed as `AppConfig`
- **Session State:** In-memory object in `agentRouter` (single session, replaced on new run)
- **Request Context:** Per-request correlation ID and userId stored in AsyncLocalStorage, injected into all logger calls
- **Application Results:** JSON files written to `output/` directory, persisted across sessions

## Key Abstractions

**ProfessionalProfile:**
- Purpose: Structured representation of a user's CV/resume
- Examples: `packages/cv-parser/src/extractors/profile.builder.ts`
- Pattern: Built from raw PDF text → extracted skills, experience, education → JSON serializable type

**JobListing:**
- Purpose: Normalized job posting across all platforms
- Examples: All platform searchers return `JobListing[]`
- Pattern: Each platform implements `IPlatformSearcher` interface returning normalized jobs with `compatibilityScore`

**ApplicationRecord:**
- Purpose: Audit trail of application attempts with status and proof
- Examples: Written to `output/applications.json`, displays in reports
- Pattern: Immutable record created per job, includes error messages if failed, confirmation ID if succeeded

**IPlatformSearcher:**
- Purpose: Pluggable searcher interface for each job platform
- Examples: `packages/job-search/src/interfaces/platform.interface.ts`
- Pattern: Each platform implements `search(config: AppConfig): Promise<JobListing[]>`; registry pattern in job-search index

**LinkedInSession:**
- Purpose: Browser automation context for LinkedIn interactions
- Examples: `packages/linkedin-mcp/src/browser/linkedin.session.ts`
- Pattern: Lazy-initialized, persistent Playwright browser instance, rate-limited navigation

**AppConfig:**
- Purpose: Validated configuration schema for search, matching, cover letter, reporting
- Examples: Loaded from `config.yaml` at `packages/core/src/types/config.types.ts`
- Pattern: Serialized as YAML, deserialized to typed object, validated at startup

## Entry Points

**CLI Entry Point:**
- Location: `apps/cli/src/index.ts`
- Triggers: `npm start` command
- Responsibilities: Spawn API server, open browser, handle SIGINT/SIGTERM gracefully

**API Server Entry Point:**
- Location: `packages/api/src/server.ts`
- Triggers: Spawned by CLI, also callable directly for development
- Responsibilities: Initialize Express app, register routes, serve static UI, bind to PORT

**MCP Server Entry Point:**
- Location: `packages/linkedin-mcp/src/index.ts`
- Triggers: Spawned as child process from agent.routes.ts during /api/run
- Responsibilities: Register MCP tools (search_jobs, get_job_details, easy_apply), handle tool calls

**NestJS Microservice Entry Point:**
- Location: `apps/microservices/user-service/src/main.ts`
- Triggers: Manual `npm start -w apps/microservices/user-service` or orchestrator
- Responsibilities: Initialize NestJS app, register controllers/guards, validate requests with pipes

## Error Handling

**Strategy:**
- Errors propagate up from workers (packages) to orchestrators (routes, MCP tools, CLI)
- Each package exports either a specific error type or generic `Error` with `.message`
- API routes catch and transform errors to HTTP responses
- MCP tools handle errors and return error messages in tool response
- Unhandled exceptions logged via structured logger with correlation ID

**Patterns:**

```typescript
// Pattern 1: Try-catch with typed logger in packages
try {
  const profile = await runCvParser(cvPath);
  logger.info('CV parsed successfully', { profiles: profile.skills.length });
  return profile;
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error('CV parsing failed', { error: msg });
  throw new Error(`CV parsing failed: ${msg}`);
}

// Pattern 2: Express error middleware catches and transforms
app.use(errorMiddleware); // Transforms Error → JSON response with status code

// Pattern 3: MCP tools emit error in response
const result = await linkedinSession.search(...);
if (!result.success) {
  return { status: 'error', message: result.error };
}
```

## Cross-Cutting Concerns

**Logging:**
- Winston factory at `packages/logger/src/index.ts` creates per-service loggers
- Every logger call includes: timestamp, service name, correlationId, userId, message, metadata
- Development: human-readable format with colors; Production: JSON format for aggregators

**Validation:**
- Config loaded via js-yaml, validated against `AppConfig` type
- NestJS global ValidationPipe for microservice DTOs (whitelist, transform)
- No explicit validation schema library (Zod)—rely on TypeScript types

**Authentication:**
- Microservice auth: Passport.js with LinkedIn/Google OAuth strategies, JWT tokens
- API gateway: No auth (runs locally or behind nginx proxy in production)
- LinkedIn credentials: Loaded from `.env`, not stored in config.yaml

**Rate Limiting:**
- LinkedIn automation: 3–5 second random delay between scrolls, 8–12 second delay between Easy Apply submissions
- Detection: Check for CAPTCHA container and unusual activity banner selectors
- Enforcement: Pause and wait, or stop and resume later

**Bilingual Support:**
- All LinkedIn selectors include English AND Spanish alternatives
- Regex patterns handle both language variants (e.g., `phone|teléfono|telefono`)
- Job search keywords and form answers configurable in `config.yaml` with `languages` array

**Configuration Management:**
- Single source of truth: `config.yaml` on disk
- Schema: `AppConfig` type in `packages/core/src/types/config.types.ts`
- Runtime: Loaded at startup, cached in API request scope, can be modified via `/api/config` POST

---

*Architecture analysis: 2026-03-10*
