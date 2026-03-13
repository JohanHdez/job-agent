# Codebase Structure

**Analysis Date:** 2025-03-11

## Directory Layout

```
job-agent/
├── .claude/                    # Agent configuration (GSD commands)
│   └── commands/
│       ├── architect.md
│       ├── backend.md
│       ├── database.md
│       ├── designer.md
│       ├── director.md
│       └── frontend.md
├── .github/                    # GitHub workflows and templates
├── .githooks/                  # Pre-commit hooks
├── .planning/                  # Planning and analysis docs (you are here)
│   └── codebase/
│       ├── ARCHITECTURE.md
│       └── STRUCTURE.md
├── apps/                       # Runnable applications
│   ├── cli/                    # npm start entry point — server launcher
│   │   ├── src/
│   │   │   └── index.ts        # Child process spawner, browser launch
│   │   ├── dist/               # Compiled JavaScript
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ui/                     # Vanilla HTML/CSS/JS UI (served by Express)
│   │   ├── index.html
│   │   ├── assets/
│   │   ├── css/
│   │   └── js/
│   ├── web/                    # React 18 + Vite (Phase 2, not integrated)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── router.tsx      # React Router v6 routes
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── config/
│   │   │   │   ├── landing/
│   │   │   │   ├── profile/
│   │   │   │   └── history/
│   │   │   ├── store/          # Zustand state stores
│   │   │   └── assets/
│   │   ├── public/
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── microservices/
│       └── user-service/       # NestJS microservice (Phase 2, partial)
│           ├── src/
│           │   ├── main.ts
│           │   ├── app.module.ts
│           │   ├── common/
│           │   │   └── crypto/
│           │   └── modules/
│           │       ├── auth/
│           │       │   ├── auth.controller.ts
│           │       │   ├── auth.service.ts
│           │       │   ├── guards/
│           │       │   └── strategies/
│           │       └── users/
│           │           ├── users.service.ts
│           │           └── schemas/
│           ├── dist/
│           ├── nest-cli.json
│           ├── package.json
│           └── tsconfig.json
├── packages/                   # Shared/reusable libraries
│   ├── core/                   # Single source of truth: types
│   │   ├── src/
│   │   │   └── types/
│   │   │       ├── cv.types.ts         # ProfessionalProfile, RawCvData
│   │   │       ├── job.types.ts        # JobListing, ApplicationRecord, SSE events
│   │   │       ├── config.types.ts     # AppConfig, PlatformId, LinkedInCredentials
│   │   │       └── index.ts            # Barrel export
│   │   ├── dist/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── api/                    # Express REST gateway (main orchestrator)
│   │   ├── src/
│   │   │   ├── server.ts       # Express app, middleware setup, static file serving
│   │   │   ├── common/
│   │   │   │   └── logger/
│   │   │   │       ├── correlation.middleware.ts  # AsyncLocalStorage + correlationId
│   │   │   │       └── index.ts
│   │   │   ├── middleware/
│   │   │   │   └── error.middleware.ts   # Global error handler
│   │   │   ├── routes/
│   │   │   │   ├── agent.routes.ts      # POST /api/run, SSE endpoints, 8-step pipeline
│   │   │   │   ├── config.routes.ts     # GET/POST /api/config
│   │   │   │   ├── cv.routes.ts         # POST /api/cv/upload, GET /api/cv
│   │   │   │   └── jobs.routes.ts       # GET /api/jobs
│   │   │   └── utils/
│   │   │       └── logger.ts            # Logger instance for this package
│   │   ├── dist/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── cv-parser/              # CV extraction + Claude API parsing
│   │   ├── src/
│   │   │   ├── index.ts        # runCvParser() entry point
│   │   │   ├── extractors/     # PDF/DOCX text extraction
│   │   │   ├── parsers/        # Claude API prompts + parsing logic
│   │   │   ├── types/          # Local types (merged into core later)
│   │   │   └── utils/          # Helpers
│   │   ├── dist/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── job-search/             # Multi-platform job aggregation
│   │   ├── src/
│   │   │   ├── index.ts        # runMultiPlatformSearch() entry point
│   │   │   ├── interfaces/     # Search result interfaces
│   │   │   ├── platforms/      # Platform adapters (LinkedIn, Indeed, etc.)
│   │   │   └── utils/          # Helpers
│   │   ├── dist/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── linkedin-mcp/           # LinkedIn automation + scoring
│   │   ├── src/
│   │   │   ├── index.ts        # Main export (not used; tools exported separately)
│   │   │   ├── agent.ts        # runLinkedInAgent() — browser automation orchestrator
│   │   │   ├── browser/        # Playwright selectors, login, navigation
│   │   │   │   ├── linkedin.constants.ts  # Bilingual selectors (EN + ES)
│   │   │   │   ├── login.ts
│   │   │   │   └── ...
│   │   │   ├── scoring/        # rankJobs() — compatibility scoring algorithm
│   │   │   ├── tools/          # MCP tool definitions (future Claude integration)
│   │   │   └── utils/          # Helpers
│   │   ├── dist/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ats-apply/              # Greenhouse/Lever automated apply
│   │   ├── src/
│   │   │   ├── index.ts        # applyToAts(), detectAts() entry points
│   │   │   ├── detectors/      # ATS type detection
│   │   │   ├── handlers/       # API-specific handlers (Greenhouse, Lever)
│   │   │   └── utils/          # Helpers
│   │   ├── dist/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── reporter/               # Report generation (HTML + Markdown)
│   │   ├── src/
│   │   │   ├── index.ts        # generateReport() entry point
│   │   │   ├── templates/      # HTML/Markdown templates
│   │   │   └── utils/
│   │   ├── dist/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── logger/                 # Structured logging (Winston factory)
│       ├── src/
│       │   ├── index.ts        # createLogger(), requestContext (AsyncLocalStorage)
│       │   └── index.d.ts      # Type definitions
│       ├── dist/
│       ├── package.json
│       └── tsconfig.json
├── cv/                         # User CV files (gitignored)
├── output/                     # Generated results (gitignored)
│   ├── profile.json            # Parsed CV (ProfessionalProfile)
│   ├── jobs-found.json         # All discovered jobs (JobListing[])
│   ├── applications.json       # Application results (ApplicationRecord[])
│   ├── session-summary.json    # Session stats (SessionSummary)
│   ├── report.html             # Generated HTML report
│   └── report.md               # Generated Markdown report
├── .env                        # Real credentials (gitignored)
├── .env.example                # Template with required vars
├── config.yaml                 # User search config (gitignored)
├── config.yaml.example         # Config template
├── .eslintrc.js                # ESLint configuration
├── tsconfig.base.json          # Base TypeScript config (extends all)
├── package.json                # Monorepo root (npm workspaces)
├── package-lock.json
├── .gitignore
├── CLAUDE.md                   # Project rules and architecture guidelines
├── README.md
└── LICENSE
```

## Directory Purposes

**`.claude/commands/`**
- Purpose: Multi-agent GSD command definitions
- Contains: Markdown files defining roles for architect, designer, frontend, backend, database, director agents
- Key files: `architect.md` (structure decisions), `backend.md` (API/service logic), `database.md` (schemas/config)

**`apps/cli/`**
- Purpose: Entry point for `npm start` command
- Contains: Node launcher that spawns API server and opens browser
- Key files: `src/index.ts` (child_process.spawn, chalk logging)

**`apps/ui/`**
- Purpose: Static HTML/CSS/JS user interface (served by Express)
- Contains: Form for config input, CV upload, real-time progress display
- Key files: `index.html`, CSS, vanilla JS event listeners for SSE

**`apps/web/`**
- Purpose: Modern React + Vite frontend (Phase 2, future replacement for vanilla UI)
- Contains: React components, router, Zustand stores
- Key files: `src/router.tsx` (React Router v6), `src/features/` (pages), `src/store/` (auth store)

**`apps/microservices/user-service/`**
- Purpose: User authentication and profile management (Phase 2, partially implemented)
- Contains: NestJS controllers, services, auth strategies (Google, LinkedIn, JWT), Mongoose schemas
- Key files: `src/modules/auth/` (OAuth), `src/modules/users/` (profile CRUD)

**`packages/core/`**
- Purpose: Single source of truth for all domain types
- Contains: Interfaces for CV, job, config, SSE events
- Key files: `src/types/cv.types.ts`, `src/types/job.types.ts`, `src/types/config.types.ts`
- **Critical:** All types imported from `@job-agent/core` barrel; never define types inline in any app

**`packages/api/`**
- Purpose: Express REST gateway and agent pipeline orchestrator
- Contains: HTTP routes, middleware, 8-step pipeline logic, SSE streaming
- Key files:
  - `src/server.ts` — Express app, middleware, static file serving
  - `src/routes/agent.routes.ts` — **Main pipeline** (POST /api/run, runPipeline function)
  - `src/routes/config.routes.ts` — Config I/O
  - `src/routes/cv.routes.ts` — CV upload/check
  - `src/common/logger/correlation.middleware.ts` — Request context injection

**`packages/cv-parser/`**
- Purpose: Convert PDF/DOCX → ProfessionalProfile via Claude API
- Contains: PDF extraction (pdfjs), DOCX extraction (docx), Claude prompts, profile assembly
- Key files: `src/index.ts` (runCvParser entry), `src/extractors/` (PDF/DOCX), `src/parsers/` (Claude)

**`packages/job-search/`**
- Purpose: Unified multi-platform job search
- Contains: Search orchestrator, platform adapters (LinkedIn HTTP, Indeed, Greenhouse, etc.)
- Key files:
  - `src/index.ts` (runMultiPlatformSearch entry)
  - `src/platforms/` (individual platform adapters)

**`packages/linkedin-mcp/`**
- Purpose: LinkedIn browser automation and job scoring
- Contains: Playwright-based login, search, Easy Apply; scoring algorithm
- Key files:
  - `src/agent.ts` (runLinkedInAgent entry)
  - `src/browser/linkedin.constants.ts` (**All bilingual selectors must be here**)
  - `src/scoring/` (rankJobs algorithm)

**`packages/ats-apply/`**
- Purpose: Automated submission to Greenhouse/Lever
- Contains: ATS detection, API handlers, form parsing
- Key files:
  - `src/index.ts` (applyToAts, detectAts entries)
  - `src/detectors/` (ATS type detection by URL)
  - `src/handlers/` (API-specific submission logic)

**`packages/reporter/`**
- Purpose: HTML + Markdown report generation
- Contains: Template rendering, statistics aggregation
- Key files: `src/index.ts` (generateReport entry), `src/templates/` (HTML/MD templates)

**`packages/logger/`**
- Purpose: Structured logging with correlation IDs
- Contains: Winston logger factory, AsyncLocalStorage context
- Key files: `src/index.ts` (createLogger, requestContext)

**`cv/` (gitignored)**
- Purpose: Storage for user-uploaded CV files
- Contains: PDF/DOCX files
- Pipeline rule: Only first PDF or DOCX is processed

**`output/` (gitignored)**
- Purpose: All generated results
- Contains: JSON data, HTML/Markdown reports
- Files:
  - `profile.json` — Parsed CV (ProfessionalProfile)
  - `jobs-found.json` — All discovered jobs (JobListing[])
  - `applications.json` — Application results (ApplicationRecord[])
  - `session-summary.json` — Stats (SessionSummary)
  - `report.html` / `report.md` — Generated reports

## Key File Locations

**Entry Points:**
- `apps/cli/src/index.ts` — `npm start` launcher (spawns Express, opens browser)
- `packages/api/src/server.ts` — HTTP server and middleware setup
- `packages/api/src/routes/agent.routes.ts` — **8-step pipeline** (POST /api/run)

**Configuration:**
- `.env.example` — Template for environment variables (credentials, API keys)
- `config.yaml.example` — Template for user search config
- `tsconfig.base.json` — Base TypeScript config (workspace root)

**Core Logic:**
- `packages/core/src/types/` — All domain types (cv.types.ts, job.types.ts, config.types.ts)
- `packages/api/src/routes/agent.routes.ts` — Pipeline orchestration (8 steps)
- `packages/cv-parser/src/` — CV → Profile parsing
- `packages/job-search/src/` — Multi-platform search
- `packages/linkedin-mcp/src/` — LinkedIn automation + scoring
- `packages/ats-apply/src/` — ATS apply automation

**Testing:**
- Test files not yet present in codebase (add `.test.ts` / `.test.tsx` alongside source files)
- Future: `packages/*/src/**/*.test.ts`, `apps/web/src/**/*.test.tsx`, `apps/microservices/*/src/**/*.test.ts`

**UI/Frontend:**
- `apps/ui/` — Current vanilla HTML UI (served by Express at `/index.html`)
- `apps/web/src/router.tsx` — Future React Router setup (not wired to main flow)

## Naming Conventions

**Files:**
- Kebab-case for all files: `linkedin.constants.ts`, `cv-parser.ts`, `error.middleware.ts`
- Exception: React components use PascalCase: `LoginPage.tsx`, `JobCard.tsx`, `App.tsx`

**Directories:**
- Kebab-case for feature/package directories: `linkedin-mcp`, `cv-parser`, `job-search`, `ats-apply`
- Functional grouping: `src/routes/`, `src/middleware/`, `src/utils/`, `src/platforms/`, `src/handlers/`

**Interfaces/Types:**
- PascalCase with NO `I` prefix: `JobListing`, `ProfessionalProfile`, `ApplicationRecord`
- Suffix convention: `Type` for simple interfaces, `Record` for data records
- Enum: `PlatformId` (union type), `ApplicationStatus`, `SseEventType`

**Constants:**
- UPPER_SNAKE_CASE with `_CONSTANT` suffix: `MAX_RETRIES_CONSTANT`, `RATE_LIMIT_MS_CONSTANT`
- In `*.constants.ts` files only (e.g., `linkedin.constants.ts`)

**Functions/Methods:**
- camelCase for all functions: `runMultiPlatformSearch()`, `rankJobs()`, `createLogger()`
- Async functions not prefixed with `async_` — type signature indicates Promise

**Exports:**
- Barrel exports in `index.ts` — never deep-import across package boundaries
- Example: Import `@job-agent/core` (barrel), NOT `packages/core/src/types/job.types.ts`

## Where to Add New Code

**New Feature (e.g., "score jobs by location match"):**
- Primary code: `packages/linkedin-mcp/src/scoring/` (scoring logic is there)
- If adds new type field: Update `packages/core/src/types/job.types.ts`
- If adds config option: Update `packages/core/src/types/config.types.ts`
- Tests: `packages/linkedin-mcp/src/scoring/location.test.ts`

**New Platform (e.g., "add Indeed scraper"):**
- Implementation: `packages/job-search/src/platforms/indeed.ts`
- Add type: Update `config.types.ts` with new `PlatformId`
- Tests: `packages/job-search/src/platforms/indeed.test.ts`
- Wire in: `packages/job-search/src/index.ts` (runMultiPlatformSearch orchestrator)

**New API Route (e.g., "GET /api/stats"):**
- Implementation: Create or extend file in `packages/api/src/routes/` (e.g., `stats.routes.ts`)
- Wire in: `packages/api/src/server.ts` (`app.use('/api/stats', statsRouter)`)
- Logging: Use `logger.info()` from `packages/api/src/utils/logger.ts`

**UI Enhancement (e.g., "add progress bar"):**
- Implementation: `apps/ui/js/` (vanilla) or `apps/web/src/features/` (React Phase 2)
- Connect to SSE: Listen to `EventSource('/api/search/events')` for progress events
- Styling: `apps/ui/css/` (vanilla) or Tailwind classes (React)

**Shared Hook (e.g., "useJobList"):**
- Implementation: `packages/shared/hooks/` (future when React is main UI)
- Export from: `packages/shared/hooks/index.ts` barrel
- Import as: `import { useJobList } from '@job-agent/shared-hooks'`

**Shared Component (e.g., "JobCard"):**
- Implementation: `packages/shared/ui/` (future)
- Presentational only — no HTTP, no Zustand state
- Export from: `packages/shared/ui/index.ts` barrel

**Utility/Helper:**
- Shared helpers: `packages/api/src/utils/` or `packages/linkedin-mcp/src/utils/`
- Date utils: `packages/core/src/utils/` (if cross-cutting)

## Special Directories

**`dist/` (generated)**
- Purpose: Compiled TypeScript → JavaScript
- Generated by: `npm run build`
- Committed: No (in `.gitignore`)
- Build output for each package/app

**`node_modules/` (generated)**
- Purpose: Installed dependencies
- Generated by: `npm install`
- Committed: No
- Workspaces at: Root, and per-package

**`.git/` (version control)**
- Purpose: Git history and objects
- Committed: Yes (Git metadata)
- Do not modify directly

**`.planning/codebase/`**
- Purpose: Architecture and analysis documents (this directory)
- Contains: ARCHITECTURE.md, STRUCTURE.md (this file), CONVENTIONS.md, TESTING.md, CONCERNS.md
- Committed: Yes (reference for team)

**`.claude/commands/`**
- Purpose: Multi-agent role definitions (GSD framework)
- Contains: Markdown files for architect, designer, frontend, backend, database, director
- Committed: Yes (agent instructions)

**`.github/workflows/`**
- Purpose: CI/CD pipeline definitions
- Committed: Yes
- Future: Add test gate, linting, build steps

## Workspace Dependencies

**Root `package.json` workspace structure:**
```json
{
  "workspaces": [
    "packages/*",
    "apps/*",
    "apps/microservices/*"
  ]
}
```

**Install dependencies:**
- Root level: `npm install` (installs all workspaces)
- Specific package: `npm install -w @job-agent/cv-parser`

**Run scripts across workspaces:**
- Build all: `npm run build -w packages/core && npm run build -w packages/cv-parser ...`
- Type-check all: `tsc --noEmit` per package

**Path aliases** (via `tsconfig.base.json`):
```json
{
  "compilerOptions": {
    "paths": {
      "@job-agent/core": ["packages/core/src"],
      "@job-agent/cv-parser": ["packages/cv-parser/src"],
      "@job-agent/job-search": ["packages/job-search/src"],
      "@job-agent/linkedin-mcp": ["packages/linkedin-mcp/src"],
      "@job-agent/ats-apply": ["packages/ats-apply/src"],
      "@job-agent/reporter": ["packages/reporter/src"],
      "@job-agent/logger": ["packages/logger/src"]
    }
  }
}
```

---

*Structure analysis: 2025-03-11*
