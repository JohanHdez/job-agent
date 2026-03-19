---
phase: 05-application-automation
plan: "03"
subsystem: api
tags: [nestjs, mongodb, mongoose, aes-256-gcm, smtp, encryption, jest]

# Dependency graph
requires:
  - phase: 05-application-automation
    provides: 05-01 token-cipher encryption utilities (encryptToken/decryptToken)
  - phase: 02-auth-+-users
    provides: UsersService, UsersController, User schema, JWT auth guard

provides:
  - User schema smtpConfig sub-document with AES-256-GCM encrypted password
  - PUT /users/smtp-config endpoint (saves SMTP credentials, encrypts password)
  - GET /users/smtp-config endpoint (returns config with masked password)
  - getSmtpConfigRaw internal method for EmailSenderService
  - UpdateSmtpConfigDto with class-validator decorators
  - Google OAuth fromEmail pre-fill

affects: [05-04, 05-05, EmailSenderService, applications pipeline]

# Tech tracking
tech-stack:
  added: [class-validator decorators on UpdateSmtpConfigDto]
  patterns: [AES-256-GCM encrypted sub-document, masked password in GET responses, internal vs public API separation via getSmtpConfigRaw]

key-files:
  created:
    - apps/api/src/modules/users/dto/update-smtp-config.dto.ts
  modified:
    - apps/api/src/modules/users/schemas/user.schema.ts
    - apps/api/src/modules/users/users.service.ts
    - apps/api/src/modules/users/users.controller.ts
    - apps/api/src/modules/users/users.service.test.ts

key-decisions:
  - "smtpConfig Mongoose sub-schema uses explicit typed fields (host: String, port: Number, etc.) rather than type: Object — stricter DB-level validation"
  - "getSmtpConfigRaw exposed as separate service method from getSmtpConfig — public API always returns masked password, internal callers get encrypted raw value"
  - "Google OAuth fromEmail pre-fill: if googleId present and fromEmail is empty, falls back to user.email — avoids requiring duplicate entry for Gmail users"

patterns-established:
  - "Password masking pattern: public GET endpoint returns '********', raw encrypted value only via internal service method"
  - "Sub-document encryption pattern: same encryptToken/decryptToken used for OAuth tokens applied to SMTP password"

requirements-completed: [APPLY-02, NF-04]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 5 Plan 03: SMTP Configuration Management Summary

**User schema extended with AES-256-GCM encrypted smtpConfig sub-document, PUT/GET /users/smtp-config endpoints, and Google OAuth fromEmail pre-fill**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T23:26:55Z
- **Completed:** 2026-03-18T23:33:18Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 5

## Accomplishments
- Replaced `type: Object` smtpConfig field with explicit Mongoose sub-schema (host, port, secure, user, password, fromName, fromEmail — all typed and required)
- Implemented `saveSmtpConfig` method: encrypts password via encryptToken before storage, Google OAuth fromEmail pre-fill when field is empty
- Implemented `getSmtpConfig` method: returns all config fields with password always masked as '********'
- Implemented `getSmtpConfigRaw` method: internal-only, returns encrypted password for EmailSenderService use
- Added PUT and GET `/users/smtp-config` controller endpoints with JWT auth guard
- Created `UpdateSmtpConfigDto` with class-validator decorators
- Added 9 new tests covering all behaviors; all 37 service tests pass

## Task Commits

Each task was committed atomically following TDD:

1. **RED: Failing SMTP tests** - `b0993d3` (test)
2. **GREEN: SMTP implementation** - `277f01e` (feat)

_TDD task: RED commit first (tests fail), then GREEN commit (implementation passes all tests)_

## Files Created/Modified
- `apps/api/src/modules/users/dto/update-smtp-config.dto.ts` - DTO with class-validator for PUT /users/smtp-config
- `apps/api/src/modules/users/schemas/user.schema.ts` - smtpConfig changed from `type: Object` to explicit sub-schema
- `apps/api/src/modules/users/users.service.ts` - saveSmtpConfig, getSmtpConfig, getSmtpConfigRaw methods added
- `apps/api/src/modules/users/users.controller.ts` - PUT/GET smtp-config endpoints added
- `apps/api/src/modules/users/users.service.test.ts` - 9 new SMTP tests added

## Decisions Made
- `smtpConfig` sub-schema uses explicit typed fields rather than `type: Object` — provides stricter DB-level validation (Rule 2: missing critical functionality)
- `getSmtpConfigRaw` is a separate internal method from `getSmtpConfig` — the public API endpoint always returns a masked password, while EmailSenderService accesses the encrypted value directly without going through HTTP
- Google OAuth pre-fill: when a user has a `googleId` and provides an empty `fromEmail`, the system automatically uses `user.email` (their Google account email) — avoids redundant input for Gmail SMTP users

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Upgraded smtpConfig from `type: Object` to explicit sub-schema**
- **Found during:** Task 1 (schema review)
- **Issue:** The existing schema used `@Prop({ type: Object, default: null })` which provides no DB-level validation. The plan's acceptance criteria explicitly required `host: { type: String, required: true }` style sub-schema fields.
- **Fix:** Replaced with detailed `@Prop({ type: { host: { type: String, required: true }, ... } })` sub-schema definition
- **Files modified:** apps/api/src/modules/users/schemas/user.schema.ts
- **Verification:** `npx tsc --noEmit` exits 0, acceptance criteria grep passes
- **Committed in:** 277f01e (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required for acceptance criteria compliance. No scope creep.

## Issues Encountered
None — implementation matched plan specification exactly after the sub-schema fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SMTP config storage ready for EmailSenderService to call `getSmtpConfigRaw(userId)` in Plan 05-04/05-05
- `UsersModule` already exports `UsersService` — ApplicationsModule can inject it without re-importing
- PUT /users/smtp-config endpoint ready for frontend SMTP settings form

---
*Phase: 05-application-automation*
*Completed: 2026-03-18*
