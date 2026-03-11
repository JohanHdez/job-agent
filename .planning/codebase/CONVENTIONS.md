# Coding Conventions

**Analysis Date:** 2025-03-10

## Naming Patterns

**Files:**
- `kebab-case` for all file and folder names
- Service files: `service-name.ts` (e.g., `sleep.ts`, `logger.ts`)
- Handler files: `[domain].handler.ts` (e.g., `email.handler.ts`, `greenhouse.handler.ts`)
- Middleware files: `[feature].middleware.ts` (e.g., `error.middleware.ts`, `correlation.middleware.ts`)
- Route files: `[resource].routes.ts` (e.g., `config.routes.ts`, `cv.routes.ts`)
- Detector files: `[type]-detector.ts` (e.g., `ats-detector.ts`, `email-detector.ts`)
- Constants files: `[domain].constants.ts` (e.g., `selectors.constants.ts`)
- Type definition files: `[domain].types.ts` (e.g., `config.types.ts`, `job.types.ts`)

**Functions:**
- `camelCase` for function and method names
- Async functions: no special prefix, use `async` keyword
- Helper functions: lowercase prefix or underscore convention
- Example from `packages/ats-apply/src/utils/sleep.ts`: `sleep(minMs, maxMs)`

**Variables:**
- `camelCase` for all variable and parameter names
- Const objects and modules: `camelCase` (not UPPER_SNAKE_CASE)
- Request/response: `req`, `res` (Express conventions)
- Example: `const correlationId = crypto.randomUUID()`

**Types and Interfaces:**
- `PascalCase` for interface/type names
- No `I` prefix — use descriptive suffixes instead
- Naming conventions:
  - Interfaces: `[Domain]Type` or generic interface name (e.g., `AppConfig`, `JobListing`)
  - Type unions: `[Domain]Status` or `[Domain]Method` (e.g., `ApplicationStatus`, `ApplicationMethod`)
  - Enum-like types: `[Domain][Attribute]` (e.g., `PlatformId`)
  - Generic types: `[Name]Params`, `[Name]Result` (e.g., `EmailApplyParams`, `EmailApplyResult`)
- Examples from codebase:
  - `interface AppConfig { ... }` (not `IAppConfig`)
  - `type ApplicationStatus = 'applied' | 'failed' | ...`
  - `interface JobListing { ... }`
  - `type PlatformId = 'linkedin' | 'indeed' | ...`

**Constants:**
- `UPPER_SNAKE_CASE` for constants
- Use `as const` for type safety on selector/config objects
- Example from `packages/linkedin-mcp/src/browser/selectors.constants.ts`:
  ```typescript
  export const SELECTORS = { ... } as const;
  export const LINKEDIN_URLS = { ... } as const;
  ```

**Classes:**
- `PascalCase` for class names
- Example: `ApiError extends Error { ... }`

## Code Style

**Formatting:**
- TypeScript with strict mode enabled
- Target: ES2022 with Node16 module resolution
- Tab width: not specified (use project default)
- Linting enforces consistency via ESLint

**Linting:**
- Tool: ESLint 8.57.0 with `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`
- Config file: `.eslintrc.js` (root level)
- Key enforced rules:
  - `@typescript-eslint/no-explicit-any`: **FORBIDDEN** — use `unknown` with type guards instead
  - `@typescript-eslint/no-unsafe-*`: All unsafe operations forbidden (`assignment`, `call`, `member-access`, `return`, `argument`)
  - `no-console`: **FORBIDDEN** in application code — use structured logger instead
    - Exception: `apps/cli/src/**/*.ts` allowed (CLI output via `chalk`)
    - Exception: `*.js` and `*.cjs` files allowed (build scripts)
  - `@typescript-eslint/use-unknown-in-catch-callback-variable`: Typed catch blocks required
  - `@typescript-eslint/no-floating-promises`: All promises must be awaited or explicitly handled
  - `@typescript-eslint/no-misused-promises`: Async handlers allowed in Express/Node callbacks (with `checksVoidReturn: { arguments: false, properties: false }`)
  - `@typescript-eslint/no-require-imports`: Forbidden in `.ts` files (use ES modules)
  - `@typescript-eslint/no-unused-vars`: Unused variables forbidden except those prefixed with `_`
    - Example: `(err: unknown, _req: Request, res: Response, _next: NextFunction)`

**TypeScript Configuration:**
- Strict mode: `true`
- `noImplicitAny`: `true`
- `strictNullChecks`: `true`
- `noUnusedLocals`: `true`
- `noUnusedParameters`: `true`
- `noImplicitReturns`: `true`
- `exactOptionalPropertyTypes`: `true`
- Source maps and declaration maps generated for debugging
- Location: `tsconfig.base.json` (workspace root)

## Import Organization

**Order:**
1. Node.js built-in modules (`fs`, `path`, `async_hooks`, etc.)
2. External packages (`express`, `winston`, `dotenv`, etc.)
3. Internal type imports (`@job-agent/core`, `@job-agent/logger`, etc.)
4. Local relative imports (`./utils/logger.js`, `../middleware/error.middleware.js`)
5. Type-only imports grouped at the top with `import type { ... }`

**Path Aliases:**
- Monorepo uses npm workspaces with `@job-agent/` namespace
- All packages exported as:
  - `@job-agent/core` — shared types (`config.types.ts`, `job.types.ts`, `cv.types.ts`)
  - `@job-agent/logger` — structured logging factory
  - `@job-agent/cv-parser` — CV parsing utilities
  - `@job-agent/linkedin-mcp` — LinkedIn Playwright tools
  - `@job-agent/job-search` — job searching and scoring
  - `@job-agent/ats-apply` — ATS and email application handlers
  - `@job-agent/reporter` — report generation
  - `@job-agent/api` — Express API routes and middleware
- **Mandatory:** Cross-boundary imports MUST use workspace aliases, never relative paths
  - ✅ `import type { JobListing } from '@job-agent/core'`
  - ❌ `import { JobListing } from '../../../packages/core/src/types/job.types'`

**ES Modules:**
- All packages use `"type": "module"` in `package.json`
- Imports must include `.js` extension: `import { ... } from './file.js'`
- Exception: Type-only imports can omit extension (TypeScript handles)

## Error Handling

**Patterns:**
- Custom error class: `ApiError` with typed `statusCode` property
  - Located in `packages/api/src/middleware/error.middleware.ts`
  - Constructor: `new ApiError(statusCode: number, message: string)`
  - Example:
    ```typescript
    if (!host || !user || !pass) {
      throw new Error('SMTP not configured. Please set SMTP_HOST...');
    }
    if (!Array.isArray(config.search?.keywords)) {
      throw new ApiError(400, 'search.keywords must be an array');
    }
    ```
- Async functions: **all must have try/catch blocks with typed error handling**
  - Catch blocks receive `unknown` — use type guards
  - Example from `packages/api/src/routes/config.routes.ts`:
    ```typescript
    try {
      const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
      const config = yaml.load(raw) as AppConfig;
      res.json({ config });
    } catch {
      // Graceful fallback
      res.json({ config: null, message: 'No config found' });
    }
    ```
- Error middleware (Express): must be registered **LAST** in middleware chain
  - Signature: `(err: unknown, _req: Request, res: Response, _next: NextFunction) => void`
  - Logs via structured logger before sending response

## Logging

**Framework:** Winston 3.x with structured logging factory in `@job-agent/logger`

**Usage Pattern:**
```typescript
import { createLogger } from '@job-agent/logger';

const logger = createLogger('service-name');
logger.info('Event happened', { contextKey: value });
logger.warn('Warning message');
logger.error('Error occurred');
```

**Structured Log Entry Shape:**
- `timestamp` (ISO 8601)
- `level` ('error', 'warn', 'info', 'debug', 'verbose')
- `service` (string, passed at logger creation)
- `correlationId` (UUID v4, auto-injected via `AsyncLocalStorage`)
- `userId` (optional, auto-injected via `AsyncLocalStorage`)
- `message` (string)
- Additional metadata fields (passed as second argument)

**Output Format:**
- **Development** (`NODE_ENV !== 'production'`): Human-readable with colors via `chalk`
  - Example: `[HH:mm:ss] [service] [correlationId uid=123] INFO message {meta}`
- **Production** (`NODE_ENV === 'production'`): JSON for log aggregators (Datadog, Loki, etc.)

**Request Correlation:**
- Every HTTP request receives a UUID v4 `correlationId` via `correlationMiddleware`
- Stored in `AsyncLocalStorage` — automatically injected into all logger calls in that request's async chain
- Returned in `X-Correlation-Id` response header for client tracing

**Console Usage:**
- ❌ **FORBIDDEN** in microservices, utilities, and shared packages
  - Violation caught by ESLint: `'no-console': 'error'`
- ✅ **ALLOWED** in `apps/cli/` (CLI output via `chalk`)

## Comments

**When to Comment:**
- JSDoc on all public functions and exported interfaces
- Inline comments for non-obvious logic or workarounds
- Section headers with visual dividers (common in codebase):
  ```typescript
  // ─── Authentication ────────────────────────────────────────────────────────
  // ─── Job Search ────────────────────────────────────────────────────────────
  // ─── Routes ────────────────────────────────────────────────────────────────
  ```

**JSDoc/TSDoc:**
- Mandatory on all public functions, interfaces, and exported items
- Use `/**  ... */` block comments
- Include:
  - One-line summary
  - Parameter descriptions with types (TypeScript infers, but document intent)
  - Return type description
  - Example usage or important context
- Example from `packages/ats-apply/src/utils/sleep.ts`:
  ```typescript
  /**
   * Resolves after a random delay between minMs and maxMs.
   * Used to avoid rate-limiting when submitting multiple applications.
   */
  export function sleep(minMs = 3000, maxMs = 5000): Promise<void> { ... }
  ```
- Example from `packages/api/src/middleware/error.middleware.ts`:
  ```typescript
  /**
   * Express error-handling middleware.
   * Must be registered LAST in the middleware chain.
   */
  export function errorMiddleware(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void { ... }
  ```

## Function Design

**Size:** Keep functions focused and single-responsibility. Extract helpers for clarity.

**Parameters:**
- Typed explicitly
- Use object destructuring for multiple parameters (> 2)
- Example from `packages/ats-apply/src/handlers/email.handler.ts`:
  ```typescript
  export interface EmailApplyParams {
    toEmail: string;
    profile: ProfessionalProfile;
    job: JobListing;
    cvPath: string;
    config: AppConfig;
  }
  export async function applyViaEmail(params: EmailApplyParams): Promise<EmailApplyResult> {
    const { toEmail, profile, job, cvPath, config } = params;
  ```

**Return Values:**
- Type explicitly
- Use result objects for success/failure scenarios
- Example from `packages/ats-apply/src/handlers/email.handler.ts`:
  ```typescript
  export interface EmailApplyResult {
    status: 'applied';
    confirmationId?: string;
  }
  export async function applyViaEmail(params: EmailApplyParams): Promise<EmailApplyResult> { ... }
  ```

**Async Handling:**
- Mark functions `async` where they use `await`
- Always have try/catch with typed error handling
- Use `Promise<Type>` return type

## Module Design

**Exports:**
- Export public types and functions only
- Use barrel exports (`index.ts`) sparingly — workspace aliases handle re-exports
- Example from `packages/logger/src/index.ts`:
  ```typescript
  export interface RequestContext { ... }
  export const requestContext = new AsyncLocalStorage<RequestContext>();
  export function createLogger(serviceName: string): winston.Logger { ... }
  ```

**Barrel Files:**
- Each package has `packages/[name]/src/index.ts` exporting public API
- Cross-package imports use workspace aliases: `import { X } from '@job-agent/logger'`
- No deep imports across package boundaries

## Language

**Mandatory:** All code, comments, variable names, and function names MUST be written in **English only**.
- No Spanish identifiers in code
- Selectors and regex patterns support bilingual **content** (EN + ES) but identifier names are English
- Example from `packages/linkedin-mcp/src/browser/selectors.constants.ts`:
  ```typescript
  export const SELECTORS = {
    // English identifier
    EASY_APPLY_NEXT_BUTTON: 'button[aria-label="Continue to next step"], button[aria-label="Continuar al siguiente paso"]',
    // ↑ Selector string is bilingual, but the constant name is English
  ```

---

*Convention analysis: 2025-03-10*
