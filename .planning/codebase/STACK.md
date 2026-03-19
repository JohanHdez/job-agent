# Technology Stack

**Analysis Date:** 2026-03-11

## Languages

**Primary:**
- TypeScript 5.4.5 - All source code across packages, apps, and microservices
- JavaScript - Build scripts, configuration files

**Secondary:**
- HTML/CSS - React component templates (Tailwind CSS)
- YAML - Configuration via `config.yaml`

## Runtime

**Environment:**
- Node.js 18.0.0+ (specified in root `package.json`)

**Package Manager:**
- npm workspaces - Root `package.json` defines workspace structure
- Lockfile: `package-lock.json` present (committed)

## Frameworks

**Core Framework:**
- React 19.2.0 - UI framework for `apps/web`
- React Router v6 - Client-side routing (specified in CLAUDE.md, dependency planned)
- Vite 7.3.1 - Frontend build tool and dev server for `apps/web`

**Backend/Microservices:**
- NestJS 10.3.8 - Microservice framework for `apps/microservices/user-service`
- Express 4.19.2 - REST API gateway in `packages/api`

**State Management:**
- Zustand 5.0.4 - Global client state for UI state, auth, session in `apps/web`
- TanStack Query 5.80.7 - Server state, caching, and API calls in `apps/web`

**Testing:**
- Vitest 1.6.1 - Test runner for `packages/linkedin-mcp`
- Jest - Test framework for NestJS microservices (default NestJS testing)

**Build/Dev:**
- TypeScript Compiler (tsc) - Primary build tool for all packages
- Vite 7.3.1 - Dev server and bundler for `apps/web`

## Key Dependencies

**Critical Infrastructure:**
- Winston 3.13.0 - Structured logging (used in `packages/cv-parser`, `packages/linkedin-mcp`, `packages/ats-apply`, `packages/reporter`, `packages/api`, and new `packages/logger`)
- MongoDB/Mongoose 8.4.1 - Database and ORM for `apps/microservices/user-service`
- Passport 0.7.0 - OAuth 2.0 authentication (LinkedIn, Google) in user-service
- Playwright 1.44.1 - Browser automation for LinkedIn scraping in `packages/linkedin-mcp` and `packages/ats-apply`

**API & Data Processing:**
- @anthropic-ai/sdk 0.78.0 - Claude API for CV parsing in `packages/cv-parser`
- @modelcontextprotocol/sdk 1.0.4 - MCP server framework in `packages/linkedin-mcp`
- Express 4.19.2 - HTTP server in `packages/api`
- Multer 1.4.5-lts.1 - File upload handling in `packages/api`
- CORS 2.8.5 - Cross-origin request middleware in `packages/api`

**Document Processing:**
- mammoth 1.7.1 - DOCX to HTML conversion in `packages/cv-parser`
- pdf-parse 1.1.1 - PDF text extraction in `packages/cv-parser`

**Utilities:**
- Chalk 5.3.0 - Colored console output (used across packages for CLI output)
- dotenv 16.4.5 - Environment variable loading
- js-yaml 4.1.0 - YAML config parsing in `packages/linkedin-mcp` and `packages/api`
- Nodemailer 6.9.0 - Email sending for job applications in `packages/ats-apply`
- open 10.1.0 - Open URLs/files in browser from `apps/cli`

**Authentication (NestJS user-service):**
- @nestjs/jwt 10.2.0 - JWT token generation and validation
- @nestjs/passport 10.0.3 - Passport integration with NestJS
- passport-jwt 4.0.1 - JWT strategy
- passport-linkedin-oauth2 2.0.0 - LinkedIn OAuth 2.0 strategy
- passport-google-oauth20 2.0.0 - Google OAuth 2.0 strategy
- passport-oauth2 1.8.0 - Generic OAuth 2.0 support

**NestJS Core Packages:**
- @nestjs/common 10.3.8 - Core decorators and utilities
- @nestjs/core 10.3.8 - Core runtime
- @nestjs/config 3.2.2 - Configuration management
- @nestjs/mongoose 10.0.6 - Mongoose integration
- @nestjs/platform-express 10.3.8 - Express adapter
- reflect-metadata 0.2.2 - Reflection metadata (required by NestJS)

**Frontend Styling:**
- Tailwind CSS 4.1.10 - Utility-first CSS framework in `apps/web`
- @tailwindcss/vite 4.1.10 - Vite plugin for Tailwind CSS

**Validation & Transformation:**
- class-validator 0.15.1 - Decorator-based validation in user-service
- class-transformer 0.5.1 - Object transformation in user-service

**RxJS:**
- rxjs 7.8.1 - Reactive streams library (required by NestJS)

## Configuration

**Environment:**
- `.env.example` - Template for required environment variables
- Variables include: LinkedIn credentials, OAuth client IDs, MongoDB URI, JWT secrets, SMTP config, API ports

**Build:**
- `tsconfig.base.json` - Base TypeScript configuration with strict mode enabled
  - Target: ES2022
  - Module resolution: Node16
  - Strict null checks, no implicit any, no unused locals
- Individual `tsconfig.json` in each package/app extending base config
- Vite config in `apps/web/vite.config.ts` with React and Tailwind plugins

**Frontend Development:**
- `apps/web/vite.config.ts` - Vite configuration with React plugin and Tailwind CSS support

## Platform Requirements

**Development:**
- Node.js 18.0.0 or higher
- npm 8+ (for workspaces support)
- Chromium browser (for Playwright automation) - installed via `npm run install:browsers`

**Production:**
- Node.js 18.0.0+
- MongoDB instance (separate database per microservice recommended)
- Anthropic API key (for CV parsing)
- LinkedIn account credentials (for browser automation)
- OAuth 2.0 credentials (LinkedIn, Google) for user authentication

## Structured Logging (RNF-14)

**Logger Package:** `packages/logger` - New shared logging factory

**Implementation:**
- Winston-based structured logger with context injection
- `createLogger(serviceName)` factory function
- Automatic context attachment:
  - Service name (passed at creation)
  - correlationId (per-request via AsyncLocalStorage)
  - userId (per-request via AsyncLocalStorage)
  - ISO timestamp
- Development: human-readable format
- Production: JSON format for log aggregators (Datadog, Loki, etc.)

**Consumers:**
- All packages already import `winston` directly
- Migration to `createLogger` factory planned for centralized context management

---

*Stack analysis: 2026-03-11*
