---
status: resolved
phase: 01-foundation
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md
started: 2026-03-16T15:28:30Z
updated: 2026-03-16T18:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. From the repo root, run `npm run dev:services` (or `nest start` inside apps/api). The NestJS API boots without errors, logs show it listening on the configured API_PORT, and no TypeScript or module resolution errors appear in the console.
result: issue
reported: "src/routes/agent.routes.ts(20,3): error TS2305: Module '@job-agent/core' has no exported member 'SsePayload'. src/routes/agent.routes.ts(21,3): error TS2305: Module '@job-agent/core' has no exported member 'SseProgressPayload'."
severity: blocker

### 2. GET /health — publicly accessible
expected: Hit `GET http://localhost:<API_PORT>/health` (no Authorization header). Response is HTTP 200 with a JSON body containing `status`, `uptime`, and `version` fields. No 401 is returned.
result: issue
reported: "Server fails to start — same TS2305 errors on SsePayload/SseProgressPayload prevent npm run dev:services from booting."
severity: blocker

### 3. JWT guard blocks unauthenticated routes
expected: Hit any protected route (e.g., `GET http://localhost:<API_PORT>/users/me`) without an Authorization header. Response is HTTP 401 Unauthorized. The route does NOT return 200 or 404.
result: skipped
reason: server won't start due to TS2305 errors

### 4. packages/logger — createLogger factory
expected: Run `npm test` inside `packages/logger` (or `npx vitest run` from that directory). All 13 tests pass. The logger exports `createLogger` and `requestContext` without errors.
result: pass

### 5. TypeScript 5.9.3 pin — zero type errors
expected: Run `npm run typecheck` from the repo root. The command exits with code 0 and reports zero TypeScript errors across all workspaces. No "explicit any" errors are reported.
result: pass

### 6. Jest coverage gate — 70% threshold met
expected: Run `npm run test:cov` inside `apps/api` (or `jest --coverage` from that directory). All 14 tests pass and coverage meets the 70% threshold on statements, branches, functions, and lines. Jest exits 0.
result: pass

### 7. CorrelationInterceptor — correlationId in logs
expected: Make any HTTP request to the running API (e.g., `GET /health`). The server console/log output includes a `correlationId` field (a UUID) in the log entry for that request.
result: skipped
reason: server won't start due to TS2305 errors

## Summary

total: 7
passed: 3
issues: 2
pending: 0
skipped: 2

## Gaps

- truth: "NestJS API boots without TypeScript errors on cold start"
  status: resolved
  reason: "User reported: src/routes/agent.routes.ts(20,3): error TS2305: Module '@job-agent/core' has no exported member 'SsePayload'. src/routes/agent.routes.ts(21,3): error TS2305: Module '@job-agent/core' has no exported member 'SseProgressPayload'."
  severity: blocker
  test: 1
  root_cause: "SsePayload and SseProgressPayload exist in packages/core/src/types/job.types.ts and are correctly re-exported through both barrels, but packages/core/dist/ is stale — built before the SSE types were added, so TypeScript resolves @job-agent/core to outdated .d.ts output missing those exports."
  artifacts:
    - path: "packages/core/dist/"
      issue: "Stale compiled output — missing SsePayload and SseProgressPayload declarations"
    - path: "packages/core/src/types/job.types.ts"
      issue: "Source is correct (lines 140-156 define both types) but dist not rebuilt"
  missing:
    - "Rebuild packages/core: cd packages/core && npm run build"
  debug_session: ""

- truth: "GET /health returns HTTP 200 with status/uptime/version fields"
  status: resolved
  reason: "User reported: Server fails to start — same TS2305 errors on SsePayload/SseProgressPayload prevent npm run dev:services from booting."
  severity: blocker
  test: 2
  root_cause: "Same as test 1 — stale packages/core/dist/ causes TS2305 compilation failure, preventing the API from starting."
  artifacts:
    - path: "packages/core/dist/"
      issue: "Stale build artifact"
  missing:
    - "Rebuild packages/core to unblock server startup"
  debug_session: ""
