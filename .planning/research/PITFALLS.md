# Domain Pitfalls — Job Agent SaaS

**Project:** Job Agent
**Dimension:** Pitfalls
**Mode:** Brownfield — CLI to SaaS migration
**Confidence:** HIGH

---

## Critical Pitfalls

### P-01: In-Memory Session State Blocks Multi-Tenancy
**What goes wrong:** The current CLI stores session state in Node.js process memory. Two concurrent users corrupt each other's state.
**Why it happens:** CLI-first design assumes one user, one session, one process.
**Prevention:** All session state goes to MongoDB scoped by userId + sessionId. SSE progress events stored as subdocuments, not in-memory arrays.
**Warning signs:** Any Map, Set, or module-level variable holding per-session data in packages/api or apps/cli.
**Phase:** 1 (Foundation)

### P-02: LinkedIn Ban from Cross-User Rate Limit Bypass
**What goes wrong:** Rate limiting is per-process. 10 concurrent users = 10x traffic to LinkedIn from same IP.
**Why it happens:** Redis-backed rate limiting was never implemented (confirmed CONCERNS.md).
**Prevention:** Redis-backed rate limiter keyed by (userId, action). Per-IP global throttle for shared deployments.
**Warning signs:** setTimeout calls in linkedin-mcp with hardcoded delays but no shared state.
**Phase:** 2 (Core Automation)

### P-03: OAuth Token Encryption / Log Leakage
**What goes wrong:** LinkedIn/Google OAuth tokens stored in plaintext or accidentally logged via Winston.
**Prevention:** AES-256-GCM encryption for all OAuth tokens at rest (RNF-08). Winston log sanitizer redacting accessToken, refreshToken fields.
**Warning signs:** this.logger.log(user) or console.log(token) in auth module.
**Phase:** 1 (Auth module must ship with encryption)

### P-04: MongoDB Missing userId Scope (Row-Level Security)
**What goes wrong:** NestJS service queries jobs/applications without filtering by userId. User A reads User B's data.
**Prevention:** Every Mongoose query in jobs/applications/sessions services MUST include { userId: req.user.id }. Unit test that verifies cross-user query returns empty.
**Warning signs:** this.model.find({}) without userId parameter in service methods.
**Phase:** 1 (enforce from first data-reading endpoint)

### P-05: Playwright Browser Process Leaks in NestJS
**What goes wrong:** chromium.launch() called inside NestJS request handler. Unhandled throw = zombie browser process. 50 requests = 50 zombie browsers = OOM crash.
**Prevention:** Playwright MUST run in a separate BullMQ worker process. NestJS API only enqueues jobs and reads progress — never touches Playwright directly.
**Warning signs:** Any playwright import in apps/microservices/ or packages/api/src/.
**Phase:** 2 (Sessions module must establish BullMQ worker pattern first)

### P-06: SSE Event Loss on Client Reconnect
**What goes wrong:** Client reconnects after network drop. SSE restarts from scratch — all previous progress lost.
**Prevention:** Persist every progress event to MongoDB. On reconnect, SSE endpoint replays all events since session start using Last-Event-ID header.
**Warning signs:** SSE endpoint reading from in-memory EventEmitter without MongoDB persistence.
**Phase:** 2 (Sessions module)

---

## Moderate Pitfalls

### P-07: LinkedIn DOM Selector Drift (Silent Easy Apply Failure)
**What goes wrong:** LinkedIn changes a button aria-label. easy_apply() returns { status: 'applied' } without actually submitting.
**Prevention:** After every Easy Apply, verify confirmation modal appeared. If not found, mark as status: 'failed' with reason: 'confirmation_not_detected'. Log screenshot.
**Warning signs:** easy_apply() function that does not assert a success state after submit.
**Phase:** 2

### P-08: Job Deduplication Gaps Across Sessions
**What goes wrong:** Same job URL appears in session 1 and session 2 (file-based dedup only checks current session).
**Prevention:** MongoDB JobHistory collection with (userId, jobUrl) unique compound index. Check before adding any job to results.
**Warning signs:** Dedup logic reading from output/jobs-found.json instead of MongoDB.
**Phase:** 2

### P-09: CORS Wildcard and Missing Auth Guards
**What goes wrong:** NestJS endpoints added without JwtAuthGuard. Unauthenticated requests read all data.
**Prevention:** Global JwtAuthGuard as APP_GUARD in AppModule — all endpoints protected by default. Public endpoints use @Public() decorator to opt out.
**Warning signs:** Guard added per-controller instead of globally.
**Phase:** 1

### P-10: config.yaml Parsing Without Zod Validation
**What goes wrong:** Invalid config.yaml causes crash deep in search pipeline with unhelpful error.
**Prevention:** Zod schema for AppConfigType. Validate on load, return structured errors. Already required in packages/core/src/types/config.types.ts.
**Warning signs:** yaml.load() result cast directly to AppConfigType without validation.
**Phase:** 1

---

## Minor Pitfalls

### P-11: CV PII Served as Static Files
**What goes wrong:** express.static('cv/') serves uploaded CVs to anyone who knows the filename.
**Prevention:** Remove static file serving for cv/. Serve only through authenticated NestJS endpoint validating req.user.id === file.ownerId.
**Phase:** 1

### P-12: External API Calls Without Timeouts
**What goes wrong:** Claude API call hangs indefinitely, accumulating open connections.
**Prevention:** timeout: 8000 on Anthropic client. AbortSignal on all external calls.
**Phase:** 3 (email apply module)

### P-13: CV Parser Silent Heuristic Fallback
**What goes wrong:** Parser returns empty skills: [] without error. Agent scores everything 0, applies to nothing, user confused.
**Prevention:** Add confidence score to ProfessionalProfileType. If skills.length === 0 or confidence < 0.5, throw ParseConfidenceError.
**Phase:** 1

### P-14: npm install vs npm ci Divergence in CI/CD
**What goes wrong:** CI installs different package versions than local dev. Flaky builds.
**Prevention:** GitHub Actions uses npm ci --frozen-lockfile.
**Phase:** CI/CD setup (RNF-22)

---

## Phase Mapping Summary

| Phase | Pitfalls to Address |
|-------|-------------------|
| 1 — Foundation | P-01, P-03, P-04, P-09, P-11, P-13 |
| 2 — Core Automation | P-02, P-05, P-06, P-07, P-08 |
| 3 — Application Management | P-10, P-12 |
| CI/CD | P-14 |

---

*Research completed: 2026-03-11*
