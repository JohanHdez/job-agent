# Technology Stack

**Project:** Job Agent — CLI-to-SaaS Evolution
**Researched:** 2026-03-11
**Overall confidence:** HIGH (stack is locked per requirements doc; versions verified from actual package.json files in codebase)

---

## Context: What Is Already Installed vs. What Needs Adding

This is a brownfield project. The stack is not a greenfield recommendation — it is constrained by the requirements document (JobAgent-Requerimientos-MVP-v1.1.docx) and by what already exists and works. The research below distinguishes between:

- **EXISTING** — installed, working, must be preserved
- **PARTIAL** — scaffolded but not fully wired
- **MISSING** — required by PROJECT.md but not yet present

---

## Recommended Stack

### Frontend — `apps/web/`

| Technology | Version | Status | Purpose | Why |
|------------|---------|--------|---------|-----|
| React | 19.2.0 | EXISTING | UI framework | Installed in apps/web/package.json. React 19 is the current stable release with concurrent features. Note: CLAUDE.md says "React 18+" — 19 is already installed and is a superset. |
| Vite | 7.3.1 | EXISTING | Build tool + dev server | Installed. Vite 7 uses Rolldown (Rust-based) bundler — significantly faster than Webpack. Native ESM, HMR under 50ms. |
| React Router | 6.30.0 | EXISTING | Client-side routing | Installed. `createBrowserRouter` API with data loaders. Do NOT migrate to React Router v7 (breaking changes, not justified for MVP). |
| Zustand | 5.0.4 | EXISTING | Global UI state | Installed. v5 uses React 18+ `useSyncExternalStore` natively. For auth state, session status, pipeline state — not server data. |
| TanStack Query | 5.80.7 | EXISTING | Server state + caching | Installed. v5 API is stable (`useQuery`, `useMutation`, `useInfiniteQuery`). All API calls go through this — never raw `useEffect` + fetch. |
| Tailwind CSS | 4.1.10 | EXISTING | Utility-first styling | Installed with `@tailwindcss/vite` plugin. v4 uses CSS-native cascade layers — no `tailwind.config.js` needed (config lives in CSS). |
| shadcn/ui | latest | MISSING | Component library | Not installed yet. Required by CLAUDE.md. Use `npx shadcn@latest init` — it generates components into `apps/web/src/components/ui/` and uses Radix UI + Tailwind under the hood. Do NOT install as an npm package (it is a code generator). |
| Radix UI | peer dep | MISSING | Accessible primitives | Installed automatically by shadcn/ui. Provides Dialog, Dropdown, Tooltip, etc. with accessibility baked in. |
| Lucide React | latest | MISSING | Icon set | Required by shadcn/ui. `npm install lucide-react`. Consistent icon vocabulary throughout UI. |
| clsx + tailwind-merge | latest | MISSING | Class merging utilities | Required by shadcn/ui's `cn()` helper. `npm install clsx tailwind-merge`. |
| axios | ^1.7.x | MISSING | HTTP client | Not installed. TanStack Query needs a fetch mechanism. Use axios (not native fetch) for interceptors — JWT token injection, refresh token rotation, and error normalization are cleaner with axios interceptors than fetch wrappers. |
| react-hook-form | ^7.x | MISSING | Form state management | Required for the config form (RF-09), profile editor (RF-04), and multi-step forms. Integrates with Zod for validation. Do NOT use Formik — it is slower and has worse TypeScript DX. |
| zod | ^3.x | MISSING | Schema validation | Required for frontend form validation AND for validating `AppConfig` from YAML (AppConfigSchema.parse). Single validation library across frontend and backend shared layer (shared schemas in packages/core). |

### Backend — NestJS Modular Monolith

| Technology | Version | Status | Purpose | Why |
|------------|---------|--------|---------|-----|
| NestJS Core | 10.3.8 | EXISTING (user-service) | Modular Monolith framework | The NestJS user-service is scaffolded. The migration plan is to fold the Express `packages/api` logic INTO NestJS modules, not maintain two HTTP servers. NestJS v10 is stable and actively maintained. |
| @nestjs/platform-express | 10.3.8 | EXISTING | Express HTTP adapter | Use Express adapter (not Fastify). Simpler for the team, `multer` already works with it, and the SSE implementation is straightforward. |
| @nestjs/config | 3.2.2 | EXISTING | Environment config | Wraps `dotenv` with injectable ConfigService. Use with `ConfigModule.forRoot({ isGlobal: true })`. |
| @nestjs/mongoose | 10.0.6 | EXISTING | MongoDB/Mongoose integration | Provides `MongooseModule.forFeature()` for per-module schema registration. |
| @nestjs/jwt | 10.2.0 | EXISTING | JWT token generation | Issues access tokens (15m) and refresh tokens (7d). Stateless JWT validation via guard. |
| @nestjs/passport | 10.0.3 | EXISTING | OAuth strategy runner | Runs Passport strategies in NestJS context. Required for LinkedIn and Google OAuth flows. |
| passport | 0.7.0 | EXISTING | Strategy container | Do NOT upgrade to passport 1.0 — breaking API changes; 0.7.x is stable and compatible with all installed strategies. |
| passport-linkedin-oauth2 | 2.0.0 | EXISTING | LinkedIn OAuth 2.0 | Handles LinkedIn authorization code flow. Requires `r_liteprofile` and `r_emailaddress` scopes. |
| passport-google-oauth20 | 2.0.0 | EXISTING | Google OAuth 2.0 | Standard Google OAuth. Requires `profile` and `email` scopes. |
| passport-jwt | 4.0.1 | EXISTING | JWT validation strategy | Validates Bearer tokens on protected routes. |
| mongoose | 8.4.1 | EXISTING | MongoDB ODM | v8 with native TypeScript support. Use `InferSchemaType` for schema-to-type inference where possible. |
| class-validator | 0.15.1 | EXISTING | DTO validation | Decorator-based validation on NestJS DTOs. Paired with `ValidationPipe`. |
| class-transformer | 0.5.1 | EXISTING | DTO transformation | Strips unknown properties, transforms types. Use with `plainToClass`. |
| rxjs | 7.8.1 | EXISTING | Reactive streams | Required by NestJS core. Use `Observable<MessageEvent>` for SSE via `@Sse()` decorator. |
| @nestjs/common Sse() | 10.x | PARTIAL | Real-time SSE | NestJS has native SSE support via `@Sse()` decorator returning `Observable<MessageEvent>`. This replaces the raw Express SSE implementation in agent.routes.ts. HIGH priority to migrate. |
| Redis (ioredis) | ^5.x | MISSING | Session store + rate limiter | CRITICAL missing piece per codebase CONCERNS.md. Required for: (1) multi-user session state replacing in-memory SessionState, (2) Redis-backed rate limiter per LinkedIn credential pair, (3) job deduplication cache. Use `ioredis` not the deprecated `redis` v3 package. |
| @nestjs/throttler | ^5.x | MISSING | API rate limiting | Per-IP rate limiting on all NestJS endpoints. Prevents abuse of agent run endpoints. Configure: 10 req/min per IP on POST /run; 100 req/min on GET endpoints. |
| @nestjs/schedule | ^4.x | MISSING | Cron jobs | Needed for: session cleanup (abandon stale sessions after 2h), LinkedIn credential health checks (RF-05). Use `@Cron()` decorator. |
| cookie-parser | ^1.4.x | MISSING | Refresh token cookie | Store refresh token in `httpOnly; Secure; SameSite=Strict` cookie. Never in localStorage (XSS risk). Install `cookie-parser` + `@types/cookie-parser`. |
| crypto (Node built-in) | built-in | PARTIAL | Token encryption | AES-256-GCM encryption for OAuth tokens and LinkedIn credentials at rest (RNF-08, RNF-10). Use Node's built-in `crypto.createCipheriv`. No external dependency needed — just needs implementation. |

### Database

| Technology | Version | Status | Purpose | Why |
|------------|---------|--------|---------|-----|
| MongoDB | 7.x (server) | EXISTING (target) | Primary persistence | Locked by requirements doc. Flexible document model suits job/application data with variable fields per platform (LinkedIn, Indeed, Greenhouse all expose different field sets). |
| Mongoose | 8.4.1 | EXISTING | ODM | Already installed in user-service. v8 has improved TypeScript support with `InferSchemaType`. |
| Redis | 7.x (server) | MISSING | Cache + session + rate limit | Required to solve three blocking issues from CONCERNS.md: in-memory session state, per-credential rate limiting, and cross-session job deduplication. |

**MongoDB Collection Ownership (module boundaries):**

| Collection | NestJS Module | Notes |
|------------|---------------|-------|
| `users` | AuthModule / UsersModule | OAuth profiles, encrypted credentials |
| `sessions` | SessionsModule | Pipeline session state (replaces in-memory) |
| `jobs` | JobsModule | JobListing[] with per-user deduplication |
| `applications` | ApplicationsModule | ApplicationRecord[] with status history |
| `progress_events` | SessionsModule | SSE event log for replay (replaces in-memory buffer) |

### Authentication

| Technology | Version | Status | Purpose | Why |
|------------|---------|--------|---------|-----|
| passport-linkedin-oauth2 | 2.0.0 | EXISTING | LinkedIn login (RF-01) | Already installed. LinkedIn OAuth 2.0 authorization code flow: authorization code → callback → access token → profile fetch. |
| passport-google-oauth20 | 2.0.0 | EXISTING | Google login (RF-02) | Already installed. Standard Google OAuth with profile and email scopes. |
| @nestjs/jwt | 10.2.0 | EXISTING | JWT access + refresh tokens (RF-03) | Issue short-lived access tokens (15 min) and long-lived refresh tokens (7 days). Store refresh token hash in MongoDB `sessions` collection, not in JWT payload. |
| cookie-parser | ^1.4.x | MISSING | Refresh token cookie transport | Refresh token goes in `httpOnly; Secure; SameSite=Strict` cookie. Access token stays in Zustand memory. On 401, frontend calls `/auth/refresh` automatically via axios interceptor. |

### Real-Time Updates

| Technology | Version | Status | Purpose | Why |
|------------|---------|--------|---------|-----|
| @nestjs/common Sse() | 10.x | PARTIAL | Server-Sent Events streaming | NestJS `@Sse()` decorator returns `Observable<MessageEvent>`. Replaces raw Express SSE implementation. Pipeline is server-push only — SSE is sufficient. |
| EventSource (browser built-in) | N/A | EXISTING | SSE client in React | Browser native EventSource API. Wrap in a `useSessionProgress()` hook in `packages/shared/hooks/` for reuse across features. |

**Why SSE over WebSocket:** The pipeline emits unidirectional events (job_found, job_applied, session_complete). WebSocket adds bidirectional complexity, a 90KB+ socket.io dependency, and stateful connection management — none of which serve this use case. Only reconsider if bidirectional control (pause/cancel mid-pipeline) becomes a hard requirement in v2.

### Automation — Preserved Packages

| Technology | Version | Status | Purpose | Why |
|------------|---------|--------|---------|-----|
| Playwright | 1.44.1 | EXISTING | Browser automation (LinkedIn Easy Apply + multi-platform search) | Already working. This is the product's core value. Do NOT change the package or its internal structure. |
| @modelcontextprotocol/sdk | 1.0.4 | EXISTING | MCP server framework | Already integrated in linkedin-mcp. Preserve for future Claude agent integration. |
| @anthropic-ai/sdk | 0.78.0 | EXISTING | Claude API (claude-sonnet-4-6) | CV parsing, job scoring, email generation. Already working. Model is locked to `claude-sonnet-4-6` per PROJECT.md. |

### Infrastructure and CI/CD

| Technology | Version | Status | Purpose | Why |
|------------|---------|--------|---------|-----|
| Docker | latest | MISSING | Container packaging | Required by constraints (AWS ECS target). One Dockerfile per service (NestJS monolith, web app). |
| Docker Compose | v2 | MISSING | Local development environment | Spins up MongoDB + Redis + NestJS + web app with a single command. Essential for consistent local dev across machines. |
| GitHub Actions | N/A | PARTIAL | CI/CD pipeline | `.github/workflows/deploy-prod.yml` exists. Needs additional gates: typecheck, lint, test coverage, Docker build + push to ECR. |
| AWS ECS + ECR | N/A | MISSING | Production container hosting | Locked by constraints. Use Fargate (serverless containers) over EC2 for easier scaling without managing instances. |

### Logging

| Technology | Version | Status | Purpose | Why |
|------------|---------|--------|---------|-----|
| Winston | 3.13.0 | EXISTING | Structured logging | Already used across all packages. JSON format in production, pretty-printed in dev. |
| @job-agent/logger | 1.0.0 | EXISTING (partial) | Shared logger factory | `packages/logger` provides the `createLogger(serviceName)` factory with AsyncLocalStorage correlation context. Migration of all packages to use it is pending — must complete before NestJS wiring. |

### Validation

| Technology | Version | Status | Purpose | Why |
|------------|---------|--------|---------|-----|
| zod | ^3.x | MISSING | Shared schema validation | Use for: (1) AppConfig validation after YAML parse replacing the current unsafe type cast, (2) React form validation via `zodResolver` with react-hook-form, (3) shared schemas in packages/core/src/schemas/. Install in packages/core, not in individual apps. |
| class-validator | 0.15.1 | EXISTING | NestJS DTO validation | Keep for NestJS `ValidationPipe`. Do NOT replace with Zod in the NestJS layer — class-validator integrates with the decorator-based system that NestJS expects. |

**Validation layer assignment:** Zod owns the shared/frontend layer (config schemas, form schemas, runtime type guards). class-validator owns the NestJS transport layer (DTO binding, request body validation). They are complementary, not competing.

### Testing

| Technology | Version | Status | Purpose | Why |
|------------|---------|--------|---------|-----|
| Vitest | 1.6.1 | EXISTING (linkedin-mcp only) | Unit and integration tests | Already installed in linkedin-mcp. Extend to all packages and apps/web. Vite-native — no separate configuration for the web app. |
| @testing-library/react | ^16.x | MISSING | React component testing | Required by CLAUDE.md (>=60% coverage on apps/web). Install with `@testing-library/jest-dom` and `@testing-library/user-event`. |
| Jest | built-in NestJS | EXISTING | NestJS service tests | NestJS scaffolds with Jest by default. Keep Jest for the microservice layer — integrates with `TestingModule` and `@nestjs/testing`. |
| Supertest | ^7.x | MISSING | NestJS HTTP integration tests | Required for controller endpoint tests covering RF-20, RF-21 and all agent routes. Install in user-service devDependencies and future NestJS modules. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Frontend framework | React 19 + Vite | Next.js 15 | No SSR needed. This is an authenticated SaaS dashboard — App Router adds complexity with no SEO benefit. |
| State management | Zustand v5 + TanStack Query v5 | Redux Toolkit | RTK is 3x the boilerplate for equivalent outcome. Zustand v5 + TanStack Query covers all cases cleanly. |
| CSS framework | Tailwind CSS v4 | Styled Components / CSS Modules | Tailwind v4 is already installed. Styled components add runtime overhead. CSS Modules lose Tailwind utility composition. |
| Component library | shadcn/ui | MUI / Ant Design | MUI and Ant impose their own design language that conflicts with the Linear/Vercel/Raycast aesthetic required by CLAUDE.md. shadcn/ui generates owned code — no vendor lock-in, fully Tailwind-compatible. |
| HTTP client | axios | native fetch | Axios interceptors are significantly cleaner for JWT refresh rotation and centralized error normalization. Native fetch requires more wrapper boilerplate to achieve the same. |
| Form library | react-hook-form + zod | Formik | Formik re-renders on every keypress (controlled inputs by default). react-hook-form uses uncontrolled inputs — minimal re-renders and better TypeScript DX. |
| Real-time | SSE via @Sse() | WebSocket / socket.io | Pipeline is server-push only. Socket.io adds 90KB+, complex handshake, and stateful connection management with no benefit for unidirectional progress events. |
| Backend framework | NestJS Modular Monolith | Separate Microservices | Microservices add network overhead, distributed tracing complexity, and larger deployment surface for an MVP. Modules can be extracted to independent services in v2 with minimal changes. |
| Cache / Session | Redis + ioredis | MongoDB sessions collection | Redis sub-millisecond reads for session lookup and rate-limit counters. MongoDB would work but adds meaningful latency to every request requiring session validation. |
| Database | MongoDB + Mongoose | PostgreSQL + Prisma | MongoDB is locked by project constraints. The flexible document model is also genuinely well-suited for variable job fields across platforms. |
| Validation layers | Zod (shared/frontend) + class-validator (NestJS) | Zod everywhere | Zod does not integrate cleanly with NestJS `ValidationPipe` which expects class decorator metadata. The hybrid approach gives optimal DX in each layer. |
| OAuth implementation | Passport.js strategies | NextAuth / Auth.js | Locked by constraints. Passport.js is lower-level but gives full control over token handling and credential storage. Auth.js is Next.js-centric and poorly suited for a NestJS backend. |

---

## Installation Reference

### Frontend additions (`apps/web`)

```bash
# shadcn/ui setup — run from apps/web/ directory
npx shadcn@latest init

# Core UI utilities (required by shadcn/ui cn() helper)
npm install -w apps/web lucide-react clsx tailwind-merge

# HTTP client
npm install -w apps/web axios

# Form handling + validation
npm install -w apps/web react-hook-form zod @hookform/resolvers

# Testing
npm install -D -w apps/web vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitejs/plugin-react jsdom
```

### Backend additions (NestJS)

```bash
# Redis client
npm install -w apps/microservices/user-service ioredis
npm install -D -w apps/microservices/user-service @types/ioredis

# Rate limiting
npm install -w apps/microservices/user-service @nestjs/throttler

# Scheduled tasks
npm install -w apps/microservices/user-service @nestjs/schedule

# Refresh token cookie transport
npm install -w apps/microservices/user-service cookie-parser
npm install -D -w apps/microservices/user-service @types/cookie-parser

# HTTP integration testing
npm install -D -w apps/microservices/user-service supertest @types/supertest
```

### Shared packages

```bash
# Zod for shared schemas — install in packages/core
npm install -w packages/core zod
```

---

## Critical Version Warnings

**React 19 vs CLAUDE.md "React 18+"**
apps/web already has React 19.2.0 installed. CLAUDE.md says "React 18+" which is satisfied — React 19 is fully backwards compatible. Do NOT downgrade. Update CLAUDE.md to "React 19+" on the next documentation pass.

**Tailwind CSS v4 — no tailwind.config.js**
Tailwind v4 is already installed. It has no `tailwind.config.js` — configuration lives in the main CSS file using the `@theme` directive. Do NOT follow v3 documentation for configuration. The `@tailwindcss/vite` plugin replaces the postcss approach entirely.

**NestJS v10 — do not upgrade to v11 for MVP**
NestJS v11 was released in 2025 with breaking changes to the DI internals. Stay on v10.x for the MVP. v11 migration should be a dedicated post-MVP task.

**passport v0.7 — do not upgrade to v1.0**
passport v1.0 has a breaking strategy API. All installed strategies (passport-linkedin-oauth2, passport-google-oauth20, passport-jwt) target passport ^0.6-0.7. Do NOT upgrade to 1.0 until all three strategies release v1.0-compatible versions simultaneously.

**TypeScript version mismatch across monorepo**
packages/core uses TypeScript 5.4.5; apps/web uses ~5.9.3. This mismatch can cause subtle type incompatibilities when shared types are consumed. Resolution: upgrade all packages to a common TypeScript version (5.9.x recommended, or pin tsconfig.base.json to 5.4 and allow apps to override). This is an architect-phase task, not a dependency install task.

**Playwright — update to latest 1.x**
Playwright 1.44 was released mid-2024. The latest 1.x has improved Chromium detection evasion and bug fixes relevant to LinkedIn automation. Update the caret range in packages/linkedin-mcp/package.json to `^1.44.1` to allow patch and minor updates. Run `npm run install:browsers` after any Playwright update.

---

## Sources

All version information verified directly from repository package.json files (read 2026-03-11):
- `package.json` (root monorepo)
- `apps/web/package.json`
- `apps/microservices/user-service/package.json`
- `packages/api/package.json`
- `packages/cv-parser/package.json`
- `packages/linkedin-mcp/package.json`
- `packages/core/package.json`

Architectural constraints and gap identification from:
- `.planning/PROJECT.md` (locked stack and constraints)
- `.planning/codebase/CONCERNS.md` (missing dependencies and tech debt)
- `.planning/codebase/ARCHITECTURE.md` (current system structure)
- `CLAUDE.md` (non-negotiable coding rules)

**Confidence levels:**
- EXISTING packages: HIGH — versions read directly from installed package.json files
- MISSING packages (shadcn/ui, ioredis, @nestjs/throttler, cookie-parser, zod, react-hook-form, axios, etc.): HIGH — standard, well-established choices consistent with the existing NestJS + React stack, each solving a specific documented gap
- Version numbers for MISSING packages: MEDIUM — current as of August 2025 training knowledge; verify latest stable releases before installing
