# External Integrations

**Analysis Date:** 2026-03-11

## APIs & External Services

**LinkedIn:**
- Purpose: Job search scraping and Easy Apply automation
- SDK/Client: Playwright 1.44.1 (browser automation)
- Auth: Credentials via `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD` env vars
- Bilingual support: Selectors support both English and Spanish
- Implemented in: `packages/linkedin-mcp`

**LinkedIn OAuth 2.0:**
- Purpose: User authentication and profile integration
- SDK/Client: passport-linkedin-oauth2 2.0.0
- Auth: `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` env vars
- Callback: `LINKEDIN_CALLBACK_URL` (default: `http://localhost:3001/auth/linkedin/callback`)
- Implemented in: `apps/microservices/user-service`

**Google OAuth 2.0:**
- Purpose: Alternative user authentication
- SDK/Client: passport-google-oauth20 2.0.0
- Auth: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars
- Callback: `GOOGLE_CALLBACK_URL` (default: `http://localhost:3001/auth/google/callback`)
- Implemented in: `apps/microservices/user-service`

**Anthropic (Claude API):**
- Purpose: CV parsing, cover letter generation, job compatibility scoring
- SDK/Client: @anthropic-ai/sdk 0.78.0
- Auth: `ANTHROPIC_API_KEY` env var (format: `sk-ant-...`)
- Implemented in: `packages/cv-parser`

**Multiple Job Platforms:**
- Purpose: Extended job search (beyond LinkedIn)
- Platforms configured: LinkedIn, Indeed, GetOnBoard (in `config.yaml.example`)
- Implementation: `packages/job-search` orchestrator (framework for multi-platform support)

## Data Storage

**Databases:**
- MongoDB - Primary data store
  - Connection: `MONGO_USER_SERVICE_URI` env var
  - Client: Mongoose 8.4.1 (ORM)
  - Database per service: `user-service` has dedicated MongoDB database
  - Services planned: `job-search-service`, `ats-apply-service` (separate databases per CLAUDE.md)

**File Storage:**
- Local filesystem only - no cloud storage integration
  - CV uploads: `CV_DIR` env var (default: `./cv/`)
  - Output files: `OUTPUT_DIR` env var (default: `./output/`)
  - Config file: `CONFIG_PATH` env var (default: `./config.yaml`)

**Caching:**
- None currently configured
- Redis URL available in `.env.example` for future use (optional): `REDIS_URL`

## Authentication & Identity

**Auth Provider:**
- Custom passport-based OAuth 2.0 implementation
- Strategies supported:
  - LinkedIn OAuth 2.0 (via passport-linkedin-oauth2)
  - Google OAuth 2.0 (via passport-google-oauth20)
  - JWT bearer tokens (via passport-jwt)

**Implementation:**
- Location: `apps/microservices/user-service`
- JWT tokens: Signed with `JWT_SECRET` env var (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- Token encryption key: `TOKEN_CIPHER_KEY` env var (64 hex chars = 32 bytes)
- Token validation: Passport JWT strategy with NestJS @nestjs/jwt

**Access Token Flow:**
- OAuth callback → JWT generation → Secure cookie/bearer token

## Monitoring & Observability

**Error Tracking:**
- None currently integrated
- Could integrate: Sentry (setup needed)

**Logs:**
- Structured logging via Winston 3.13.0
- New factory: `packages/logger/createLogger()` with context injection
- Correlation tracking: correlationId attached per-request via AsyncLocalStorage
- Formats:
  - Development: Human-readable text
  - Production: JSON for log aggregators
- Log aggregators supported: Datadog, Grafana Loki (via JSON output)
- Log level: Controlled via `LOG_LEVEL` env var (default: `info`)

## CI/CD & Deployment

**Hosting:**
- Not configured - local development only
- Planned deployment targets: Vercel (web), Railway/Fly.io (microservices)

**CI Pipeline:**
- Not configured
- Pre-commit hook setup: `.githooks/` directory configured via `npm run prepare`
- Type checking enforced: `npm run typecheck` checks all packages
- Linting enforced: `npm run lint` via ESLint with strict TypeScript rules

## Environment Configuration

**Required env vars:**
- `LINKEDIN_EMAIL` - LinkedIn account email (browser automation)
- `LINKEDIN_PASSWORD` - LinkedIn account password (browser automation)
- `LINKEDIN_CLIENT_ID` - LinkedIn OAuth app client ID
- `LINKEDIN_CLIENT_SECRET` - LinkedIn OAuth app client secret
- `LINKEDIN_CALLBACK_URL` - OAuth callback URL (default: `http://localhost:3001/auth/linkedin/callback`)
- `GOOGLE_CLIENT_ID` - Google OAuth app client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth app client secret
- `GOOGLE_CALLBACK_URL` - Google OAuth callback URL (default: `http://localhost:3001/auth/google/callback`)
- `JWT_SECRET` - Secret key for JWT signing
- `TOKEN_CIPHER_KEY` - AES encryption key for tokens (64 hex chars)
- `MONGO_USER_SERVICE_URI` - MongoDB connection string for user service
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude AI
- `NODE_ENV` - Execution environment (development|production)
- `LOG_LEVEL` - Winston log level (debug|info|warn|error)
- `API_PORT` - Express API gateway port (default: 3000)
- `API_HOST` - API host (default: localhost)
- `USER_SERVICE_PORT` - NestJS user-service port (default: 3001)
- `FRONTEND_URL` - Frontend URL for OAuth callbacks (default: `http://localhost:3000`)
- `HEADLESS` - Playwright headless mode (true|false)
- `SLOW_MO` - Playwright slowdown in ms (default: 50)
- `CV_DIR` - CV upload directory (default: `./cv`)
- `OUTPUT_DIR` - Output directory (default: `./output`)
- `CONFIG_PATH` - Config file path (default: `./config.yaml`)

**Optional env vars:**
- `SMTP_HOST` - SMTP server hostname (Gmail: smtp.gmail.com, Outlook: smtp-mail.outlook.com)
- `SMTP_PORT` - SMTP port (default: 587)
- `SMTP_USER` - SMTP username (usually email address)
- `SMTP_PASS` - SMTP password or app-specific password
- `SMTP_FROM` - From email address (optional, defaults to SMTP_USER)
- `REDIS_URL` - Redis connection URL (optional, for caching)

**Secrets location:**
- `.env` file (gitignored - production secrets)
- `.env.example` (committed - template with dummy values)
- env vars loaded via `dotenv 16.4.5`

## Webhooks & Callbacks

**Incoming (OAuth Callbacks):**
- LinkedIn OAuth: `GET /auth/linkedin/callback?code=...&state=...` (user-service, port 3001)
- Google OAuth: `GET /auth/google/callback?code=...&state=...` (user-service, port 3001)

**Outgoing:**
- Email notifications: SMTP integration via Nodemailer 6.9.0 (when enabled via SMTP_* env vars)
  - Use case: Send CV by email for jobs without structured ATS forms

## Application Configuration (YAML)

**Location:** `config.yaml` (gitignored) or `config.yaml.example`

**Structure:**
```yaml
search:
  keywords: [...]          # Search keywords
  location: "..."          # Job location
  modality: [...]          # Remote | Hybrid | On-site
  languages: [...]         # Supported languages
  seniority: [...]         # Junior | Mid | Senior | Lead
  datePosted: "..."        # past_24h | past_week | past_month
  excludedCompanies: [...]
  platforms: [...]         # linkedin | indeed | getonboard

matching:
  minScoreToApply: 70      # 0-100 threshold
  maxApplicationsPerSession: 10

coverLetter:
  language: "en"           # en | es
  tone: "professional"     # professional | casual | enthusiastic

report:
  format: "both"           # markdown | html | both
```

**Parsed by:** js-yaml 4.1.0 in `packages/linkedin-mcp` and `packages/api`

---

*Integration audit: 2026-03-11*
