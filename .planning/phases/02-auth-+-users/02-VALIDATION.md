---
phase: 2
slug: auth-users
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (NestJS) + Vitest (React/web) |
| **Config file** | `apps/api/jest.config.ts` / `apps/web/vitest.config.ts` |
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
| 2-01-01 | 01 | 1 | AUTH-01 | unit | `cd apps/api && npm test -- --testPathPattern="auth"` | inline TDD | pending |
| 2-01-02 | 01 | 1 | AUTH-02 | unit | `cd apps/api && npm test -- --testPathPattern="auth"` | inline TDD | pending |
| 2-01-03 | 01 | 1 | AUTH-03 | unit | `cd apps/api && npm test -- --testPathPattern="auth"` | inline TDD | pending |
| 2-01-04 | 01 | 1 | AUTH-04 | unit | `cd apps/api && npm test -- --testPathPattern="auth"` | inline TDD | pending |
| 2-02-01 | 02 | 2 | PROF-01 | integration | `cd apps/api && npm test -- --testPathPattern="users"` | inline TDD | pending |
| 2-02-02 | 02 | 2 | PROF-02 | integration | `cd apps/api && npm test -- --testPathPattern="cv"` | inline TDD | pending |
| 2-02-03 | 02 | 2 | PROF-03 | integration | `cd apps/api && npm test -- --testPathPattern="profile"` | inline TDD | pending |
| 2-02-04 | 02 | 2 | PROF-04 | integration | `cd apps/api && npm test -- --testPathPattern="users"` | inline TDD | pending |
| 2-03-01 | 03 | 2 | SRCH-01 | unit | `cd apps/api && npm test -- --testPathPattern="presets"` | inline TDD | pending |
| 2-03-02 | 03 | 2 | SRCH-02 | unit | `cd apps/api && npm test -- --testPathPattern="presets"` | inline TDD | pending |
| 2-03-03 | 03 | 3 | NF-03 | performance | `cd apps/api && npm test -- --testPathPattern="cv"` | inline TDD | pending |
| 2-03-04 | 03 | 2 | NF-08 | security | `cd apps/api && npm test -- --testPathPattern="users"` | inline TDD | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Tests are created **inline** within each plan's TDD tasks (not in a separate Wave 0 plan). Each plan with `tdd="true"` tasks writes tests before implementation following RED-GREEN-REFACTOR. The test files are:

- [x] `apps/api/src/modules/auth/auth.service.test.ts` — covers AUTH-01, AUTH-02, AUTH-03 (Plan 02, Task 1)
- [x] `apps/api/src/modules/auth/auth.controller.test.ts` — covers AUTH-03 cookie handling (Plan 02, Task 1)
- [x] `apps/api/src/common/crypto/token-cipher.test.ts` — covers AES-256-GCM round-trip (Plan 02, Task 1)
- [x] `apps/api/src/modules/users/users.service.test.ts` — covers AUTH-04, PROF-01, PROF-02, PROF-03, PROF-04, SRCH-01, SRCH-02, NF-08 (Plan 03, Task 1)
- [x] `apps/api/src/modules/users/users.controller.test.ts` — covers NF-08 userId from JWT (Plan 03, Task 2)
- [x] `apps/web/src/store/auth.store.test.ts` — covers auth store security contract (Plan 04, Task 1)
- [x] `apps/web/src/features/auth/AuthCallbackPage.test.tsx` — covers code-exchange flow (Plan 04, Task 2)
- [x] `apps/web/src/features/profile/ProfileSetupPage.test.tsx` — covers setup page validation (Plan 05, Task 1)
- [x] Remove `modules/auth/**`, `modules/users/**`, `crypto/**` from coverage excludes in `apps/api/jest.config.ts` (Plan 01, Task 2)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth LinkedIn flow end-to-end | AUTH-01 | Requires browser + LinkedIn credentials | Open app, click "Sign in with LinkedIn", complete OAuth, verify redirect to dashboard with valid JWT |
| OAuth Google flow end-to-end | AUTH-02 | Requires browser + Google credentials | Open app, click "Sign in with Google", complete OAuth, verify redirect to dashboard with valid JWT |
| CV parse under 8s with live Claude API | NF-03 | Requires live Claude API key | Upload PDF, verify profile fields populated in < 8 seconds |
| Session persists across tab closes | AUTH-01 | Browser state | Sign in, close tab, reopen app, verify session still active |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or inline TDD
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covered by inline TDD in each plan
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
