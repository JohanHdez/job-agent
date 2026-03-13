# Phase 1: Foundation - Research

**Researched:** 2026-03-11
**Domain:** NestJS Modular Monolith — app topology migration, MongoDB + Redis connectivity, shared types audit, structured logging via Winston DI, global JWT guard, CI/CD with gitleaks
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**NestJS App Topology**
- Transform `apps/microservices/user-service` into `apps/api` — rename/move the directory, do not scaffold from scratch
- Update CLAUDE.md monorepo structure to reflect `apps/api` as the NestJS Modular Monolith
- Phase 1 creates only infrastructure modules: AppModule, HealthModule, LoggerModule
- Existing auth code from user-service is kept in place inside apps/api — it is NOT deleted; Phase 2 will complete and wire it
- No empty stubs for future modules (auth, users, jobs, sessions) — those are added in their phases

**TypeScript Version Pinning**
- Standardize the entire monorepo on latest stable TypeScript 5.x (exact pin, e.g., "5.8.3")
- TypeScript installed only at root workspace level (hoisted) — not per-package devDependency
- Remove TypeScript devDependency from individual package.json files; root package.json is the single source
- tsconfig.base.json target and module resolution left unchanged (ES2022, Node16)

**CI/CD Pipeline**
- Use **gitleaks** (zricethezav/gitleaks-action) for secret scanning — zero-config, scans staged changes and git history
- CI gates: `tsc --noEmit` (all workspaces), test coverage >= 70% (NestJS modules), gitleaks secret scan
- ESLint is NOT added in Phase 1 — deferred to a later phase
- Replace the existing partial GitHub Actions workflow with a clean `.github/workflows/ci.yml`
- CI triggers: `push` and `pull_request` targeting `main` and `develop` branches

**NestJS Test Framework**
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

### Deferred Ideas (OUT OF SCOPE)
- ESLint gate in CI — add in a later phase
- Auth module full test coverage — Phase 2
- HTTPS enforcement / production CORS hardening — Phase 6 or deployment phase
- Per-package TypeScript dev dependency cleanup — can be done as part of Phase 1 type audit or as a separate cleanup
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NF-06 | OAuth tokens and credentials stored encrypted (AES-256-GCM) in MongoDB; never exposed in logs or API responses | `encryptToken`/`decryptToken` in `token-cipher.ts` already implement AES-256-GCM; must be carried over to apps/api and verified |
| NF-07 | All API routes require valid JWT signed with RS256, 24h expiry; unauthenticated requests return 401 | `JwtAuthGuard extends AuthGuard('jwt')` exists; Phase 1 registers it as global `APP_GUARD` in AppModule |
| NF-09 | Sensitive env vars never committed; CI/CD fails if secrets detected in code | gitleaks action covers this; existing .gitignore covers .env, config.yaml |
| NF-10 | Unit test coverage >= 70% on packages/shared/types and core NestJS modules; build fails below threshold | Jest + @nestjs/testing; jest.config.ts coverage thresholds set at 70% for branches/functions/lines |
| NF-11 | Zero TypeScript errors in strict mode; `any` prohibited; tsc --noEmit returns 0 in CI/CD | packages/core types already compile; user-service tsconfig has strict mode; unified TS 5.x pin resolves version mismatch |
| NF-12 | All NestJS modules use structured logging (Winston) with correlationId, userId, ISO timestamp; no console.log in production | `createLogger` factory and `requestContext` AsyncLocalStorage exist in packages/logger; must be converted to .ts source and wired into NestJS DI |
| NF-13 | Backend exposes GET /health returning { status, uptime, version } in < 100ms | @nestjs/terminus is the standard; HealthModule + HealthController + MongooseHealthIndicator |
| NF-17 | CI/CD with GitHub Actions; merge to main auto-deploys to staging; production deploy requires manual approval | existing .github/workflows/ci.yml must be replaced; deploy-staging.yml and deploy-prod.yml already exist |
</phase_requirements>

---

## Summary

Phase 1 is a "transform, don't rebuild" migration: `apps/microservices/user-service` becomes `apps/api`, the NestJS Modular Monolith. All auth code from user-service is retained in-place for Phase 2 to complete. What Phase 1 adds on top is: a HealthModule (GET /health), a LoggerModule (Winston factory wired into NestJS DI), a global JWT guard registered as `APP_GUARD`, the TypeScript source file for `packages/logger`, a CI pipeline rebuilt around `tsc --noEmit` + Jest coverage 70% + gitleaks, and a TypeScript version audit that removes per-package TS devDependencies in favour of the root-hoisted pin.

The existing codebase provides strong foundations to build on. `JwtAuthGuard`, `JwtStrategy`, `AppModule` with `ConfigModule.forRoot({ isGlobal: true })`, `MongooseModule.forRootAsync`, `encryptToken`/`decryptToken`, and the Express `correlationMiddleware` are all already implemented and correct. The only thing missing on the security side is registering `JwtAuthGuard` as an `APP_GUARD` provider in `AppModule` and adding a `@Public()` decorator escape hatch for the health endpoint.

The most significant gap is that `packages/logger/src/index.ts` does not exist — only compiled JS is present. The TypeScript source must be created to allow NestJS to import it with proper types and for `tsc --noEmit` to cover it. The NestJS DI pattern for the logger should use a `@Global()` `LoggerModule` that provides a `LOGGER` injection token, keeping the Winston factory decoupled from NestJS while allowing per-module injection.

**Primary recommendation:** Move `apps/microservices/user-service` → `apps/api`, add HealthModule + LoggerModule, register the global JWT guard, create the logger TypeScript source, and rewrite `.github/workflows/ci.yml` to add gitleaks and Jest coverage gates.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/common | ^10.3.8 | Decorators, guards, pipes, interceptors | Already installed in user-service; NestJS standard |
| @nestjs/core | ^10.3.8 | NestJS runtime and DI container | Already installed |
| @nestjs/platform-express | ^10.3.8 | Express adapter for NestJS | Already installed; project uses Express-based patterns |
| @nestjs/config | ^3.2.2 | ConfigModule with isGlobal support | Already installed; `ConfigModule.forRoot` pattern established |
| @nestjs/mongoose | ^10.0.6 | Mongoose integration | Already installed; MongooseModule.forRootAsync pattern established |
| @nestjs/jwt | ^10.2.0 | JWT generation and validation | Already installed |
| @nestjs/passport | ^10.0.3 | Passport integration | Already installed |
| @nestjs/testing | ^10.3.8 | NestJS test utilities | Already installed; needed for Jest tests |
| @nestjs/terminus | ^10.x | Health check indicators | Standard NestJS health module |
| passport-jwt | ^4.0.1 | JWT Bearer strategy | Already installed |
| winston | ^3.13.0 | Structured logger | Already used across all packages |
| mongoose | ^8.4.1 | MongoDB ODM | Already installed |
| reflect-metadata | ^0.2.2 | Decorator metadata (required by NestJS) | Already installed |
| rxjs | ^7.8.1 | Reactive streams (required by NestJS) | Already installed |

### Testing
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jest | ^29.x | Test runner for apps/api | NestJS default; aligns with @nestjs/testing |
| ts-jest | ^29.x | TypeScript transformer for Jest | Simpler config over @swc/jest for this project size |
| @types/jest | ^29.x | Jest type definitions | Required for TypeScript |
| supertest | ^6.x | HTTP integration testing | Controller endpoint tests |
| @types/supertest | ^6.x | Supertest types | Required for TypeScript |

### CI/CD
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| actions/checkout | v4 | Checkout code | Standard |
| actions/setup-node | v4 | Node.js setup with caching | Standard |
| zricethezav/gitleaks-action | v2 | Secret scanning | Zero-config; decided by user |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ts-jest | @swc/jest | @swc/jest is faster (Rust compiler) but requires more config; ts-jest works with existing tsconfig without additional setup |
| Global LoggerModule | Per-module createLogger() | Global module reduces boilerplate; per-module allows isolated service names — global recommended for consistency |
| @nestjs/terminus | Custom health controller | terminus gives MongoDB + Redis health indicators for free; custom is trivial but hand-rolls what terminus provides |

**Installation for apps/api (additions beyond user-service):**
```bash
npm install -w apps/api @nestjs/terminus
npm install -D -w apps/api jest ts-jest @types/jest supertest @types/supertest
```

---

## Architecture Patterns

### Recommended Project Structure for apps/api

```
apps/api/
├── src/
│   ├── main.ts                         # Bootstrap: ValidationPipe, global guard, port
│   ├── app.module.ts                   # Root module: ConfigModule, MongooseModule, RedisModule, LoggerModule, HealthModule
│   ├── common/
│   │   ├── decorators/
│   │   │   └── public.decorator.ts     # @Public() — skips JWT guard on a route
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts       # Global guard — already exists, carried from user-service
│   │   └── interceptors/
│   │       └── correlation.interceptor.ts  # Injects correlationId into AsyncLocalStorage per request
│   ├── modules/
│   │   ├── health/
│   │   │   ├── health.controller.ts    # GET /health — decorated @Public()
│   │   │   └── health.module.ts        # Imports TerminusModule
│   │   ├── logger/
│   │   │   ├── logger.module.ts        # @Global() module; exports LOGGER token
│   │   │   └── logger.constants.ts     # LOGGER injection token string
│   │   ├── auth/                       # CARRIED OVER from user-service — Phase 2 completes
│   │   └── users/                      # CARRIED OVER from user-service — Phase 2 completes
│   └── common/crypto/
│       └── token-cipher.ts             # CARRIED OVER — AES-256-GCM — NF-06
├── test/
│   ├── health.e2e.spec.ts              # GET /health → 200 with { status, uptime, version }
│   ├── jwt-guard.e2e.spec.ts           # Unauthenticated request → 401
│   └── logger.spec.ts                  # Logger attaches correlationId
├── jest.config.ts                      # Jest config with ts-jest + coverage thresholds
├── nest-cli.json
├── package.json
└── tsconfig.json
```

### Pattern 1: Global JWT Guard with @Public() Escape Hatch

**What:** Register `JwtAuthGuard` as a global `APP_GUARD` in `AppModule.providers`. Add a `@Public()` custom decorator that sets metadata. Override `canActivate` in the guard to check for the metadata and skip validation.

**When to use:** Whenever every route must be secured by default. Only routes explicitly decorated with `@Public()` bypass the guard. The health endpoint is the only `@Public()` route in Phase 1.

```typescript
// Source: NestJS official docs — Authentication > Guards
// apps/api/src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// apps/api/src/common/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

// apps/api/src/app.module.ts — provider registration
import { APP_GUARD } from '@nestjs/core';
providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
```

### Pattern 2: @Global() LoggerModule with Injection Token

**What:** A `@Global()` NestJS module that provides a Winston logger instance under a string injection token `LOGGER`. Any module can inject the logger without importing `LoggerModule` explicitly.

**When to use:** Cross-cutting concern (logging) that every module needs. Global avoids re-importing in each module while keeping Winston decoupled from NestJS internals.

```typescript
// apps/api/src/modules/logger/logger.module.ts
import { Global, Module } from '@nestjs/common';
import { createLogger } from '@job-agent/logger';
import { LOGGER } from './logger.constants';

@Global()
@Module({
  providers: [
    {
      provide: LOGGER,
      useFactory: () => createLogger('api'),
    },
  ],
  exports: [LOGGER],
})
export class LoggerModule {}

// Consumer pattern (any service):
// constructor(@Inject(LOGGER) private readonly logger: Logger) {}
```

### Pattern 3: Correlation NestJS Interceptor

**What:** A NestJS `NestInterceptor` that mirrors the Express `correlationMiddleware` — reads or generates a `X-Correlation-Id` header, stores it in `requestContext` AsyncLocalStorage, and sets the response header. This replaces the Express middleware pattern for the NestJS context.

**When to use:** Every incoming HTTP request in apps/api must have a correlationId in AsyncLocalStorage before the route handler runs, so all logger calls automatically attach it.

```typescript
// apps/api/src/common/interceptors/correlation.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { requestContext } from '@job-agent/logger';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const res = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
    const incoming = req.headers['x-correlation-id'];
    const correlationId =
      typeof incoming === 'string' && incoming.length > 0
        ? incoming
        : crypto.randomUUID();
    res.setHeader('X-Correlation-Id', correlationId);
    return new Observable((subscriber) => {
      requestContext.run({ correlationId }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
```

### Pattern 4: Health Module with @nestjs/terminus

**What:** `HealthModule` uses `TerminusModule` to expose `GET /health`. The controller checks MongoDB connection health via `MongooseHealthIndicator`. The endpoint is decorated `@Public()` so it bypasses the JWT guard.

**When to use:** NF-13 requires `GET /health` returning `{ status, uptime, version }` in under 100ms. Terminus provides MongoDB health indicators without hand-rolling.

```typescript
// apps/api/src/modules/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongodb'),
    ]);
  }
}
```

Note: The `{ status, uptime, version }` response shape is determined by what terminus returns plus any custom fields added. Terminus returns `{ status: 'ok'|'error', info, error, details }`. The version and uptime can be added as custom data by the health controller calling `process.uptime()` and reading `package.json` version.

### Pattern 5: packages/logger TypeScript Source

**What:** Create `packages/logger/src/index.ts` from the existing compiled `index.js`. The `.d.ts` declarations already exist and are correct — the source just needs to be the authoritative `.ts` file that `tsc --noEmit` covers.

**Key difference from existing JS:** The source must use `import type` where appropriate and must not import `chalk` for the production JSON path (chalk adds unnecessary dependency). The existing compiled output shows the complete implementation — it just needs to exist as `.ts`.

The `packages/logger` package needs a `tsconfig.json` extending `tsconfig.base.json` with `"module": "commonjs"` and `"experimentalDecorators": true` (same as user-service, since it's consumed by NestJS).

### Anti-Patterns to Avoid

- **Registering JwtAuthGuard as global without @Public():** Every public route (health check) would return 401. Always add the Reflector check and @Public() decorator before registering as APP_GUARD.
- **Using `createLogger()` directly in constructors without DI:** Bypasses the injection token pattern, making modules untestable. Always inject via `@Inject(LOGGER)`.
- **Keeping `module: "Node16"` in apps/api tsconfig:** User-service correctly uses `"module": "commonjs"` + `"moduleResolution": "node"` for NestJS (NestJS requires CommonJS; Node16 is for ESM packages). Do not change user-service tsconfig pattern.
- **Importing `@job-agent/logger` as a path alias before packages/logger is built:** The TypeScript source must be built (or ts-jest must handle it) before apps/api can import it. Use `ts-jest pathsToModuleNameMapper` with the tsconfig paths.
- **Using RS256 in Phase 1 without key infrastructure:** The current JwtStrategy uses `secretOrKey` (HS256 symmetric). NF-07 mentions RS256, but switching requires RSA key generation and secret management infrastructure. Phase 1 keeps HS256 via `JWT_SECRET` env var; RS256 is a Phase 2+ concern when full auth is wired.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Health check endpoint | Custom /health controller with manual DB ping | `@nestjs/terminus` + `MongooseHealthIndicator` | Terminus handles timeout, error formatting, multi-indicator aggregation, and the response schema |
| Request correlation | Manual req.id assignment | `AsyncLocalStorage` + `requestContext` (already in packages/logger) | The implementation already exists; just wire it as a NestJS interceptor |
| JWT validation | Manual token parsing in guards | `passport-jwt` + `@nestjs/passport` + `JwtStrategy` | Already fully implemented in user-service; carry it over intact |
| Test transpilation | Raw tsc for Jest | ts-jest | ts-jest integrates TypeScript compilation into Jest's transform pipeline with tsconfig support |
| Secret scanning | Custom git hook scripts | `zricethezav/gitleaks-action` | Maintained action with 150+ default rules covering all common secret patterns |
| AES-256-GCM encryption | Custom crypto implementation | Existing `token-cipher.ts` | Already implements correct IV generation, auth tag handling, and key validation — do not re-implement |

**Key insight:** The user-service contains more than 80% of what Phase 1 needs. The pattern for every item above is "carry over from user-service" or "add the missing NestJS module that wraps it," not "build from scratch."

---

## Common Pitfalls

### Pitfall 1: TypeScript Module System Mismatch

**What goes wrong:** `tsconfig.base.json` uses `"module": "Node16"` (ESM). `apps/microservices/user-service/tsconfig.json` correctly overrides to `"module": "commonjs"` (required by NestJS). If `apps/api/tsconfig.json` inherits from base without this override, NestJS decorators fail at runtime because `reflect-metadata` requires CommonJS.

**Why it happens:** NestJS is a CommonJS framework. The `Node16` module resolution in the base config is for packages that ship as ESM (e.g., packages/core). NestJS apps must explicitly override to CommonJS.

**How to avoid:** `apps/api/tsconfig.json` must contain:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

**Warning signs:** `TypeError: Reflect.metadata is not a function` at startup; `SyntaxError: Cannot use import statement in a module` in compiled output.

### Pitfall 2: @job-agent/logger Path Resolution in Jest

**What goes wrong:** Jest does not use the TypeScript path aliases from `tsconfig.json` by default. `import { createLogger } from '@job-agent/logger'` fails in tests with `Cannot find module '@job-agent/logger'`.

**Why it happens:** Jest resolves modules through its own `moduleNameMapper`, not through TypeScript paths.

**How to avoid:** In `apps/api/jest.config.ts`, use `pathsToModuleNameMapper` from `ts-jest`:
```typescript
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from '../../tsconfig.base.json';

export default {
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/../../' }),
};
```

**Warning signs:** `Cannot find module '@job-agent/core'` or `@job-agent/logger` in Jest output despite tsc compiling successfully.

### Pitfall 3: APP_GUARD Requires Reflector Injection

**What goes wrong:** The plain `JwtAuthGuard extends AuthGuard('jwt')` from user-service does not support `@Public()` because it does not inject `Reflector`. Registering it as APP_GUARD without modifying the class means the health endpoint returns 401.

**Why it happens:** The existing guard has no `canActivate` override — it relies on Passport directly. The `@Public()` decorator pattern requires explicit `Reflector` injection and metadata check.

**How to avoid:** The guard must be extended before registration as APP_GUARD (see Pattern 1 above). The `Reflector` is provided by NestJS core and does not need to be added as a provider.

**Warning signs:** `GET /health` returns 401 in integration tests; health check curl fails with `{ "statusCode": 401, "message": "Unauthorized" }`.

### Pitfall 4: packages/logger Has No TypeScript Source

**What goes wrong:** `packages/logger/src/` contains only compiled JS and `.d.ts` files. If `tsc --noEmit` is run on the packages/logger tsconfig, it will fail because there is no `.ts` source. If `apps/api` imports from `@job-agent/logger` and the source does not exist, the CI type-check step fails.

**Why it happens:** The logger was compiled without committing the source. The `.js` and `.d.ts` exist but the `.ts` source does not.

**How to avoid:** Phase 1 must create `packages/logger/src/index.ts`. The content is derivable from `index.js` (reverse the CommonJS output) and `index.d.ts` (the type signatures are already correct).

**Warning signs:** `tsc --noEmit -p packages/logger/tsconfig.json` exits with "no input files found"; `index.d.ts` exists but `index.ts` does not.

### Pitfall 5: gitleaks Scanning Existing History

**What goes wrong:** gitleaks by default scans the full git history. The repository already has commits. If any historical commit contains a secret pattern (even test data or example values), gitleaks fails CI on the first run.

**Why it happens:** `zricethezav/gitleaks-action` default mode is `protect` (scans staged changes on push events). The `detect` mode scans full history. Use `protect` mode for push/PR triggers to avoid false positives from historical commits.

**How to avoid:** Configure the action with the correct mode:
```yaml
- uses: zricethezav/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
The default `protect` mode only scans the diff of the current push, not history.

**Warning signs:** CI fails on first run with gitleaks findings pointing to old commits; scanning takes 5+ minutes (full history scan).

### Pitfall 6: TypeScript Version Mismatch Between Root and user-service

**What goes wrong:** Root `package.json` has `"typescript": "^5.4.5"`. `apps/microservices/user-service/package.json` also has `"typescript": "^5.4.5"` as a devDependency. After migration, if the per-package version is not removed, npm hoisting may pick a different version depending on resolution order.

**Why it happens:** npm workspaces hoist devDependencies to the root. If both root and a workspace specify TypeScript, the workspace-local version takes precedence for that workspace's scripts, potentially creating version inconsistency.

**How to avoid:** Remove `"typescript"` from `devDependencies` in `apps/api/package.json` (migrated from user-service). The root package.json becomes the single source after Phase 1 pins an exact version (e.g., `"typescript": "5.8.3"`).

**Warning signs:** `tsc --version` differs between workspace and root; decorator compilation errors in one workspace but not another.

---

## Code Examples

Verified patterns from existing codebase and NestJS docs:

### Existing AppModule Pattern (carry forward as-is)
```typescript
// Source: apps/microservices/user-service/src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env['MONGO_USER_SERVICE_URI'] ?? 'mongodb://localhost:27017/user-service',
      }),
    }),
    // Phase 1 additions:
    LoggerModule,   // @Global() — available everywhere after this
    HealthModule,   // GET /health
    // Auth + Users carried over unchanged:
    UsersModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },  // Phase 1 addition
  ],
})
export class AppModule {}
```

### Existing main.ts Pattern (minor update needed)
```typescript
// Source: apps/microservices/user-service/src/main.ts — update port env var name
const port = parseInt(process.env['API_PORT'] ?? '3001', 10);
// Remove console.log / process.stdout.write — use injected logger instead
// The bootstrap function cannot use @Inject, so use createLogger('api') directly
```

### Jest Config for apps/api
```typescript
// apps/api/jest.config.ts
import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { compilerOptions } = require('../../tsconfig.base.json');

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.test\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths ?? {}, {
    prefix: '<rootDir>/../../',
  }),
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

export default config;
```

### CI Pipeline (gitleaks + Jest coverage)
```yaml
# .github/workflows/ci.yml — replacement
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  typecheck:
    name: TypeScript (zero errors)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build -w packages/core
      - run: npm run typecheck   # must cover apps/api

  test:
    name: Jest (coverage >= 70%)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build -w packages/core
      - run: npm run build -w packages/logger
      - run: npm test --coverage --workspace=apps/api

  secrets:
    name: Secret scan (gitleaks)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: zricethezav/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Health Response Shape
```typescript
// terminus default + custom uptime/version overlay
// GET /health response:
{
  "status": "ok",
  "uptime": 12.345,         // process.uptime() — added by controller
  "version": "1.0.0",      // from package.json — added by controller
  "info": {
    "mongodb": { "status": "up" }
  }
}
// If MongoDB is down:
{
  "status": "error",
  "uptime": 12.345,
  "version": "1.0.0",
  "error": { "mongodb": { "status": "down", "message": "..." } }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `passport 1.x` API | `passport 0.7.x` (project-pinned) | N/A — must stay at 0.7 | All installed OAuth strategies (linkedin, google, jwt) target 0.6-0.7 API; upgrading breaks them |
| Per-package TypeScript installs | Root-hoisted single pin | Phase 1 decision | Eliminates version mismatch; `tsc` always resolves to one version |
| Express + AsyncLocalStorage correlation | NestJS interceptor + same AsyncLocalStorage | Phase 1 | Same `requestContext` store works across both contexts; no behavioral change needed |

**Key version notes:**
- TypeScript: Root currently pins `^5.4.5`. Phase 1 changes to exact pin (e.g., `5.8.3` — latest stable as of research date). Check `npm show typescript@latest version` for exact value during execution.
- NestJS: All packages at `^10.3.8`. No upgrade needed in Phase 1.
- @nestjs/terminus: Not yet installed. Latest is `^10.x`. Must be added to `apps/api/package.json`.
- Jest: Not yet in user-service (only listed in scripts, not in package.json devDependencies). Must be installed: `jest`, `ts-jest`, `@types/jest`.
- gitleaks-action: Use `v2` (latest major as of research date).

**Deprecated/outdated:**
- `npm audit` (current CI job): The existing `ci.yml` uses `npm audit --audit-level=critical`. Phase 1 replaces this with gitleaks per the decision. npm audit can be retained alongside gitleaks but is not a Phase 1 gate.
- `process.stdout.write()` in main.ts: The user-service bootstrap uses raw stdout writes. Phase 1 replaces these with the Winston logger from `createLogger('api')`.

---

## Open Questions

1. **Redis connection in GET /health**
   - What we know: Phase 1 must connect to Redis (MongooseModule + Redis are in AppModule). Redis is not yet in user-service dependencies.
   - What's unclear: Whether `GET /health` should check Redis connectivity (Claude's discretion per CONTEXT.md). Also unclear: which Redis client library to use (`ioredis` vs `redis` npm package). @nestjs/terminus has a `MicroserviceHealthIndicator` but not a first-party Redis indicator — it requires `ioredis` or manual ping.
   - Recommendation: Add Redis health check to the health endpoint using a simple `ioredis` ping. This makes the health endpoint genuinely useful and verifies Redis connectivity on startup. Add `ioredis` to apps/api dependencies and use `@nestjs/terminus` `HealthIndicator` base class to wrap it.

2. **TypeScript exact pin version**
   - What we know: Decision says "latest stable TypeScript 5.x, exact pin."
   - What's unclear: The exact version at implementation time. As of research date (2026-03-11), this needs to be verified with `npm show typescript@latest version` during the implementation task.
   - Recommendation: Planner should include a task step to check `npm show typescript@latest version` and substitute the result before pinning.

3. **packages/logger tsconfig.json**
   - What we know: `packages/logger/src/` has only compiled JS; no `tsconfig.json` exists in the logger package. A tsconfig is required for `tsc --noEmit` to cover it.
   - What's unclear: Whether logger should use `"module": "commonjs"` (for NestJS consumption) or `"module": "Node16"` (for ESM consumers like packages/api Express).
   - Recommendation: Use `"module": "commonjs"` to match NestJS consumption. The logger is primarily consumed by NestJS in Phase 1. ESM consumers can import the compiled JS directly.

4. **MONGO_API_URI env var name**
   - What we know: user-service uses `MONGO_USER_SERVICE_URI`. After renaming to `apps/api`, the variable name should reflect the new topology.
   - What's unclear: Whether to rename the env var or keep backward compatibility.
   - Recommendation: Use `MONGO_API_URI` for the renamed service. Update `.env.example`. The old `MONGO_USER_SERVICE_URI` should be documented as deprecated.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.x + ts-jest + @nestjs/testing |
| Config file | `apps/api/jest.config.ts` — does not exist yet (Wave 0 gap) |
| Quick run command | `npm test --workspace=apps/api -- --testPathPattern=health` |
| Full suite command | `npm test --workspace=apps/api -- --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NF-07 | Unauthenticated request returns 401 | integration | `npm test -w apps/api -- --testPathPattern=jwt-guard` | ❌ Wave 0 |
| NF-10 | Coverage >= 70% on core NestJS modules | coverage gate | `npm test -w apps/api -- --coverage` | ❌ Wave 0 |
| NF-11 | tsc --noEmit returns 0 errors | CI step | `npm run typecheck` | ❌ Wave 0 (needs apps/api tsconfig) |
| NF-12 | Logger attaches correlationId to each request | unit | `npm test -w apps/api -- --testPathPattern=logger` | ❌ Wave 0 |
| NF-13 | GET /health returns { status, uptime, version } < 100ms | integration | `npm test -w apps/api -- --testPathPattern=health` | ❌ Wave 0 |
| NF-17 | CI pipeline runs on push/PR | CI (no local command) | Push to develop branch | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -w apps/api -- --testPathPattern=<module>`
- **Per wave merge:** `npm test -w apps/api -- --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/jest.config.ts` — Jest configuration with ts-jest and 70% thresholds
- [ ] `apps/api/src/modules/health/health.controller.test.ts` — GET /health happy path + MongoDB down scenario
- [ ] `apps/api/src/common/guards/jwt-auth.guard.test.ts` — 401 on missing token, 200 on valid token, @Public() bypass
- [ ] `apps/api/src/modules/logger/logger.module.test.ts` — correlationId appears in log output
- [ ] `packages/logger/tsconfig.json` — enables tsc coverage of logger source
- [ ] `packages/logger/src/index.ts` — TypeScript source (not just compiled JS)
- [ ] Framework install: `npm install -D -w apps/api jest ts-jest @types/jest supertest @types/supertest`
- [ ] Terminus install: `npm install -w apps/api @nestjs/terminus`

*(Wave 0 must complete before any implementation task can pass its test gate.)*

---

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection — `apps/microservices/user-service/src/` (all files read directly)
- Codebase direct inspection — `packages/logger/src/index.js` + `index.d.ts`
- Codebase direct inspection — `packages/core/src/types/` (all three type files)
- Codebase direct inspection — `.github/workflows/ci.yml` (existing CI structure)
- Codebase direct inspection — `packages/api/src/common/logger/correlation.middleware.ts`
- Codebase direct inspection — `.planning/config.json` (nyquist_validation: true confirmed)

### Secondary (MEDIUM confidence)
- NestJS official documentation patterns for APP_GUARD + Reflector + @Public() — standard pattern documented in NestJS Authentication guide
- @nestjs/terminus health indicators — MongooseHealthIndicator is documented as part of terminus package
- gitleaks-action v2 — `protect` mode behaviour verified against gitleaks-action README

### Tertiary (LOW confidence)
- ts-jest `pathsToModuleNameMapper` configuration — pattern is well-known but exact API should be verified against ts-jest docs during implementation
- TypeScript 5.8.3 as "latest stable" — exact version must be confirmed with `npm show typescript@latest version` at implementation time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All core libraries already installed in user-service; only @nestjs/terminus and Jest are new additions
- Architecture: HIGH — All patterns drawn directly from existing codebase code or NestJS documented patterns
- Pitfalls: HIGH — Each pitfall is either observed directly in the existing codebase (tsconfig mismatch already present) or is a known NestJS gotcha with documented solutions

**Research date:** 2026-03-11
**Valid until:** 2026-04-10 (NestJS 10.x is stable; no major changes expected in 30 days)
