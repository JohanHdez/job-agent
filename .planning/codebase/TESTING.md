# Testing Patterns

**Analysis Date:** 2026-03-11

## Test Framework

**Runner:**
- Vitest (for packages and frontend unit tests)
- Jest (configured but not currently active; intended for microservices integration tests)

**Assertion Library:**
- Vitest built-in `expect()` API (compatible with Jest)

**Configuration:**
- `packages/linkedin-mcp/vitest.config.ts` — example Vitest setup
- Root `package.json` defines minimal test harness: `npm test` exits 0 (placeholder)

**Run Commands:**
```bash
npm test                   # Root: currently a placeholder (exit 0)
npm run test -w packages/linkedin-mcp   # Run tests in specific workspace
npm run dev               # Watch mode with concurrent builds
```

**TypeScript Checking:**
```bash
npm run typecheck         # tsc --noEmit across all packages/apps
```

## Test File Organization

**Location:**
- **Co-located pattern:** Test files live alongside source files in the same directory
- **Naming:** `.test.ts` for Node.js tests, `.test.tsx` for React components
- **Convention:** Never use `.spec.ts` or `.spec.tsx`

**Example structure:**
```
packages/linkedin-mcp/
├── src/
│   └── scoring/
│       ├── job-matcher.ts      (source)
│       └── job-matcher.test.ts (test)
```

**File pattern in vitest config:**
```typescript
include: ['src/**/*.test.ts']
```

## Test Structure

**Suite Organization:**
- Use `describe()` blocks to group related tests
- One `describe()` per function/feature being tested
- Example from `packages/linkedin-mcp/src/scoring/job-matcher.test.ts`:

```typescript
describe('scoreJob', () => {
  it('returns a score between 0 and 100 for any input', () => {
    const result = scoreJob(perfectMatchJob, seniorProfile);
    expect(result.compatibilityScore).toBeGreaterThanOrEqual(0);
    expect(result.compatibilityScore).toBeLessThanOrEqual(100);
  });

  it('does not mutate the original job object', () => {
    const original = { ...perfectMatchJob, compatibilityScore: 0 };
    scoreJob(original, seniorProfile);
    expect(original.compatibilityScore).toBe(0);
  });

  it('returns the full job listing with the new score attached', () => {
    const result = scoreJob(perfectMatchJob, seniorProfile);
    expect(result.id).toBe(perfectMatchJob.id);
    expect(result.title).toBe(perfectMatchJob.title);
  });
});

describe('rankJobs', () => {
  it('returns jobs sorted by score descending', () => {
    const ranked = rankJobs(jobs, seniorProfile, 0);
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i]!.compatibilityScore).toBeGreaterThanOrEqual(ranked[i + 1]!.compatibilityScore);
    }
  });
});
```

**Patterns:**
- **Fixtures:** Define test data at the top of describe block, reuse across tests
- **Setup:** Minimal setup — most tests create local fixtures inline
- **Teardown:** Not used in current tests (no side effects to clean)
- **Assertions:** Use semantic matchers: `toBeGreaterThanOrEqual()`, `toBeLessThan()`, `toHaveLength()`, `toBe()`, `toEqual()`

## Fixtures and Test Data

**Test Data Pattern:**
- Declare fixture objects as constants above test blocks
- Objects reused across multiple tests
- Example from `packages/linkedin-mcp/src/scoring/job-matcher.test.ts`:

```typescript
/** A senior TypeScript developer profile used as baseline. */
const seniorProfile: ProfessionalProfile = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  headline: 'Senior TypeScript Developer',
  summary: 'Experienced engineer.',
  seniority: 'Senior',
  yearsOfExperience: 8,
  skills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL'],
  techStack: ['TypeScript', 'Node.js', 'React', 'PostgreSQL'],
  languages: [{ name: 'English', level: 'Native' }],
  experience: [],
  education: [],
};

/** A near-perfect match job for seniorProfile. */
const perfectMatchJob: JobListing = {
  id: 'job-001',
  title: 'Senior TypeScript Developer',
  company: 'Acme Corp',
  location: 'Remote',
  modality: 'Remote',
  description: 'We use TypeScript, Node.js, React and PostgreSQL daily.',
  requiredSkills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL'],
  postedAt: '2026-03-01',
  applyUrl: 'https://example.com/jobs/001',
  hasEasyApply: true,
  compatibilityScore: 0,
  platform: 'linkedin',
};

/** Variations created from base fixtures. */
const noSkillsJob: JobListing = {
  ...perfectMatchJob,
  id: 'job-002',
  title: 'Software Engineer',
  requiredSkills: [],
  description: '',
};
```

**Location:**
- Fixtures live in the same `.test.ts` file as tests
- No separate fixture files yet (small test suite)

**Factory Pattern:**
- Spread operator `{ ...baseFixture, ...overrides }` for test variations
- Example: `zeroMatchJob`, `partialMatchJob`, `noSkillsJob` all extend `perfectMatchJob`

## Mocking

**Framework:**
- Vitest has built-in mocking via `vi` API (Jest-compatible)
- Not yet actively used in codebase (pure function tests don't require mocks)

**Patterns (when needed):**
- Import `vi` from `vitest`: `import { describe, it, expect, vi } from 'vitest';`
- Mock functions: `vi.fn()` for creating mock function spies
- Mock modules: `vi.mock('module-name')` to replace entire modules
- Mock specific methods: `vi.spyOn(obj, 'method').mockImplementation(...)`

**What to Mock:**
- External API calls (HTTP requests, database queries)
- System dependencies (file system, timers, random)
- Third-party libraries with side effects

**What NOT to Mock:**
- Pure utility functions (e.g., `scoreJob()`, `rankJobs()`)
- Type definitions and interfaces
- Internal helper functions (test them directly)

**Example (not yet implemented, but pattern):**
```typescript
// If we needed to mock a database call
import { vi } from 'vitest';

vi.mock('../db/user.repository.js', () => ({
  findUserById: vi.fn().mockResolvedValue({ id: '1', name: 'Test User' }),
}));
```

## Coverage

**Requirements:**
- Not yet enforced in this codebase
- Root `package.json` test script is placeholder: `npm test` always exits 0
- **CLAUDE.md specifies targets** (not yet gated):
  - Shared packages (types/utils): ≥80%
  - Frontend (apps/web): ≥60%
  - Microservices: ≥70%

**View Coverage (when enabled):**
```bash
npm run test -- --coverage
```

**Vitest Coverage Config (to add):**
```typescript
// In vitest.config.ts
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov'],
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
}
```

## Test Types

**Unit Tests:**
- Scope: Pure functions with clear inputs/outputs
- Approach: Test all branches and edge cases
- Example: `scoreJob()`, `rankJobs()` — all tests are unit tests
- Pattern:
  1. Arrange: Set up fixtures
  2. Act: Call the function
  3. Assert: Verify output and side effects (none, for pure functions)

**Integration Tests:**
- Scope: Multiple functions working together, or with external systems (DB, HTTP)
- Status: **Not yet implemented** — will be needed for:
  - Controller/service layers in microservices
  - API route handlers
  - Database operations
- Approach (when implemented): Use Supertest for Express/NestJS endpoints

**E2E Tests:**
- Status: **Not yet implemented**
- Intended: Test full user workflows (login → upload CV → configure → apply)
- Framework: TBD (Playwright, Cypress, or similar)

## Specific Test Examples

**Property Testing:**
- Current tests validate properties (invariants) of the scoring algorithm
- Example from `job-matcher.test.ts`:
```typescript
it('returns a score between 0 and 100 for any input', () => {
  const result = scoreJob(perfectMatchJob, seniorProfile);
  expect(result.compatibilityScore).toBeGreaterThanOrEqual(0);
  expect(result.compatibilityScore).toBeLessThanOrEqual(100);
});
```

**Immutability Testing:**
- Verify that functions don't mutate input objects
- Example:
```typescript
it('does not mutate the original job object', () => {
  const original = { ...perfectMatchJob, compatibilityScore: 0 };
  scoreJob(original, seniorProfile);
  expect(original.compatibilityScore).toBe(0);
});
```

**Sorting/Ranking Tests:**
- Verify correct ordering and filtering
- Example:
```typescript
it('returns jobs sorted by score descending', () => {
  const ranked = rankJobs(jobs, seniorProfile, 0);
  for (let i = 0; i < ranked.length - 1; i++) {
    expect(ranked[i]!.compatibilityScore).toBeGreaterThanOrEqual(ranked[i + 1]!.compatibilityScore);
  }
});
```

**Edge Case Testing:**
- Empty inputs: `rankJobs([], seniorProfile, 0)` → `[]`
- No matches: `rankJobs([zeroMatchJob], seniorProfile, 100)` → `[]`
- Null checks: Return sensible defaults, never throw on valid but "empty" input

**Boundary Testing (Scoring Algorithm):**
- Perfect match (100): `perfectMatchJob` with matching profile
- No match (0-50): `zeroMatchJob` with misaligned seniority + location
- Partial match (50-80): `partialMatchJob` with some skills + Hybrid location
- Benefit of doubt (65-75): `noSkillsJob` when no skills listed

## Test Globals

**Configuration in vitest.config.ts:**
```typescript
test: {
  environment: 'node',      // Node.js test environment
  include: ['src/**/*.test.ts'],
  globals: false,           // Explicit imports required (not global describe/it)
}
```

**Import Pattern:**
- Must explicitly import `describe`, `it`, `expect` from `vitest`
```typescript
import { describe, it, expect } from 'vitest';
import type { JobListing, ProfessionalProfile } from '@job-agent/core';
import { scoreJob, rankJobs } from './job-matcher.js';
```

## Current Test Coverage

**Tested:**
- `packages/linkedin-mcp/src/scoring/job-matcher.ts` — 16 test cases covering:
  - Score bounds (0-100)
  - Skill matching (exact, partial, none)
  - Seniority alignment
  - Keyword matching in description
  - Location/modality preferences (Remote > Hybrid > On-site)
  - Case-insensitive matching
  - Immutability
  - Sorting/filtering logic

**Untested (gaps):**
- React components (`apps/web/src/**/*.tsx`) — 0% coverage
- API routes (`packages/api/src/**/*.ts`) — 0% coverage
- Microservices controllers/services (`apps/microservices/**/*.ts`) — 0% coverage
- Middleware and utilities — 0% coverage

## Next Steps (Future Test Implementation)

**Phase 1: Unit Tests (High Priority)**
- Add tests to `packages/api/src/common/logger/index.ts` — structured logging factory
- Add tests to `packages/api/src/middleware/error.middleware.ts` — error handling
- Add tests to all utility packages

**Phase 2: React Component Tests (Frontend)**
- Use `@testing-library/react` + `renderHook` for custom hooks
- Test user interactions, not implementation details
- Cover `apps/web/src/features/*/` components

**Phase 3: Integration Tests (Backend)**
- Use Supertest for API route testing
- Mock MongoDB with an in-memory instance or test container
- Test full request/response cycles

**Phase 4: E2E Tests**
- Implement browser automation for critical workflows
- Verify end-to-end: login → upload → configure → results

---

*Testing analysis: 2026-03-11*
