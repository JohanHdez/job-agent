# External Integrations

**Analysis Date:** 2025-03-10

## APIs & External Services

**LinkedIn Job Search & Easy Apply:**
- Service: LinkedIn.com (via Playwright automation)
- What it's used for: Job discovery, filtering, and Easy Apply form submission
- SDK/Client: Playwright 1.44.1 (`packages/linkedin-mcp/src/browser/linkedin.session.ts`)
- Auth: Basic auth (LINKEDIN_EMAIL, LINKEDIN_PASSWORD env vars)
- Implementation: Headless Chromium automation with rate limiting (3–5 sec between page scrolls, 8–12 sec between applications)
- Rate Limiting: Built-in delays and CAPTCHA detection to avoid blocking
- Bilingual Support: All selectors support English and Spanish variants in `packages/linkedin-mcp/src/browser/selectors.constants.ts`

**Job Board APIs (Future):**
- Service: Greenhouse.io and Lever.co
- What it's used for: Automated job applications via public REST APIs
- Implementation: Direct HTTP requests for job board integration
- Files: `packages/ats-apply/src/handlers/greenhouse.handler.ts`, `packages/ats-apply/src/handlers/lever.handler.ts`
- Fallback: Playwright form filling if REST API is disabled

**MCP (Model Context Protocol):**
- Service: Model Context Protocol SDK
- What it's used for: Tool-based interface for LinkedIn automation and job matching
- SDK/Client: @modelcontextprotocol/sdk 1.0.4
- Implementation: Stdio-based MCP server (`packages/linkedin-mcp/src/index.ts`)
- Tools exposed:
  - `search_jobs` - Search LinkedIn with job scoring
  - `get_job_details` - Fetch full job description
  - `easy_apply` - Submit Easy Apply application
  - `check_rate_limit` - Detect CAPTCHA or unusual activity

## Data Storage

**Databases:**
- MongoDB (planned, not yet implemented)
  - user-service: `mongodb://localhost:27017/user-service`
  - job-search-service: `mongodb://localhost:27017/job-search-service`
  - ats-apply-service: `mongodb://localhost:27017/ats-apply-service`
  - Client: Mongoose 8.0.0 via @nestjs/mongoose
  - Connection: Environment variables `MONGO_USER_SERVICE_URI`, `MONGO_JOB_SEARCH_URI`, `MONGO_ATS_APPLY_URI`

**File Storage:**
- Local filesystem only (no cloud storage)
  - CV directory: `CV_DIR` (default: `./cv/`)
  - Output directory: `OUTPUT_DIR` (default: `./output/`)
  - Config file: `CONFIG_PATH` (default: `./config.yaml`)

**Caching:**
- Redis (optional, not yet implemented)
  - Environment variable: `REDIS_URL`

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication (user-service)
  - NestJS Passport strategies: JWT, Google OAuth 2.0
  - Packages: @nestjs/jwt, @nestjs/passport, passport-google-oauth20
  - Implementation: `apps/microservices/user-service/` (future)

**LinkedIn Auth:**
- Basic credentials from `.env`
  - `LINKEDIN_EMAIL`
  - `LINKEDIN_PASSWORD`
  - Stored in session singleton: `LinkedInSession` in `packages/linkedin-mcp/src/browser/linkedin.session.ts`

## Monitoring & Observability

**Error Tracking:**
- Not currently integrated
- Local error logging via Winston

**Logs:**
- Winston structured logging with AsyncLocalStorage for correlationId
  - Development: Human-readable console output with colors (chalk)
  - Production: JSON structured logs for log aggregators (Datadog, ELK, Loki)
  - Format: `[timestamp] [service] [correlationId] LEVEL message {metadata}`
  - Package: `packages/logger/src/index.ts`
  - Middleware: `packages/api/src/common/logger/correlation.middleware.ts` (Express request context)

**Metrics:**
- Not yet implemented

## CI/CD & Deployment

**Hosting:**
- Express API runs locally on `API_HOST:API_PORT` (default localhost:3000)
- Not yet deployed to cloud platform

**CI Pipeline:**
- Not yet implemented
- Git hooks present in `.githooks/` (for commit validation)

**Package Scripts:**
- `npm start` - Builds and runs the CLI entry point
- `npm run build` - Compiles all workspaces
- `npm run dev` - Watches and recompiles in development
- `npm run typecheck` - Type validation across all packages
- `npm run lint` - ESLint across source files
- `npm run clean` - Removes dist/ and .tsbuildinfo files
- `npm run install:browsers` - Installs Playwright Chromium browsers

## Environment Configuration

**Required env vars:**
- `LINKEDIN_EMAIL` - LinkedIn account email
- `LINKEDIN_PASSWORD` - LinkedIn account password
- `NODE_ENV` - development or production
- `API_PORT` - Express server port
- `API_HOST` - Express server host

**Optional env vars:**
- `LOG_LEVEL` - Winston log level (info, debug, warn, error)
- `HEADLESS` - Playwright headless mode (false = visible browser)
- `SLOW_MO` - Playwright slowdown (ms)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` - Email configuration
- `REDIS_URL` - Redis cache connection (future)
- `MONGO_*_URI` - MongoDB connection strings (future)

**Secrets location:**
- `.env` file (gitignored, never committed)
- Template: `.env.example` (safe to commit, contains placeholders)

## Webhooks & Callbacks

**Incoming:**
- Not yet implemented

**Outgoing:**
- Email notifications (optional)
  - SMTP via nodemailer
  - Triggered on successful job applications
  - Package: `packages/ats-apply/src/handlers/email.handler.ts`

## Application Output

**Files written to output/ directory:**
- `profile.json` - Parsed professional profile from CV (ProfessionalProfile type)
- `jobs-found.json` - Discovered jobs with scoring (JobListing[] type)
- `applications.json` - Application records with status (ApplicationRecord[] type)
- `report.md` - Markdown report of session results
- `report.html` - HTML report viewable in browser

**Report Generation:**
- Package: `packages/reporter/src/`
- Formats: Markdown and HTML (configurable in config.yaml: `report.format`)

## Configuration File (config.yaml)

**Structure:**
```yaml
search:
  keywords: ["Software Engineer", "TypeScript Developer"]    # Job search terms
  location: "Spain"                                           # Geographic filter
  modality: [Remote, Hybrid]                                  # Work modality
  languages: [English, Spanish]                               # Job language filter
  seniority: [Mid, Senior]                                    # Experience level
  datePosted: past_week                                       # Date filter
  excludedCompanies: []                                       # Blacklist
  platforms: [linkedin, indeed, getonboard]                   # Job sources (planned)

matching:
  minScoreToApply: 70                                         # Score threshold (0–100)
  maxApplicationsPerSession: 10                               # Daily limit

coverLetter:
  language: en                                                # Letter language
  tone: professional                                          # Tone option

report:
  format: both                                                # markdown | html | both
```

**Schema Source:**
- `packages/core/src/types/config.types.ts` - AppConfigType
- Validation: Not yet implemented (future Zod schema)

---

*Integration audit: 2025-03-10*
