---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x + ts-jest |
| **Config file** | `apps/api/jest.config.ts` |
| **Quick run command** | `npm run test --workspace=apps/api` |
| **Full suite command** | `npm run test:cov --workspace=apps/api` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=apps/api`
- **After every plan wave:** Run `npm run test:cov --workspace=apps/api`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-health-01 | health | 1 | NF-13 | unit | `npm run test --workspace=apps/api -- health` | ❌ W0 | ⬜ pending |
| 1-guard-01 | guard | 1 | NF-07 | unit | `npm run test --workspace=apps/api -- jwt` | ❌ W0 | ⬜ pending |
| 1-logger-01 | logger | 1 | NF-12 | unit | `npm run test --workspace=apps/api -- logger` | ❌ W0 | ⬜ pending |
| 1-types-01 | types | 2 | NF-11 | compile | `tsc --noEmit -p packages/core/tsconfig.json` | ✅ | ⬜ pending |
| 1-ci-01 | ci | 3 | NF-09, NF-17 | manual | CI triggers on push — verify GitHub Actions run | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/health/health.controller.test.ts` — stub for NF-13 (GET /health returns 200 with status/uptime/version)
- [ ] `apps/api/src/common/guards/jwt-auth.guard.test.ts` — stub for NF-07 (unauthenticated request returns 401)
- [ ] `apps/api/src/modules/logger/logger.module.test.ts` — stub for NF-12 (logger attaches correlationId)
- [ ] Jest + ts-jest installed in `apps/api/package.json` with coverage thresholds configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GET /health responds < 100ms | NF-13 | Response time SLA requires live server | Start apps/api, `curl -w "%{time_total}" http://localhost:3001/health`, confirm < 0.1s |
| gitleaks blocks commit with secret | NF-09 | Requires GitHub Actions environment | Push a branch with a fake secret string, verify CI fails at gitleaks step |
| CI runs on PR to main and develop | NF-17 | Requires GitHub Actions environment | Open a PR to main, verify CI workflow triggers and all gates pass |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
