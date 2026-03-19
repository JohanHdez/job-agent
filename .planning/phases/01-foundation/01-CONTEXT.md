# Phase 1: Foundation - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the NestJS Modular Monolith (apps/api) so every future module can be written with security and observability already in place. This phase delivers: working MongoDB + Redis connections, shared types audited as single source of truth, structured logging (Winston) wired into NestJS DI, a global JWT guard that blocks all unauthenticated requests, a GET /health endpoint, and a CI/CD pipeline with compile + test + secret scan gates.

Creating any domain module (auth, users, jobs, sessions) is out of scope — those belong to their own phases.

</domain>

<decisions>
## Implementation Decisions

### NestJS App Topology
- Transform `apps/microservices/user-service` into `apps/api` — rename/move the directory, do not scaffold from scratch
- Update CLAUDE.md monorepo structure to reflect `apps/api` as the NestJS Modular Monolith
- Phase 1 creates only infrastructure modules: AppModule, HealthModule, LoggerModule
- Existing auth code from user-service is kept in place inside apps/api — it is NOT deleted; Phase 2 will complete and wire it
- No empty stubs for future modules (auth, users, jobs, sessions) — those are added in their phases

### TypeScript Version Pinning
- Standardize the entire monorepo on latest stable TypeScript 5.x (exact pin, e.g., "5.8.3")
- TypeScript installed only at root workspace level (hoisted) — not per-package devDependency
- Remove TypeScript devDependency from individual package.json files; root package.json is the single source
- tsconfig.base.json target and module resolution left unchanged (ES2022, Node16)

### CI/CD Pipeline
- Use **gitleaks** (zricethezav/gitleaks-action) for secret scanning — zero-config, scans staged changes and git history
- CI gates: `tsc --noEmit` (all workspaces), test coverage >= 70% (NestJS modules), gitleaks secret scan
- ESLint is NOT added in Phase 1 — deferred to a later phase
- Replace the existing partial GitHub Actions workflow with a clean `.github/workflows/ci.yml`
- CI triggers: `push` and `pull_request` targeting `main` and `develop` branches

### NestJS Test Framework
- Use **Jest** (NestJS default) for `apps/api` — aligns with @nestjs/testing and existing user-service config
- Vitest stays for `apps/web` and `packages/linkedin-mcp` — split by runtime
- Coverage threshold set in `apps/api/jest.config.ts`: branches, functions, lines all at 70%
- Phase 1 tests cover infrastructure only: GET /health response, JWT guard rejects 401, logger attaches correlationId
- Auth module tests are Phase 2's responsibility, not Phase 1

### Claude's Discretion
- Exact Jest configuration format (ts-jest vs @swc/jest as transpiler)
- Logger DI registration pattern (global module vs per-module inject)
- Health endpoint response schema beyond the required { status, uptime, version }
- Redis connection health check inclusion in GET /health response

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/microservices/user-service/src/app.module.ts`: Root AppModule with ConfigModule + MongooseModule — reuse directly as apps/api AppModule base
- `apps/microservices/user-service/src/main.ts`: NestJS bootstrap with ValidationPipe, CORS, and port config — reuse with minor updates
- `apps/microservices/user-service/src/modules/auth/guards/jwt-auth.guard.ts`: JWT guard exists — Phase 1 registers it as a global APP_GUARD
- `apps/microservices/user-service/src/common/crypto/token-cipher.ts`: AES-256-GCM token cipher — keep, used in Phase 2
- `packages/logger/src/index.js`: Winston `createLogger()` factory with AsyncLocalStorage for correlationId/userId — compiled JS exists; source needs to be a proper `.ts` file in packages/logger/src/index.ts

### Established Patterns
- Existing correlation middleware pattern in `packages/api/src/common/logger/correlation.middleware.ts` — reference for NestJS interceptor or middleware that injects requestContext
- `ConfigModule.forRoot({ isGlobal: true })` pattern established in user-service AppModule — carry forward
- MongooseModule.forRootAsync with env var URI pattern — carry forward
- AES-256-GCM encryption via TOKEN_CIPHER_KEY established in token-cipher.ts — pattern for all credential storage (NF-06)

### Integration Points
- `packages/core/src/types/` is the single source of truth for all domain types — Phase 1 audits and confirms all types compile under strict mode; any inline types in user-service source must be removed and replaced with @job-agent/core imports
- `packages/logger` must export `createLogger` and `requestContext` as proper TypeScript source (not just compiled JS) so NestJS DI can import it
- `.github/workflows/ci.yml` replaces existing partial workflow — Phase 1 owns this file

</code_context>

<specifics>
## Specific Ideas

- No specific visual or behavioral preferences captured — this is pure backend infrastructure
- "Transform, don't rebuild" principle: reuse everything from user-service that works; only add what's missing (health endpoint, global guard registration, CI pipeline)

</specifics>

<deferred>
## Deferred Ideas

- ESLint gate in CI — add in a later phase
- Auth module full test coverage — Phase 2
- HTTPS enforcement / production CORS hardening — Phase 6 or deployment phase
- Per-package TypeScript dev dependency cleanup (removing leftover TS devDeps from individual packages) — can be done as part of Phase 1 type audit or as a separate cleanup

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-11*
