---
phase: 2
slug: auth-users
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (NestJS) + Vitest (React/web) |
| **Config file** | `apps/api/jest.config.ts` / `apps/web/vite.config.ts` |
| **Quick run command** | `cd apps/api && npm test -- --testPathPattern="auth|users" --passWithNoTests` |
| **Full suite command** | `npm run test --workspaces --if-present` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npm test -- --testPathPattern="auth|users" --passWithNoTests`
- **After every plan wave:** Run `npm run test --workspaces --if-present`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | AUTH-01 | unit | `cd apps/api && npm test -- --testPathPattern="auth"` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | AUTH-02 | unit | `cd apps/api && npm test -- --testPathPattern="auth"` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | AUTH-03 | unit | `cd apps/api && npm test -- --testPathPattern="auth"` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | AUTH-04 | unit | `cd apps/api && npm test -- --testPathPattern="auth"` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | PROF-01 | integration | `cd apps/api && npm test -- --testPathPattern="users"` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | PROF-02 | integration | `cd apps/api && npm test -- --testPathPattern="cv"` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 2 | PROF-03 | integration | `cd apps/api && npm test -- --testPathPattern="profile"` | ❌ W0 | ⬜ pending |
| 2-02-04 | 02 | 2 | PROF-04 | integration | `cd apps/api && npm test -- --testPathPattern="users"` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | SRCH-01 | unit | `cd apps/api && npm test -- --testPathPattern="presets"` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 2 | SRCH-02 | unit | `cd apps/api && npm test -- --testPathPattern="presets"` | ❌ W0 | ⬜ pending |
| 2-03-03 | 03 | 3 | NF-03 | performance | `cd apps/api && npm test -- --testPathPattern="cv"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/auth/auth.service.spec.ts` — stubs for AUTH-01, AUTH-02, AUTH-03, AUTH-04
- [ ] `apps/api/src/modules/users/users.service.spec.ts` — stubs for PROF-01, PROF-02, PROF-03, PROF-04
- [ ] `apps/api/src/modules/users/presets.service.spec.ts` — stubs for SRCH-01, SRCH-02
- [ ] Remove `modules/auth/**`, `modules/users/**`, `crypto/**` from coverage excludes in `apps/api/jest.config.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth LinkedIn flow end-to-end | AUTH-01 | Requires browser + LinkedIn credentials | Open app, click "Sign in with LinkedIn", complete OAuth, verify redirect to dashboard with valid JWT |
| OAuth Google flow end-to-end | AUTH-02 | Requires browser + Google credentials | Open app, click "Sign in with Google", complete OAuth, verify redirect to dashboard with valid JWT |
| LinkedIn profile import under 8s | PROF-03 | Requires live LinkedIn account | Trigger import, verify all fields populated in < 8 seconds |
| Session persists across tab closes | AUTH-01 | Browser state | Sign in, close tab, reopen app, verify session still active |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
