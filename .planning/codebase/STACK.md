# Technology Stack

**Analysis Date:** 2025-03-10

## Languages

**Primary:**
- TypeScript 5.4.5 - All source code across packages and apps
- JavaScript (Node.js) - Runtime execution for CLI, API, and microservices

**Secondary:**
- YAML - Configuration files (`config.yaml`, `.env`)
- HTML/CSS - Static UI in `apps/ui/` (vanilla frontend)

## Runtime

**Environment:**
- Node.js 18.0.0+ (specified in `package.json` engines field)

**Package Manager:**
- npm 10+ with npm workspaces
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Express 4.19.2 - REST API server for job agent (`packages/api/src/server.ts`)
- NestJS 10.0.0 - Microservice framework (planned, not yet implemented)
  - @nestjs/common, @nestjs/core, @nestjs/platform-express
  - @nestjs/jwt, @nestjs/mongoose, @nestjs/passport - Auth and persistence plugins
  - @nestjs/config - Configuration management

**Browser Automation:**
- Playwright 1.44.1 - LinkedIn scraping and form automation
  - Installed via `install:browsers` npm script for Chromium

**Logging:**
- Winston 3.13.0 - Structured logging across packages
- Chalk 4.1.2–5.3.0 - Colored console output for CLI/logs

**Protocol & Communication:**
- @modelcontextprotocol/sdk 1.0.4 - MCP Server for LinkedIn automation tools
  - StdioServerTransport for subprocess communication

**CLI & Process Management:**
- open 10.1.0 - Browser launcher (opens UI after startup)
- dotenv 16.4.5 - Environment variable loading from `.env` files
- js-yaml 4.1.0 - YAML parsing for config.yaml

**PDF/Document Processing:**
- pdf-parse 1.1.1 - PDF text extraction for CV parsing
- mammoth 1.7.1 - DOCX file parsing for CV parsing

**Email:**
- nodemailer 6.9.0 - SMTP client for email job applications

**Database (Future):**
- mongoose 8.0.0 - MongoDB ODM (user-service microservice)
- @nestjs/mongoose - NestJS integration

**Authentication (Future):**
- passport 0.6.0 - Authentication middleware framework
- passport-jwt 4.0.1 - JWT strategy
- passport-google-oauth20 2.0.0 - Google OAuth 2.0 strategy
- @nestjs/passport, @nestjs/jwt - NestJS integration

**Middleware:**
- cors 2.8.5 - CORS support for Express API
- multer 1.4.5-lts.1 - File upload handling for CV uploads

**Reactive:**
- rxjs 7.8.0 - Reactive programming library (NestJS dependency)

**Type Utilities:**
- reflect-metadata 0.1.13 - Metadata reflection (NestJS dependency)

## Key Dependencies

**Critical:**
- TypeScript 5.4.5 - Strict mode enabled, no implicit `any`, full SOLID support
- Playwright 1.44.1 - Core automation engine for LinkedIn scraping and Easy Apply
- Winston 3.13.0 - Centralized structured logging with correlationId support (`packages/logger/src/index.ts`)
- @modelcontextprotocol/sdk 1.0.4 - MCP protocol implementation for tool execution

**Infrastructure:**
- Express 4.19.2 - HTTP server for REST API and static UI serving
- NestJS 10.0.0 - Production microservice framework (modules, dependency injection, global error handling)
- js-yaml 4.1.0 - Configuration file parsing (job search filters, matching rules)
- pdf-parse 1.1.1 + mammoth 1.7.1 - CV document parsing pipeline

## Configuration

**Environment:**
- `.env.example` - Template for required environment variables
- Loaded via `dotenv.config()` at application startup
- Key variables:
  - `LINKEDIN_EMAIL`, `LINKEDIN_PASSWORD` - LinkedIn credentials
  - `NODE_ENV` - development or production (affects logging format)
  - `LOG_LEVEL` - winston logging level (info, debug, etc.)
  - `API_PORT`, `API_HOST` - Express server binding
  - `HEADLESS` - Playwright browser visibility (false = show browser)
  - `SLOW_MO` - Playwright slowdown in milliseconds
  - `CV_DIR`, `OUTPUT_DIR`, `CONFIG_PATH` - File paths
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` - Email configuration (optional)

**Build:**
- `tsconfig.base.json` - Shared TypeScript configuration:
  - Target: ES2022
  - Module: Node16
  - Strict mode: enabled
  - No implicit `any`: enforced
  - Path aliases: configured in workspace `package.json`
- Per-package `tsconfig.json` inherits from base
- Output: CommonJS + .d.ts declaration files to `dist/` directories

**Workspace Configuration:**
- Root `package.json` defines npm workspaces:
  - `packages/*` - Shared libraries (core, logger, cv-parser, linkedin-mcp, job-search, ats-apply, reporter, api)
  - `apps/*` - Applications (cli, web, ui, microservices)
  - `apps/microservices/*` - NestJS services (user-service)

## Platform Requirements

**Development:**
- Node.js 18.0.0+
- npm 10+
- Playwright browsers: `npm run install:browsers` (Chromium + Chromium Headless Shell)
- Git hooks via `.githooks/` directory

**Production:**
- Node.js 18.0.0+
- Chromium/Chromium Headless Shell for Playwright automation
- Linux, macOS, or Windows (Playwright is cross-platform)
- MongoDB instance for microservice data (not yet deployed)
- SMTP server access (optional, for email applications)

**API Deployment:**
- Express server on configurable `API_HOST:API_PORT` (defaults: localhost:3000)
- Static UI served from `apps/ui/` directory
- Output reports served from `output/` directory via `/output` route

---

*Stack analysis: 2025-03-10*
