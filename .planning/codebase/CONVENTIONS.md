# Coding Conventions

**Analysis Date:** 2026-03-11

## Naming Patterns

**Files:**
- `kebab-case` for all filenames: `job-matcher.ts`, `error.middleware.ts`, `correlation.middleware.ts`
- Example: `packages/linkedin-mcp/src/scoring/job-matcher.ts`, `packages/api/src/middleware/error.middleware.ts`

**Functions:**
- `camelCase` for function names: `scoreJob()`, `rankJobs()`, `createLogger()`, `toId()`, `devFormat()`, `jsonFormat()`
- Named export format: `export function functionName() { ... }`
- Example from `packages/linkedin-mcp/src/scoring/job-matcher.ts`:
```typescript
export function scoreJob(job: JobListing, profile: ProfessionalProfile): JobListing { ... }
export function rankJobs(jobs: JobListing[], profile: ProfessionalProfile, minScore = 0): JobListing[] { ... }
```

**Variables:**
- `camelCase` for local variables: `skillScore`, `seniorityScore`, `profileRank`, `titleLower`, `inferredRank`
- Constants: `UPPER_SNAKE_CASE` with `_CONSTANT` suffix
- Example from `packages/linkedin-mcp/src/scoring/job-matcher.ts`:
```typescript
const WEIGHTS = {
  skillsMatch: 0.50,
  seniorityMatch: 0.25,
  keywordMatch: 0.15,
  locationMatch: 0.10,
} as const;

const SENIORITY_RANK: Record<ProfessionalProfile['seniority'], number> = { ... };

const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const REFRESH_TOKEN_TTL_DAYS = 7;
```

**Types/Interfaces:**
- `PascalCase` with explicit `Type` or `Interface` suffix (no `I` prefix)
- Examples: `JobListing`, `ProfessionalProfile`, `ApiError`, `TokenPairDto`, `StructuredLogEntry`, `RequestContext`, `Feature` (inline interfaces)
- From `apps/microservices/user-service/src/modules/auth/auth.service.ts`:
```typescript
export interface TokenPairDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
```

**Classes/Services:**
- `PascalCase`: `AuthService`, `JobMatcherService`
- Example from `apps/microservices/user-service/src/modules/auth/auth.service.ts`:
```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService
  ) {}
}
```

**React Components:**
- `PascalCase` filename and component function: `App.tsx`, `LandingPage.tsx`, `LoginPage.tsx`, `ConfigPage.tsx`
- Typed with `React.FC`: `const App: React.FC = () => <Outlet />;`
- Example from `apps/web/src/App.tsx`:
```typescript
const App: React.FC = () => <Outlet />;
export default App;
```

**Enums (implicit):**
- String literal unions for enumerations
- Example from core types: `type ApplicationStatusType = 'applied' | 'failed' | 'skipped' | 'already_applied';`

## Code Style

**Formatting:**
- **No dedicated prettier config at root** — relies on ESLint alone
- Consistent spacing: 2 spaces, not tabs
- Line length: No hard enforced limit, but keep lines readable
- Semicolons: Required on all statements

**Linting:**
- **Tool:** ESLint with TypeScript parser (`@typescript-eslint`)
- **Config file:** `.eslintrc.js` at repository root
- **Key enabled rules:**
  - `@typescript-eslint/no-explicit-any`: **STRICT ERROR** — use `unknown` + type guards
  - `@typescript-eslint/no-unsafe-assignment/call/member-access/return/argument`: All **STRICT ERROR** — prevents implicit `any`
  - `no-console`: **ERROR** in application code (disabled for CLI + config scripts)
  - `@typescript-eslint/use-unknown-in-catch-callback-variable`: **ERROR** — typed catch blocks mandatory
  - `@typescript-eslint/no-floating-promises`: **ERROR** — all async operations awaited
  - `@typescript-eslint/no-require-imports`: **ERROR** in TypeScript files
  - `@typescript-eslint/no-unused-vars`: **ERROR** with `argsIgnorePattern: '^_'` for intentional unused params (e.g., Express error handlers)

**CLI Override:**
- Files in `apps/cli/src/**/*.ts`: `no-console` disabled (allows chalk logging)

**Config/Build Override:**
- Root-level `.js` and `.cjs` files: all unsafe rules disabled (Node environment)

**Run linting:**
```bash
npm run lint
```

## Import Organization

**Order:**
1. Node.js/external standard library imports (`path`, `crypto`, `child_process`, etc.)
2. External npm packages (`react`, `express`, `winston`, `mongoose`, etc.)
3. Internal workspace imports via npm aliases (`@job-agent/core`, `@shared/types`, etc.)
4. Relative local imports (`.js` extensions required for ESM)

**Example from `packages/api/src/common/logger/index.ts`:**
```typescript
import { AsyncLocalStorage } from 'async_hooks';
import winston from 'winston';
import chalk from 'chalk';
```

**Example from `apps/microservices/user-service/src/modules/auth/auth.service.ts`:**
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { UsersService } from '../users/users.service.js';
import { UserDocument } from '../users/schemas/user.schema.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';
```

**Path Aliases:**
- Mandatory use of workspace aliases for cross-boundary imports
- `@job-agent/core` → `packages/core/src/index.ts`
- `@job-agent/*` pattern for all packages
- **NEVER** relative path imports across domain boundaries (e.g., `../../packages/...`)

**File Extensions:**
- ESM imports use `.js` extension (TypeScript output): `import { AuthService } from './auth.service.js';`
- `type` imports for TypeScript-only types: `import type { JwtPayload } from './strategies/jwt.strategy.js';`

## Error Handling

**Patterns:**
- **Custom Error Classes:** Extend `Error` with typed properties
  - Example from `packages/api/src/middleware/error.middleware.ts`:
```typescript
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

- **Try/Catch Type Guard:** Always catch `unknown`, guard via `instanceof` checks
  - Example from `packages/api/src/middleware/error.middleware.ts`:
```typescript
if (err instanceof ApiError) {
  logger.warn(`ApiError ${err.statusCode}: ${err.message}`);
  res.status(err.statusCode).json({ error: err.message });
  return;
}

const message = err instanceof Error ? err.message : 'Internal server error';
logger.error(`Unhandled error: ${message}`);
```

- **Express Error Middleware:** Centralized error handler registered LAST in middleware chain
  - Function signature: `(err: unknown, _req: Request, res: Response, _next: NextFunction)`
  - Unused params prefixed with `_`

- **Async/Await:** All async operations awaited; no floating promises
  - Example: `await this.jwtService.sign(...)`
  - ESLint rule `@typescript-eslint/no-floating-promises` enforces this

## Logging

**Framework:** Winston in microservices/API, structured logging via `createLogger()` factory

**Approach:**
- Centralized logger factory: `packages/api/src/common/logger/index.ts`
- Automatic context injection via `AsyncLocalStorage<RequestContext>`:
  - `correlationId`: Request tracking ID (auto-generated)
  - `userId`: Authenticated user (when available)
  - Service name (bound at logger creation)
  - ISO timestamp

**Format:**
- **Development:** Human-readable with colors (`chalk`)
  - `[HH:mm:ss] [SERVICE] [correlationId uid=?] LEVEL message {meta}`
  - Example: `[14:32:15] [api] [uuid-1234] info Server started { port: 3000 }`

- **Production:** JSON for log aggregators
```json
{
  "timestamp": "2026-03-11T14:32:15.123Z",
  "level": "info",
  "service": "api",
  "correlationId": "uuid-1234",
  "userId": "user-567",
  "message": "Server started",
  "port": 3000
}
```

**Usage:**
```typescript
const logger = createLogger('api');
logger.info('Server started', { port: 3000 });
logger.warn('Rate limit approaching', { userId, remaining: 2 });
logger.error(`Unhandled error: ${message}`);
logger.debug(`Score for "${job.title}": ${score}`);
```

**Levels:** `error`, `warn`, `info`, `debug`, `verbose` (configurable via `LOG_LEVEL` env var)

**CLI Output:** Use `chalk` for colored console output
- `chalk.blue('[INFO]')` for information
- `chalk.green('[OK]')` for success
- `chalk.yellow('[WARN]')` for warnings
- `chalk.red('[ERROR]')` for errors
- Example from `apps/cli/src/index.ts`:
```typescript
process.stdout.write(chalk.blue('[INFO]') + ' Starting API server...\n');
process.stdout.write(chalk.green('[OK]') + ` Opening ${chalk.cyan(API_URL)} in your browser...\n`);
```

## Comments

**When to Comment:**
- Complex algorithms explaining the "why" (not the "what")
- Non-obvious mathematical formulas or constants
- Business logic decisions
- Performance-critical sections
- Gotchas or workarounds
- Example from `packages/linkedin-mcp/src/scoring/job-matcher.ts`:
```typescript
// When no required skills are listed, give benefit of the doubt (0.7)
// rather than a neutral 0.5 — the candidate is likely qualified if they
// passed keyword/seniority filters and the job simply has no structured skills.
const skillScore =
  jobSkills.length > 0 ? matchedSkills.length / jobSkills.length : 0.7;
```

**JSDoc/TSDoc:**
- Mandatory on all public functions and exported interfaces
- Describe parameters with `@param`, return value with `@returns`
- Example from `packages/linkedin-mcp/src/scoring/job-matcher.ts`:
```typescript
/**
 * Computes a 0–100 compatibility score between a job listing and a candidate profile.
 *
 * Scoring breakdown:
 * - 50%: skill/tech stack overlap
 * - 25%: seniority level alignment
 * - 15%: keyword presence in title and description
 * - 10%: remote/hybrid modality preference
 *
 * @param job - The job listing to score.
 * @param profile - The candidate's professional profile.
 * @returns The same job listing with compatibilityScore populated (0-100).
 */
export function scoreJob(job: JobListing, profile: ProfessionalProfile): JobListing { ... }
```

**Section Headers:** Use ASCII separators for logical blocks
```typescript
// ── 1. Skills match (50%) ────────────────────────────────────────────────
// ── 2. Seniority match (25%) ─────────────────────────────────────────────
// ── Format helpers ────────────────────────────────────────────────────────
// ── Factory ───────────────────────────────────────────────────────────────
```

## Function Design

**Size:**
- Keep functions focused on a single responsibility
- Aim for <50 lines per function; break larger logic into helpers
- Example: `scoreJob()` stays compact with semantic steps marked by section comments

**Parameters:**
- Use explicit typed parameters (no `any`)
- Optional parameters with defaults: `minScore = 0`
- No parameter reassignment; create new variables if transformation needed
- Example:
```typescript
export function rankJobs(
  jobs: JobListing[],
  profile: ProfessionalProfile,
  minScore = 0
): JobListing[] { ... }
```

**Return Values:**
- Explicit return types on all functions
- Never implicitly return `undefined`; use explicit return
- Immutable return values (e.g., spread operator for objects): `return { ...job, compatibilityScore: score };`
- Example:
```typescript
export function scoreJob(job: JobListing, profile: ProfessionalProfile): JobListing {
  // ... calculation ...
  return { ...job, compatibilityScore: score };
}
```

**Async Functions:**
- Must include typed `try/catch` with `unknown` catch parameter
- All awaits are explicit
- Return type clearly specified: `async function issueTokens(...): Promise<TokenPairDto> { ... }`

## Module Design

**Exports:**
- Named exports for functions and classes
- Default export for React components only
- Type-only exports: `export type { SomeType };`
- Example:
```typescript
// Correct
export function scoreJob(...) { ... }
export class AuthService { ... }
export interface TokenPairDto { ... }

// React component
const LandingPage: React.FC = () => { ... };
export default LandingPage;
```

**Barrel Files:**
- Use `index.ts` as barrel export for cross-boundary imports
- Example from `packages/core/package.json`: main points to `./dist/index.js`
- All workspace imports must target the barrel: `import { JobListing } from '@job-agent/core';`

**Const Assertions:**
- Use `as const` on configuration objects to preserve literal types
- Example:
```typescript
const WEIGHTS = {
  skillsMatch: 0.50,
  seniorityMatch: 0.25,
  keywordMatch: 0.15,
  locationMatch: 0.10,
} as const;
```

**Readonly Properties:**
- Immutable service dependencies use `private readonly`
- Example from `apps/microservices/user-service/src/modules/auth/auth.service.ts`:
```typescript
constructor(
  private readonly jwtService: JwtService,
  private readonly usersService: UsersService
) {}
```

---

*Convention analysis: 2026-03-11*
