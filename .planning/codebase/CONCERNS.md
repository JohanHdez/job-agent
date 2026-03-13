# Codebase Concerns

**Analysis Date:** 2026-03-11

## Tech Debt

**Session state management (in-memory, single-session constraint):**
- Issue: The agent routes at `packages/api/src/routes/agent.routes.ts` store session state in a single `SessionState` variable that only allows one concurrent session. This prevents multi-user simultaneous runs and loses state on server restart.
- Files: `packages/api/src/routes/agent.routes.ts` (lines 35-48)
- Impact: Cannot handle multiple concurrent users. When a new session starts, the previous session state is lost. This blocks horizontal scaling and real-world deployment.
- Fix approach: Migrate session state to Redis (recommended) or persistent MongoDB collection. Implement session ID → state lookup instead of single global variable. Add cleanup for abandoned sessions.

**In-memory event stream replay without persistence:**
- Issue: Progress and semantic events (`progressEvents`, `semanticClients`, `semanticEvents` arrays in agent.routes.ts) are stored in memory only. Late-joining SSE subscribers get the replay, but if the server restarts mid-pipeline, all progress is lost.
- Files: `packages/api/src/routes/agent.routes.ts` (lines 38-45)
- Impact: Users running long pipelines (30+ minutes) lose visibility on server crash. Cannot resume from checkpoint.
- Fix approach: Store progress events to MongoDB with sessionId + timestamp. Query them on late SSE subscription. Implement session recovery.

**No rate limiting enforcement on Easy Apply:**
- Issue: `packages/linkedin-mcp/src/tools/easy-apply.tool.ts` calls `APPLY_DELAY()` after each submission, but there's no mechanism to prevent bursting or enforce the 8-12 second floor across users. Multiple concurrent requests bypass it.
- Files: `packages/linkedin-mcp/src/utils/delay.ts`, `packages/linkedin-mcp/src/tools/easy-apply.tool.ts` (line 259)
- Impact: Could trigger LinkedIn's anti-bot detection, causing CAPTCHAs or account locks.
- Fix approach: Implement a global application rate limiter (Redis-backed) per LinkedIn credential pair. Enforce minimum 12-second window between any two submissions across all sessions.

**LinkedIn password stored in .env without encryption at rest:**
- Issue: `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD` are read from `.env` and used directly in `packages/linkedin-mcp/src/agent.ts` (lines 48-55) without encryption before transmission or storage.
- Files: `.env` (gitignored but unencrypted), `packages/linkedin-mcp/src/agent.ts` (lines 48-55)
- Impact: If `.env` is compromised, attacker has plaintext credentials. Multi-device setups require .env duplication.
- Fix approach: Move LinkedIn credentials to `user-service` database encrypted with `TOKEN_CIPHER_KEY`. CLI and API retrieve via authenticated calls. Implement credential rotation UI.

---

## Known Bugs

**Easy Apply form validation edge case — infinite loop on malformed questions:**
- Symptoms: Pipeline hangs on Easy Apply step for certain job forms (e.g., malformed radio groups with no labels).
- Files: `packages/linkedin-mcp/src/tools/easy-apply.tool.ts` (lines 92-116, 250-273)
- Trigger: A radio group where `questionText` extraction returns empty string, and `targetLabel` is `null`, causing the code to fall back to `first()` and retry forever.
- Workaround: Manually skip problematic jobs by adjusting `config.matching.maxApplicationsPerSession` or rerunning with filters.

**Greenhouse board token validation missing:**
- Symptoms: Invalid or disabled `greenhouseCompanies` tokens in config are silently ignored; no application happens but no error is raised.
- Files: `packages/job-search/src/platforms/greenhouse.searcher.ts` (fetches board tokens without validation), `packages/ats-apply/src/handlers/greenhouse.handler.ts`
- Trigger: Typo in Greenhouse company slug (e.g., "strpe" instead of "stripe").
- Workaround: Check `output/jobs-found.json` for Greenhouse jobs; if missing, verify slugs in config.

**Report generation assumes output directory exists:**
- Symptoms: Reporter crashes if `output/` directory is deleted between CV parsing and report generation.
- Files: `packages/reporter/src/` (writes to OUTPUT_DIR without fs.mkdir check)
- Trigger: Manual deletion of `output/` mid-pipeline or cleanup script during long sessions.
- Workaround: Ensure `output/` directory exists before calling reporter. Pipeline should create it on startup.

---

## Security Considerations

**CORS open to all origins:**
- Risk: `packages/api/src/server.ts` (line 38) has `cors({ origin: '*' })`, allowing any website to call the API directly from the browser.
- Files: `packages/api/src/server.ts` (line 38)
- Current mitigation: None. No authentication gate on any /api route except SSE auth (missing).
- Recommendations:
  - Restrict CORS to `http://localhost:3000` in development and explicit domains in production.
  - Add JWT/session authentication to all routes except health check.
  - Validate user auth in SSE stream connections (`/api/run/progress`, `/api/search/events`).

**No rate limiting on API endpoints:**
- Risk: Unauthenticated endpoints allow unlimited request rates. Attacker could DOS the server or flood LinkedIn with requests.
- Files: `packages/api/src/routes/agent.routes.ts`, `packages/api/src/routes/config.routes.ts`, `packages/api/src/routes/cv.routes.ts`, `packages/api/src/routes/jobs.routes.ts`
- Current mitigation: None. No rate limiting middleware.
- Recommendations:
  - Add rate limiter middleware (express-rate-limit) per IP address.
  - Enforce strict per-session limits (max 1 search per minute, max 3 searches per hour).
  - Log rate limit violations for abuse detection.

**Sensitive user data exposed in /output static serve:**
- Risk: `packages/api/src/server.ts` (line 50) serves `/output` directory as static files. Contains `profile.json` (CV extract), `jobs-found.json` (search history), `applications.json` (applications made).
- Files: `packages/api/src/server.ts` (line 50)
- Current mitigation: None. Any user with network access can request `/output/profile.json`.
- Recommendations:
  - Remove static serve of `/output`. Return files only via authenticated endpoints.
  - Store sensitive output in encrypted database field with per-user access control.
  - Purge output files after 30 days (GDPR compliance).

**Greenhouse API calls lack timeout:**
- Risk: Greenhouse searcher and handler may hang indefinitely on network failures.
- Files: `packages/job-search/src/platforms/greenhouse.searcher.ts`, `packages/ats-apply/src/handlers/greenhouse.handler.ts`
- Current mitigation: None. No fetch timeout or retry logic.
- Recommendations:
  - Wrap all fetch calls with 30-second timeout.
  - Implement exponential backoff retry (max 3 attempts).
  - Log timeout failures and mark job as `failed_timeout`.

**No HTTPS enforcement in CLI/API:**
- Risk: Local API runs on HTTP. If API is exposed over network (ngrok, VPS), credentials and tokens transmit unencrypted.
- Files: `apps/cli/src/index.ts` (opens `http://localhost:3000`), `packages/api/src/server.ts` (listens on HTTP)
- Current mitigation: Localhost-only in dev. Production deployment assumes external HTTPS proxy.
- Recommendations:
  - Add `NODE_ENV=production` check to enforce HTTPS-only mode or reject non-localhost connections.
  - Issue warning in CLI when running on non-localhost interface.
  - Document HTTPS reverse proxy requirement.

---

## Performance Bottlenecks

**Job matcher O(n²) algorithm for large job sets:**
- Problem: `packages/linkedin-mcp/src/scoring/job-matcher.test.ts` and `job-matcher.ts` likely use naive string matching against 50-100 jobs. If keyword list is large (20+ keywords), scoring is O(n * m) for each job.
- Files: `packages/linkedin-mcp/src/scoring/job-matcher.ts`
- Cause: No indexing or caching of compiled regexes. Each job.title is searched against 20+ keyword regexes sequentially.
- Improvement path:
  - Pre-compile all keyword regexes once before loop.
  - Cache job title normalized form (lowercase, stemmed).
  - Consider Elasticsearch for 1000+ job scoring.
  - Profile with large datasets (200+ jobs) to confirm actual bottleneck.

**LinkedIn page navigation without connection pooling:**
- Problem: Each `page.goto()` in search-jobs and easy-apply opens a new network request. Playwright reuses the same page, but no connection pooling for concurrent requests.
- Files: `packages/linkedin-mcp/src/tools/search-jobs.tool.ts` (line 221), `packages/linkedin-mcp/src/tools/easy-apply.tool.ts` (line 221)
- Cause: Single-page, linear flow. Not parallelizable due to session/cookie constraints.
- Improvement path:
  - Profile actual network time vs. DOM extraction time.
  - If network bottleneck, consider multiple authenticated pages (session pool) for parallel job detail fetches.
  - Set aggressive Playwright timeouts (already 30s in place).

**No pagination batching in job search:**
- Problem: `search-jobs.tool.ts` scrolls and extracts all jobs in a single session. For 200-job searches, this is 10-15 minutes of linear scrolling + delays.
- Files: `packages/linkedin-mcp/src/tools/search-jobs.tool.ts` (entire flow)
- Cause: Architectural choice to be human-like (not a limitation).
- Improvement path:
  - Offer batch mode: extract jobs into staging table, rank, then detail-fetch top 50 in parallel.
  - Add user-configurable job fetch strategy: `sequential` (default, safe) vs. `batch` (faster, higher risk of detection).

---

## Fragile Areas

**Easy Apply form parsing brittle to LinkedIn UI changes:**
- Files: `packages/linkedin-mcp/src/tools/easy-apply.tool.ts` (entire file — 292 lines)
- Why fragile: Relies on 12+ specific selectors and DOM navigation patterns that LinkedIn can change at any time. The fallback strategies (questionText extraction via evaluate, positional radio selection) are heuristics with low confidence.
- Safe modification:
  - Never hard-code selectors directly. Always route through `selectors.constants.ts`.
  - When Easy Apply form detection fails (line 235), log the page HTML to a debug file for inspection.
  - Add monitoring/alerting: If 5+ consecutive jobs fail Easy Apply, notify user and suggest UI screenshot for debugging.
  - Consider OCR-based fallback for captcha/form verification.
- Test coverage: Only `job-matcher.test.ts` has tests (1 file out of 75 source files). Easy Apply has zero test coverage.

**Job matcher scoring without business rules validation:**
- Files: `packages/linkedin-mcp/src/scoring/job-matcher.ts`
- Why fragile: Score calculation (0-100) is based on keyword matching. If a job title contains one keyword (e.g., "Senior TypeScript Developer") but the user wants "Mid-level", no seniority check prevents high-scoring a job the user doesn't want.
- Safe modification:
  - Add explicit `validationPass()` before scoring: check seniority, location, modality against config BEFORE scoring.
  - Separate "hard constraints" (modality, location) from "soft scoring" (keyword match, description).
  - Return `{ score, validationErrors: [] }` so invalid jobs can be filtered before apply.
- Test coverage: Only `job-matcher.test.ts` tests the scoring (1 test file, 249 lines). No negative tests for invalid seniority/location.

**CV parser fallback to heuristic extraction untested:**
- Files: `packages/cv-parser/src/index.ts` (line 46), `packages/cv-parser/src/extractors/profile.builder.ts` (235 lines, likely untested)
- Why fragile: If Claude API is unavailable, the code silently switches to regex-based extraction (`buildProfile()`). Heuristic extraction is brittle — misses education, experience, skills if CV format is unusual.
- Safe modification:
  - Add verbose logging: "Falling back to heuristic extraction" + list of fields that couldn't be extracted with confidence.
  - Validate extracted profile: if email/phone are missing, force user to edit before proceeding.
  - Add unit tests for `buildProfile()` against 5+ CV samples (diverse formats).
- Test coverage: Zero tests for cv-parser. This is a critical path component.

**Greenhouse handler multi-step form handling (368 lines, untested):**
- Files: `packages/ats-apply/src/handlers/greenhouse-playwright.handler.ts` (368 lines)
- Why fragile: Similar to LinkedIn Easy Apply, it navigates multi-step Greenhouse forms with heuristic field detection. Greenhouse customizes forms per company, so assumptions about field order/labels are risky.
- Safe modification:
  - Log every form step: screenshot, detected fields, filled values.
  - Add dry-run mode: navigate form but don't submit, so user can verify field mapping.
  - Add specific error messages per step: "Step 3/5 — Could not detect experience field".
- Test coverage: Zero tests for this 368-line handler.

---

## Scaling Limits

**Single-threaded Playwright browser session:**
- Current capacity: ~50 jobs per session (default `maxResults`), ~25 Easy Apply submissions per session (rate limit).
- Limit: Each run opens one Chromium process. Memory usage ~200MB per browser. Cannot parallelize job detail fetches or applications.
- Scaling path:
  - For 100+ concurrent users: Use Playwright Pool (multiple browser processes, max 3-4 concurrent due to LinkedIn rate limits).
  - For 1000+ jobs/day: Consider Playwright Grid (distributed Playwright servers) or move to headless Chrome over RDP.
  - Currently blocks production deployment at scale.

**In-memory session state in agent.routes.ts:**
- Current capacity: 1 session per server instance.
- Limit: Cannot run more than 1 search at a time. Horizontal scaling (multiple API servers) breaks immediately.
- Scaling path: Migrate to Redis session store (see Tech Debt section above).

**Single output directory shared by all sessions:**
- Current capacity: Writes to `./output/` synchronously. No namespacing by user/session.
- Limit: Concurrent sessions overwrite each other's results (race condition).
- Scaling path: Namespace output by `sessionId`: `./output/{sessionId}/profile.json`, `./output/{sessionId}/jobs-found.json`, etc.

---

## Dependencies at Risk

**Playwright version pinned without auto-updates:**
- Risk: Playwright 1.x has frequent security updates. Package.json likely pins a specific version that may fall behind.
- Files: `package.json` (check devDependencies or packages/linkedin-mcp/package.json)
- Impact: Outdated Playwright = slower browsers, missed security patches, LinkedIn detection improvements lost.
- Migration plan:
  - Run `npm audit` monthly to check Playwright security advisories.
  - Update to latest Playwright 1.x every quarter (test with sample job searches).
  - Pin to `^1.40.0` (caret) to allow patches and minor updates auto-matically.

**js-yaml without schema validation:**
- Risk: `js-yaml` in `packages/api/src/routes/config.routes.ts` parses untrusted YAML without schema validation. Arbitrary YAML can create unlimited objects or trigger DOS.
- Files: `packages/api/src/routes/config.routes.ts`, `packages/core/src/types/config.types.ts`
- Impact: User uploads malicious config.yaml → server crashes.
- Migration plan:
  - Add `zod` schema validation after YAML parse: `AppConfigSchema.parse(yamlObj)`.
  - Add file size limit to config uploads (max 10KB).
  - Test with pathological YAML (deeply nested, large arrays).

**Missing test dependencies:**
- Risk: No Jest, Vitest, or Testing Library installed. The test script in package.json returns exit 0 without running tests.
- Files: `package.json` (line 19: `test: echo '...' && exit 0`)
- Impact: Cannot catch regressions. Zero visibility into code quality.
- Migration plan:
  - Install `vitest`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`.
  - Create minimal test suite for each critical module (job matcher, cv parser, easy apply).
  - Set minimum coverage gates: 60% web, 70% microservices, 80% shared/types.

**npm ci vs npm install inconsistency:**
- Risk: Development uses `npm install`, but CI/CD uses `npm ci --omit=dev`. Risk of lock file divergence.
- Files: `package.json` (scripts), `.github/workflows/deploy-prod.yml` (line 55)
- Impact: Works locally but fails in CI, or vice versa.
- Migration plan:
  - Standardize on `npm ci` everywhere (npm 7+).
  - Add pre-commit hook to prevent `package-lock.json` changes without code changes.

---

## Missing Critical Features

**No user authentication or multi-tenancy:**
- Problem: API serves a single authenticated LinkedIn session globally. No user model, no OAuth integration, no role-based access. Anyone with network access to the API can start searches on the shared LinkedIn account.
- Blocks: Real deployment, SaaS offering, sharing with team.
- Implementation path:
  1. Create `User` model in user-service with email, hashed password, OAuth providers.
  2. Add login endpoint that returns JWT + refresh token (already partially implemented in user-service auth.service.ts).
  3. Protect all agent routes with JWT middleware. Move LinkedIn credentials to encrypted `user.linkedinCredentials` field.
  4. Update CLI to prompt for login, store JWT in home directory `~/.job-agent/token`.

**No session resumption / checkpoint recovery:**
- Problem: If a 30-minute search is interrupted (crash, network loss, manual stop), all progress is lost. User must restart from scratch.
- Blocks: Long-running searches, unreliable network (mobile, VPN).
- Implementation path:
  1. Store progress events to MongoDB (not in-memory).
  2. On session start, check if prior incomplete session exists; offer "resume" option.
  3. On resume, query stored progress, skip already-fetched jobs, resume from current step.

**No LinkedIn credential rotation / multi-account support:**
- Problem: Single hardcoded LINKEDIN_EMAIL/PASSWORD in .env. If account hits rate limit or gets locked, entire system blocks.
- Blocks: Scaling, account safety, multi-user deployments.
- Implementation path:
  1. Migrate LinkedIn credentials to `user-service` encrypted database.
  2. Support multiple LinkedIn accounts per user.
  3. Rotate to alternate account on rate-limit error.
  4. Add credential health check endpoint: `GET /api/auth/linkedin/health` → tests login, returns remaining rate limit.

**No job deduplication across search runs:**
- Problem: If user runs two searches with overlapping keywords, same jobs appear twice in output. No detection of "already applied" across sessions.
- Blocks: Accurate application history.
- Implementation path:
  1. Store all applied jobs in MongoDB with job ID + source (LinkedIn, Indeed, etc.).
  2. On new search, cross-reference with applied history.
  3. Skip or mark as "already_applied" in output.

---

## Test Coverage Gaps

**Easy Apply flow completely untested:**
- What's not tested: Multi-step form filling, radio button selection, text field detection, error handling, submission retry logic.
- Files: `packages/linkedin-mcp/src/tools/easy-apply.tool.ts` (292 lines, 0% test coverage)
- Risk: Form parsing changes break silently. Users discover failures only after LinkedIn rejects their applications.
- Priority: **High** — Most failure-prone component.
- Suggestion: Write integration tests with mock Playwright page (e.g., mock HTML fixtures for 5 common form layouts).

**Job search extraction untested:**
- What's not tested: Job card parsing, location extraction, date handling, Easy Apply detection, pagination.
- Files: `packages/linkedin-mcp/src/tools/search-jobs.tool.ts` (258 lines, 0% test coverage)
- Risk: LinkedIn DOM changes → job extraction stops working, but no test alert.
- Priority: **High** — Critical data path.
- Suggestion: Mock Playwright page with realistic LinkedIn HTML. Test against 5+ different job card layouts.

**CV parser untested:**
- What's not tested: PDF parsing, heuristic extraction, Claude API fallback, profile validation.
- Files: `packages/cv-parser/src/extractors/profile.builder.ts` (235 lines), `packages/cv-parser/src/index.ts` (60 lines) — 0% test coverage.
- Risk: Users with unusual CV formats get silently mis-parsed, leading to mismatched job applications.
- Priority: **High** — Impacts every user.
- Suggestion: Create 5 realistic CV PDFs (diverse formats), test extraction accuracy for name, email, skills, experience.

**API error handling untested:**
- What's not tested: Missing CV file, malformed config YAML, pipeline crashes during run, SSE stream closure, late subscriber replay.
- Files: `packages/api/src/` (entire routes directory)
- Risk: Unhandled errors crash API or return vague error messages. Users don't know what went wrong.
- Priority: **Medium** — Less critical but improves UX.
- Suggestion: Write Supertest integration tests for each route: success, missing input, invalid config, server error during pipeline.

**Greenhouse handler untested:**
- What's not tested: Form navigation, field detection, multi-select handling, error recovery.
- Files: `packages/ats-apply/src/handlers/greenhouse-playwright.handler.ts` (368 lines), `packages/ats-apply/src/handlers/greenhouse.handler.ts` (181 lines) — 0% test coverage.
- Risk: Greenhouse form changes break applications. No visibility until users report failures.
- Priority: **High** — Another custom form-filling component with zero tests.
- Suggestion: Mock Playwright page with Greenhouse form HTML. Test against 3 real company Greenhouse boards.

**Job matcher scoring edge cases untested:**
- What's not tested: Zero keyword matches, perfect matches, case-insensitive matching, seniority validation, location mismatch handling.
- Files: `packages/linkedin-mcp/src/scoring/job-matcher.ts` (with `job-matcher.test.ts`)
- Risk: Job scoring is only 1 test file (249 lines). No negative cases for invalid seniority/location combinations.
- Priority: **Medium** — Has some tests, but incomplete.
- Suggestion: Add tests for edge cases: `describe('edge cases')` with 10+ test cases for scoring boundary conditions.

---

*Concerns audit: 2026-03-11*
