---
phase: 3
slug: sessions-bullmq
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 + ts-jest |
| **Config file** | `apps/api/jest.config.js` (exists) |
| **Quick run command** | `npm run test -w apps/api -- --testPathPattern sessions --passWithNoTests` |
| **Full suite command** | `npm run test:cov -w apps/api` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -w apps/api -- --testPathPattern sessions --passWithNoTests`
- **After every plan wave:** Run `npm run test:cov -w apps/api`
- **Before `/gsd:verify-work`:** Full suite must be green, sessions/ files ≥ 70% coverage
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | RT-01 | unit | `npm test -w apps/api -- --testPathPattern sessions.service` | ❌ Wave 0 | ⬜ pending |
| 3-01-02 | 01 | 0 | RT-01 | unit | `npm test -w apps/api -- --testPathPattern sessions.controller` | ❌ Wave 0 | ⬜ pending |
| 3-01-03 | 01 | 1 | RT-01 | unit | `npm test -w apps/api -- --testPathPattern sessions.service` | ❌ Wave 0 | ⬜ pending |
| 3-01-04 | 01 | 1 | NF-05 | unit | `npm test -w apps/api -- --testPathPattern sessions.service` | ❌ Wave 0 | ⬜ pending |
| 3-01-05 | 01 | 2 | NF-05 | unit | `npm test -w apps/api -- --testPathPattern sessions.controller` | ❌ Wave 0 | ⬜ pending |
| 3-01-06 | 01 | 2 | NF-05 | manual | N/A — requires process kill | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/sessions/sessions.service.test.ts` — stubs for RT-01 (appendEvent, findByIdForUser, 409 guard) and NF-05
- [ ] `apps/api/src/modules/sessions/sessions.controller.test.ts` — stubs for RT-01 (202 response, Last-Event-ID header extraction) and NF-05 (DELETE cancel)
- [ ] `packages/core/src/types/session.types.ts` — types only, no test stub needed
- [ ] Framework already installed: Jest + ts-jest in `apps/api` — no framework install needed

*Wave 0 must be complete before any implementation tasks run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Worker process crash does not crash NestJS API process | NF-05 | Requires killing a child process mid-run; cannot be automated in Jest | 1. Start API. 2. POST /sessions to start a job. 3. `kill -9 <worker-pid>`. 4. Verify API still responds to `GET /health` within 500ms. 5. Verify crashed session shows `status: failed`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
