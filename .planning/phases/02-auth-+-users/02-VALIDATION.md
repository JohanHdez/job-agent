---
phase: 2
slug: auth-users
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 + ts-jest + @nestjs/testing |
| **Config file** | `apps/api/jest.config.ts` |
| **Quick run command** | `cd apps/api && npm test` |
| **Full suite command** | `cd apps/api && npm run test:cov` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npm test`
- **After every plan wave:** Run `cd apps/api && npm run test:cov`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | AUTH-01, AUTH-02, AUTH-03 | unit | `npm test -- --testPathPattern=auth.service` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 0 | AUTH-04, SRCH-01, SRCH-02 | unit | `npm test -- --testPathPattern=users.service` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 0 | PROF-01, PROF-02, PROF-03, PROF-04, NF-03 | unit | `npm test -- --testPathPattern=profiles.service` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | AUTH-01, AUTH-02 | unit | `npm test -- --testPathPattern=auth.service` | ✅ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | AUTH-03 | unit | `npm test -- --testPathPattern=jwt-auth.guard` | ✅ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | AUTH-04 | unit | `npm test -- --testPathPattern=users.service` | ✅ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | PROF-01, NF-03 | unit | `npm test -- --testPathPattern=profiles.service` | ✅ W0 | ⬜ pending |
| 2-03-02 | 03 | 2 | PROF-02 | unit (mock cv-parser) | `npm test -- --testPathPattern=profiles.service` | ✅ W0 | ⬜ pending |
| 2-03-03 | 03 | 2 | PROF-03 | unit | `npm test -- --testPathPattern=profiles.service` | ✅ W0 | ⬜ pending |
| 2-03-04 | 03 | 2 | PROF-04 | unit | `npm test -- --testPathPattern=profiles.service` | ✅ W0 | ⬜ pending |
| 2-04-01 | 04 | 3 | SRCH-01, SRCH-02 | unit | `npm test -- --testPathPattern=users.service` | ✅ W0 | ⬜ pending |
| 2-04-02 | 04 | 3 | NF-08 | unit | `npm test -- --testPathPattern=profiles.service` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/auth/auth.service.test.ts` — stubs for AUTH-01, AUTH-02, AUTH-03
- [ ] `apps/api/src/modules/users/users.service.test.ts` — stubs for AUTH-04, SRCH-01, SRCH-02
- [ ] `apps/api/src/modules/profiles/profiles.service.test.ts` — stubs for PROF-01 through PROF-04, NF-03, NF-08
- [ ] `apps/api/src/common/crypto/token-cipher.test.ts` — unit tests for encrypt/decrypt
- [ ] `apps/api/jest.config.ts` update — remove `!**/modules/auth/**` and `!**/modules/users/**` exclusions from `collectCoverageFrom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LinkedIn OAuth flow completes in browser | AUTH-01 | Requires real LinkedIn OAuth redirect | Open browser → click "Sign in with LinkedIn" → complete OAuth → verify JWT cookie + dashboard redirect |
| Google OAuth flow completes in browser | AUTH-02 | Requires real Google OAuth redirect | Open browser → click "Sign in with Google" → complete OAuth → verify JWT cookie + dashboard redirect |
| Session persists after browser tab close | AUTH-01, AUTH-02 | Browser session behavior | After OAuth login, close tab → reopen → verify user still logged in via valid cookie |
| LinkedIn import partial summary UI | PROF-01 | Requires real LinkedIn account with non-partner app | After LinkedIn login, trigger import → verify partial summary shows "Imported: name, email. Missing: skills, experience, education" |
| Incomplete profile alert on login | PROF-04 | Requires real session + incomplete profile | Log in with incomplete profile → verify alert shows missing field list → dismiss → verify reappears on next login |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
