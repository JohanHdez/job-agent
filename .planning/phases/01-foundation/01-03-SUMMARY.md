---
phase: 01-foundation
plan: 03
subsystem: ci-cd
tags: [github-actions, typecheck, jest, gitleaks, ci, coverage-gate]

dependency_graph:
  requires:
    - phase: 01-01
      provides: apps/api NestJS scaffold, packages/logger TypeScript source, typecheck root script
    - phase: 01-02
      provides: apps/api jest.config.ts with 70% threshold, test:cov script in apps/api/package.json
  provides:
    - .github/workflows/ci.yml with three parallel gates (typecheck, test, secrets)
    - CI enforcement of NF-09 (gitleaks), NF-10 (70% Jest coverage), NF-11 (TypeScript zero errors), NF-17 (automated pipeline)
  affects:
    - all future PRs and pushes to main and develop

tech_stack:
  added:
    - "zricethezav/gitleaks-action@v2 (GitHub Actions secret scanner)"
    - "actions/checkout@v4 with fetch-depth: 0 for gitleaks protect mode"
    - "actions/setup-node@v4 with Node 20 LTS and npm cache"
  patterns:
    - "Three parallel GitHub Actions jobs — no needs: dependency so all run concurrently"
    - "concurrency group cancel-in-progress to prevent queue pile-up on rapid pushes"
    - "gitleaks protect mode (default) — scans diff of current push, not full history"

key_files:
  created: []
  modified:
    - .github/workflows/ci.yml

decisions:
  - "Three parallel jobs with no sequential dependency — typecheck, test, and secrets all run at the same time"
  - "No ESLint gate in Phase 1 — deferred per locked decision in CONTEXT.md"
  - "ci.yml does NOT handle deploys — deploy-staging.yml and deploy-prod.yml remain separate"
  - "gitleaks uses protect mode (scans push diff) with GITHUB_TOKEN — zero additional config"
  - "fetch-depth: 0 required in secrets job for gitleaks to access full push diff"

metrics:
  duration: "~5 minutes"
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_created: 0
  files_modified: 1
---

# Phase 1 Plan 3: CI Pipeline (typecheck + Jest + gitleaks) Summary

**One-liner:** GitHub Actions CI pipeline with three parallel gates — TypeScript zero-error compile, Jest coverage >= 70% for apps/api, and gitleaks secret scanning on the push diff — enforcing NF-09, NF-10, NF-11, and NF-17.

## What Was Done

### Task 1: Rewrite CI pipeline with typecheck + Jest + gitleaks gates

Replaced the entire contents of `.github/workflows/ci.yml` with a clean three-job pipeline:

**Triggers:**
- `on.push.branches: [main, develop]`
- `on.pull_request.branches: [main, develop]`

**Concurrency:**
- `group: ci-${{ github.ref }}`
- `cancel-in-progress: true` — rapid pushes cancel previous in-progress runs

**Job 1 — typecheck (TypeScript zero errors):**
- `actions/checkout@v4` + `actions/setup-node@v4` (Node 20, npm cache)
- `npm ci`
- `npm run build -w packages/core` — generates type declarations consumed by apps/api
- `npm run build -w packages/logger` — generates type declarations consumed by apps/api
- `npm run typecheck` — runs `tsc --noEmit` across apps/api and other workspaces

**Job 2 — test (Jest coverage >= 70%):**
- Same checkout + Node 20 + npm ci setup
- `npm run build -w packages/core` + `npm run build -w packages/logger`
- `npm run test:cov -w @job-agent/api` — runs `jest --coverage --passWithNoTests` with 70% threshold; exits non-zero if any axis drops below

**Job 3 — secrets (gitleaks):**
- `actions/checkout@v4` with `fetch-depth: 0` (full history required for push diff access)
- `zricethezav/gitleaks-action@v2` with `GITHUB_TOKEN` env — protect mode by default (scans push diff only, not history)

All three jobs have no `needs:` dependency — they run fully in parallel.

**Commit:** `19abb5d` — `feat(01-03): replace CI pipeline with typecheck + Jest + gitleaks gates`

### Task 2: Human verification checkpoint

The checkpoint was reviewed and **approved** by the user. All six verification steps passed:

| Step | Verified | Result |
|------|----------|--------|
| NestJS builds without errors | Yes | `npm run build -w @job-agent/api` exits 0 |
| GET /health returns 200 | Yes | `{ "status": "ok", "uptime": <number>, "version": "1.0.0" }` |
| Unauthenticated routes return 401 | Yes | APP_GUARD fires before routing — no JWT = 401 |
| Jest tests pass with >= 70% coverage | Yes | 14/14 tests pass, all coverage axes >= 70% |
| TypeScript compiles with zero errors | Yes | `npm run typecheck` exits 0 |
| CI YAML is valid with 3 parallel jobs | Yes | Confirmed typecheck + test + secrets |

## CI YAML Structure

```yaml
name: CI
on:
  push:    { branches: [main, develop] }
  pull_request: { branches: [main, develop] }
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  typecheck:  # npm run typecheck (after building core + logger)
  test:       # npm run test:cov -w @job-agent/api (70% threshold)
  secrets:    # zricethezav/gitleaks-action@v2 (protect mode, fetch-depth: 0)
```

## Requirements Met

| Requirement | Status | How |
|-------------|--------|-----|
| NF-09 — No secrets in repo | Met | gitleaks-action@v2 scans every push diff |
| NF-10 — Coverage >= 70% | Met | jest --coverage with 70% thresholds on apps/api |
| NF-11 — TypeScript zero errors | Met | tsc --noEmit fails CI if any TS error |
| NF-17 — Automated pipeline | Met | push + PR triggers on main and develop |

## Phase 1 Overall Completion Status

All three Phase 1 plans are complete:

| Plan | Name | Status | Key Deliverable |
|------|------|--------|-----------------|
| 01-01 | Monorepo Topology Migration | Complete | apps/api NestJS scaffold, packages/logger, TypeScript 5.9.3 pinned |
| 01-02 | NestJS Infrastructure Modules | Complete | JWT guard, LoggerModule, CorrelationInterceptor, GET /health, Jest 70% gate |
| 01-03 | CI Pipeline | Complete | .github/workflows/ci.yml with 3 parallel gates |

**Phase 1 — Foundation is complete.**

## Deviations from Plan

None — plan executed exactly as written. The CI YAML was rewritten in a single task with no blocking issues or required deviations.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `.github/workflows/ci.yml` | FOUND |
| Commit `19abb5d` (Task 1 — CI rewrite) | FOUND |
| Human checkpoint approved by user | CONFIRMED |
| Phase 1 all three plans complete | CONFIRMED |
