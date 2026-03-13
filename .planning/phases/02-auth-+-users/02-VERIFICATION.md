---
phase: 02-auth-+-users
verified: 2026-03-13T13:26:50Z
status: gaps_found
score: 2/5 must-haves verified
re_verification: false
gaps:
  - truth: "User can import their professional profile (via CV upload or LinkedIn API scan)"
    status: failed
    reason: "ProfilesService, ProfilesController, UserProfileSchema, and ProfilesModule do not exist. Only it.todo() test stubs exist for PROF-01 and PROF-02."
    artifacts:
      - path: "apps/api/src/modules/profiles/profiles.service.ts"
        issue: "MISSING — file does not exist"
      - path: "apps/api/src/modules/profiles/profiles.controller.ts"
        issue: "MISSING — file does not exist"
      - path: "apps/api/src/modules/profiles/profiles.module.ts"
        issue: "MISSING — file does not exist"
      - path: "apps/api/src/modules/profiles/schemas/user-profile.schema.ts"
        issue: "MISSING — file does not exist"
    missing:
      - "ProfilesService with importFromLinkedin(), uploadCv(), patchProfile(), checkCompleteness() methods"
      - "UserProfileSchema Mongoose schema mirroring ProfessionalProfileType from packages/core"
      - "ProfilesController with POST /profiles/cv, GET /profiles/me, PATCH /profiles/me endpoints"
      - "ProfilesModule registered in app.module.ts"

  - truth: "User can edit profile fields and save changes"
    status: failed
    reason: "No PATCH /profiles/me endpoint exists. ProfilesService.patchProfile() is only an it.todo() stub. UsersService.updateProfile() for AUTH-04 (name, email, language) is also only an it.todo() stub."
    artifacts:
      - path: "apps/api/src/modules/profiles/profiles.service.ts"
        issue: "MISSING"
      - path: "apps/api/src/modules/users/users.service.ts"
        issue: "STUB — updateProfile() method does not exist; only it.todo() test for AUTH-04"
    missing:
      - "ProfilesService.patchProfile(userId, dto) with $set update and userId filter (NF-08)"
      - "UsersService.updateProfile(userId, dto) for name/email/language preference (AUTH-04)"
      - "PATCH /users/me or PATCH /profiles/me controller endpoint"

  - truth: "User can configure search preferences and save up to 5 named presets"
    status: failed
    reason: "No SearchPresets schema, service methods, or controller routes exist. UsersService.createPreset() and setActivePreset() are only it.todo() stubs. User schema has no presets array."
    artifacts:
      - path: "apps/api/src/modules/users/users.service.ts"
        issue: "STUB — createPreset(), setActivePreset() methods do not exist"
      - path: "apps/api/src/modules/users/schemas/user.schema.ts"
        issue: "STUB — no presets array or activePresetId field in schema"
    missing:
      - "SearchPreset sub-schema or separate collection with all AppConfig fields (keywords, location, modality, platforms, seniority, etc.)"
      - "UsersService.createPreset(userId, dto) with 5-preset limit enforcement"
      - "UsersService.setActivePreset(userId, presetId) updating activePresetId"
      - "GET/POST/PATCH/DELETE /users/me/presets controller routes"
      - "UsersController (does not exist yet)"

  - truth: "All data is persisted per-user in MongoDB"
    status: failed
    reason: "Profile data has no schema or collection. Preset data has no schema or collection. User schema has no presets field or language preference field."
    artifacts:
      - path: "apps/api/src/modules/users/schemas/user.schema.ts"
        issue: "PARTIAL — missing presets[], activePresetId, language preference fields"
      - path: "apps/api/src/modules/profiles/schemas/user-profile.schema.ts"
        issue: "MISSING — no profile MongoDB collection defined"
    missing:
      - "UserProfileSchema in profiles collection with userId foreign key and all ProfessionalProfileType fields"
      - "presets array field on User schema with SearchPreset subdocument type"
      - "language preference field on User schema for AUTH-04"
      - "activePresetId field on User schema for SRCH-02"
---

# Phase 2: Auth + Users Verification Report

**Phase Goal:** Users can authenticate via LinkedIn OAuth or Google OAuth, receive JWT access and refresh tokens, import their professional profile (via CV upload or LinkedIn API scan), edit profile fields, configure search preferences, and save up to 5 named presets — all data persisted per-user in MongoDB.
**Verified:** 2026-03-13T13:26:50Z
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                             | Status      | Evidence                                                                              |
|----|-----------------------------------------------------------------------------------|-------------|---------------------------------------------------------------------------------------|
| 1  | User can authenticate via LinkedIn OAuth or Google OAuth and receive JWT tokens   | VERIFIED  | LinkedInStrategy, GoogleStrategy, AuthController callbacks, AuthService.issueTokens() all exist and are wired; RS256 migration complete |
| 2  | JWT access and refresh token issuance and rotation work correctly                 | VERIFIED  | auth.service.ts implements issueTokens/refreshTokens/revokeToken; 5 passing tests; RS256 in auth.module.ts + jwt.strategy.ts |
| 3  | User can import their professional profile (CV upload or LinkedIn API scan)       | FAILED    | ProfilesService, ProfilesController, UserProfileSchema do not exist — only 7 it.todo() stubs |
| 4  | User can edit profile fields and save; next session uses updated values           | FAILED    | No PATCH endpoint, no patchProfile() or updateProfile() implementation — only it.todo() stubs |
| 5  | User can save up to 5 named search presets and switch between them                | FAILED    | No presets schema, no createPreset/setActivePreset methods, no UsersController — only it.todo() stubs |

**Score:** 2/5 truths verified

---

## Required Artifacts

### Plan 02-01 Artifacts (Wave 0 test scaffolds)

| Artifact                                                              | Expected                                                  | Status      | Details                                                  |
|-----------------------------------------------------------------------|-----------------------------------------------------------|-------------|----------------------------------------------------------|
| `apps/api/jest.config.ts`                                             | auth/users/crypto exclusions removed; 70% threshold kept  | VERIFIED  | All 3 exclusions removed; coverageThreshold at 70%       |
| `apps/api/src/modules/auth/auth.service.test.ts`                      | 3+ it.todo() stubs for AUTH-01, 02, 03                    | VERIFIED  | 5 real passing tests (upgraded in plan 02-02)            |
| `apps/api/src/modules/users/users.service.test.ts`                    | 4 it.todo() stubs for AUTH-04, SRCH-01, SRCH-02           | VERIFIED  | File exists with 4 it.todo() stubs + 1 "is defined" test |
| `apps/api/src/common/crypto/token-cipher.test.ts`                     | 3 passing assertions for encryptToken/decryptToken         | VERIFIED  | 3 real tests exist: round-trip, random IV, malformed throw |
| `apps/api/src/modules/profiles/profiles.service.test.ts`              | 7 it.todo() stubs for PROF-01 through NF-08                | VERIFIED  | File exists with 7 it.todo() stubs                       |

### Plan 02-02 Artifacts (RS256 migration)

| Artifact                                                              | Expected                                                  | Status      | Details                                                  |
|-----------------------------------------------------------------------|-----------------------------------------------------------|-------------|----------------------------------------------------------|
| `apps/api/src/modules/auth/auth.module.ts`                            | RS256 JwtModule.registerAsync using JWT_PRIVATE_KEY       | VERIFIED  | `createPrivateKey(privPem)`, `publicKey: pubPem`, `algorithm: 'RS256'` |
| `apps/api/src/modules/auth/strategies/jwt.strategy.ts`                | algorithms: ['RS256'], JWT_PUBLIC_KEY                     | VERIFIED  | `algorithms: ['RS256']`, `secretOrKey` uses JWT_PUBLIC_KEY |
| `.env.example`                                                        | JWT_PRIVATE_KEY + JWT_PUBLIC_KEY documented               | VERIFIED  | Both vars documented with generation instructions; JWT_SECRET deprecated |

### Missing Artifacts (no plans executed for these)

| Artifact                                                                          | Expected                                        | Status      | Details                                              |
|-----------------------------------------------------------------------------------|-------------------------------------------------|-------------|------------------------------------------------------|
| `apps/api/src/modules/profiles/profiles.service.ts`                               | CV upload, LinkedIn import, patch, completeness | MISSING   | File does not exist                                  |
| `apps/api/src/modules/profiles/profiles.controller.ts`                            | REST endpoints for profile CRUD                 | MISSING   | File does not exist                                  |
| `apps/api/src/modules/profiles/profiles.module.ts`                                | NestJS module wiring                            | MISSING   | File does not exist                                  |
| `apps/api/src/modules/profiles/schemas/user-profile.schema.ts`                    | Mongoose schema mirroring ProfessionalProfileType | MISSING | File does not exist                                  |
| `apps/api/src/modules/users/users.controller.ts`                                  | PATCH /users/me, /users/me/presets CRUD         | MISSING   | File does not exist                                  |

---

## Key Link Verification

### Plan 02-01 Key Links

| From                       | To                        | Via                                             | Status      | Details                                                          |
|----------------------------|---------------------------|-------------------------------------------------|-------------|------------------------------------------------------------------|
| `apps/api/jest.config.ts`  | `collectCoverageFrom`     | Remove `!**/modules/auth/**` etc.               | VERIFIED  | Lines confirmed absent; no auth/users/crypto exclusions present  |

### Plan 02-02 Key Links

| From                        | To                          | Via                                             | Status      | Details                                                          |
|-----------------------------|-----------------------------|-------------------------------------------------|-------------|------------------------------------------------------------------|
| `auth.module.ts`            | `jwt.strategy.ts`           | Both use RS256 algorithm consistently           | VERIFIED  | module: `algorithm: 'RS256'`; strategy: `algorithms: ['RS256']` |
| `.env.example`              | `auth.module.ts`            | JWT_PRIVATE_KEY + JWT_PUBLIC_KEY env vars       | VERIFIED  | Both env vars documented; source files use them exclusively      |

### Missing Key Links (unimplemented phase goal)

| From                        | To                          | Via                                             | Status        | Details                                                          |
|-----------------------------|-----------------------------|-------------------------------------------------|---------------|------------------------------------------------------------------|
| `ProfilesController`        | `ProfilesService`           | POST /profiles/cv, GET /profiles/me             | NOT WIRED   | ProfilesController does not exist                                |
| `ProfilesService`           | `cv-parser` package         | `runCvParser()` call for PDF upload             | NOT WIRED   | ProfilesService does not exist                                   |
| `ProfilesService`           | `UserProfileSchema`         | MongoDB upsert with userId filter               | NOT WIRED   | Both missing                                                     |
| `UsersService`              | `User.presets[]`            | createPreset, setActivePreset methods           | NOT WIRED   | Methods missing; User schema has no presets field                |
| `app.module.ts`             | `ProfilesModule`            | ProfilesModule import registration              | NOT WIRED   | ProfilesModule does not exist                                    |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                         | Status         | Evidence                                                              |
|-------------|-------------|---------------------------------------------------------------------|----------------|-----------------------------------------------------------------------|
| AUTH-01     | 02-01, 02-02 | LinkedIn OAuth login + JWT issued                                  | VERIFIED     | LinkedInStrategy + GoogleStrategy wired; issueTokens() tested         |
| AUTH-02     | 02-01, 02-02 | Google OAuth login + JWT issued                                    | VERIFIED     | GoogleStrategy.validate() upserts user; issueTokens() called          |
| AUTH-03     | 02-01, 02-02 | JWT refresh without re-login; rotation implemented                 | VERIFIED     | refreshTokens() in AuthService; POST /auth/refresh in AuthController  |
| AUTH-04     | 02-01        | User can edit name, email, language preference                     | BLOCKED      | No updateProfile() method in UsersService; only it.todo() stub        |
| PROF-01     | 02-01        | LinkedIn profile import (work exp, edu, skills, languages)         | BLOCKED      | ProfilesService.importFromLinkedin() does not exist; only it.todo()   |
| PROF-02     | 02-01        | PDF CV upload → ProfessionalProfileType                           | BLOCKED      | ProfilesService.uploadCv() does not exist; only it.todo()             |
| PROF-03     | 02-01        | Editable profile form, save changes                                | BLOCKED      | ProfilesService.patchProfile() does not exist; only it.todo()         |
| PROF-04     | 02-01        | Alert for missing critical fields (skills, experience)             | BLOCKED      | ProfilesService.checkCompleteness() does not exist; only it.todo()    |
| SRCH-01     | 02-01        | Search config persists in MongoDB, saveable as named preset        | BLOCKED      | UsersService.createPreset() does not exist; only it.todo()            |
| SRCH-02     | 02-01        | Up to 5 named presets, switch active preset                       | BLOCKED      | createPreset() and setActivePreset() do not exist; only it.todo()s    |
| NF-03       | 02-01        | LinkedIn profile import completes in < 8 seconds                  | BLOCKED      | importFromLinkedin() does not exist                                    |
| NF-08       | 02-01        | Row-level security: all queries include userId filter              | PARTIAL      | UsersService queries use `{ _id: userId }` filter correctly; ProfilesService does not exist to verify |

**Orphaned requirements check:** REQUIREMENTS.md maps NF-08 to Phase 2. Plan 02-01 claims it in `requirements` field. Implementation only exists in UsersService (existing Phase 1 methods). The profiles layer — which is where NF-08 is most critical — has no implementation.

---

## Anti-Patterns Found

| File                                                              | Line | Pattern                                              | Severity | Impact                                                 |
|-------------------------------------------------------------------|------|------------------------------------------------------|----------|--------------------------------------------------------|
| `apps/api/src/modules/users/users.service.test.ts`                | 38–47 | 4 `it.todo()` stubs — AUTH-04, SRCH-01, SRCH-02 not implemented | Blocker | These requirements are marked "Complete" in REQUIREMENTS.md but have no implementation code |
| `apps/api/src/modules/profiles/profiles.service.test.ts`          | 7–13 | 7 `it.todo()` stubs — PROF-01 through NF-08 not implemented | Blocker | All profile requirements have only stubs; the service they test does not exist |
| `apps/api/src/common/guards/jwt-auth.guard.ts`                    | 12   | Comment still references "HS256 with JWT_SECRET in Phase 1" | Info   | Stale comment — should reference RS256 |

---

## Human Verification Required

None — all failures are programmatically verifiable. The gaps are structural: missing files, missing methods, missing schema fields.

---

## Gaps Summary

Phase 2 is **partially complete**. The two executed plans (02-01 and 02-02) successfully delivered:

1. Wave 0 TDD scaffolds (4 test files, jest.config.ts updated, token-cipher tests passing)
2. RS256 JWT migration (auth.module.ts + jwt.strategy.ts + auth.service tests)

The OAuth flows (AUTH-01, AUTH-02, AUTH-03) are fully implemented and wired from Phase 1 stubs. RS256 JWT is correctly configured.

However, **9 out of 12 requirements remain unimplemented** because the planned follow-on plans were never executed:

- **PROF-01, PROF-02, PROF-03, PROF-04** — ProfilesService, ProfilesController, UserProfileSchema, and the profiles MongoDB collection do not exist. The entire profiles module is missing. The `apps/api/src/modules/profiles/` directory contains only a test stub file.
- **AUTH-04** — UsersService.updateProfile() does not exist. The User schema has no language preference field.
- **SRCH-01, SRCH-02** — UsersService.createPreset() and setActivePreset() do not exist. The User schema has no presets array or activePresetId field. No UsersController exists.
- **NF-03** — LinkedIn import performance cannot be validated because importFromLinkedin() does not exist.

REQUIREMENTS.md marks AUTH-01 through SRCH-02 and NF-03, NF-08 as "Complete" for Phase 2, but this is incorrect — only AUTH-01, AUTH-02, AUTH-03 are actually implemented. The traceability table was updated prematurely.

The structured gaps in the YAML frontmatter target the three missing capability clusters (profile module, user profile editing, search presets) for `/gsd:plan-phase --gaps`.

---

_Verified: 2026-03-13T13:26:50Z_
_Verifier: Claude (gsd-verifier)_
