---
phase: 02-auth-+-users
plan: "04"
subsystem: profiles
tags: [profiles, mongodb, cv-parser, linkedin-import, nestjs, tdd]
dependency_graph:
  requires: ["02-02"]
  provides: [ProfilesModule, UserProfileSchema, ProfilesService, ProfilesController]
  affects: [app.module.ts, jest.config.ts]
tech_stack:
  added: []
  patterns:
    - UserProfileSchema with Mongoose @Schema decorator + unique index on userId
    - ProfilesService: importFromLinkedin with graceful 403 degradation
    - FileInterceptor with memoryStorage for in-memory PDF handling
    - jest.config.ts moduleNameMapper extended for @job-agent/core and @job-agent/cv-parser
key_files:
  created:
    - apps/api/src/modules/profiles/schemas/user-profile.schema.ts
    - apps/api/src/modules/profiles/profiles.service.ts
    - apps/api/src/modules/profiles/dto/patch-profile.dto.ts
    - apps/api/src/modules/profiles/profiles.module.ts
    - apps/api/src/modules/profiles/profiles.controller.ts
  modified:
    - apps/api/src/modules/profiles/profiles.service.test.ts
    - apps/api/src/app.module.ts
    - apps/api/jest.config.ts
decisions:
  - "UsersService not injected in ProfilesService — controller fetches user to extract encryptedToken before calling importFromLinkedin; keeps service pure and testable"
  - "userId unique index defined only at schema level via UserProfileSchema.index({ userId:1 }, { unique:true }) — @Prop({ index:true }) removed to avoid Mongoose duplicate index warning"
  - "@job-agent/core and @job-agent/cv-parser added to jest.config.ts moduleNameMapper pointing to built dist — workspace packages not in tsconfig paths cannot be resolved by ts-jest without this mapping"
metrics:
  duration_minutes: 45
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_created: 5
  files_modified: 3
---

# Phase 2 Plan 04: ProfilesModule Summary

**One-liner:** NestJS ProfilesModule with UserProfileSchema, ProfilesService (CV upload + LinkedIn import with graceful 403), ProfilesController (4 REST endpoints), and 9 passing Jest tests replacing all it.todo() stubs.

## What Was Built

### UserProfileSchema (`schemas/user-profile.schema.ts`)
Mongoose schema mirroring `ProfessionalProfile` from `@job-agent/core`. Keyed by `userId` string with a schema-level unique index to prevent duplicate profile documents on concurrent upserts.

### PatchProfileDto (`dto/patch-profile.dto.ts`)
All `ProfessionalProfile` fields as optional with `class-validator` decorators. Typed arrays use `Language[]`, `WorkExperience[]`, `Education[]` from `@job-agent/core` — no `any`.

### ProfilesService (`profiles.service.ts`)
Six public methods:
- `importFromLinkedin(userId, encryptedToken)` — OIDC userinfo + v2/me headline; 403 on v2/me → push to `missing[]`, never throw
- `uploadCv(userId, buffer)` — writes tmp file, calls `runCvParser`, upserts, cleans up in `finally`
- `patchProfile(userId, dto)` — `findOneAndUpdate` with `{ userId }` filter; throws `NotFoundException` if no profile
- `getProfile(userId)` — `findOne({ userId })`, returns null if not found
- `checkCompleteness(profile)` — synchronous, checks `skills`, `experience`, `yearsOfExperience`
- Private `upsertProfile(userId, partial)` — `{ upsert: true, new: true }` helper used by import and CV upload

### ProfilesController (`profiles.controller.ts`)
Four routes, all JWT-protected via global `APP_GUARD`:
- `GET /profiles/me` — returns profile or throws 404
- `PATCH /profiles/me` — ValidationPipe with whitelist; returns 200 + updated doc
- `POST /profiles/me/cv` — FileInterceptor memoryStorage, PDF-only, 10 MB limit; returns 201
- `POST /profiles/me/import-linkedin` — fetches user for encrypted token; returns `{ profile, imported, missing }`

### ProfilesModule (`profiles.module.ts`)
Wires `MongooseModule.forFeature([UserProfile])`, `UsersModule` import, `ProfilesService` provider, `ProfilesController` controller.

### AppModule update
`ProfilesModule` added to `AppModule.imports` array after `AuthModule`.

## Tests

9 passing tests in `profiles.service.test.ts` (all 7 original `it.todo()` stubs replaced, plus 2 additional cases):

| Test | Requirement | Result |
|------|-------------|--------|
| importFromLinkedin: name+email+headline from OIDC+v2/me | PROF-01 | PASS |
| importFromLinkedin: 403 on v2/me → missing includes headline | PROF-01 | PASS |
| uploadCv: calls runCvParser + upserts with { userId } | PROF-02 | PASS |
| patchProfile: { userId } as first arg + $set contains dto | PROF-03 | PASS |
| patchProfile: throws NotFoundException when profile absent | PROF-03 | PASS |
| checkCompleteness: returns ['skills', 'work experience'] when empty | PROF-04 | PASS |
| checkCompleteness: returns [] when all critical fields present | PROF-04 | PASS |
| importFromLinkedin resolves in < 8000ms with mocked HTTP | NF-03 | PASS |
| every DB method uses { userId } as primary filter | NF-08 | PASS |

Full suite: 50/50 passing. Build: `nest build` exits 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jest.config.ts missing moduleNameMapper for workspace packages**
- **Found during:** Task 1 (TDD RED phase — test suite failed to run)
- **Issue:** `@job-agent/cv-parser` and `@job-agent/core` could not be resolved by Jest. The tsconfig paths only map `@job-agent/logger`; Jest's ts-jest cannot find workspace packages via node_modules symlinks without explicit `moduleNameMapper` entries.
- **Fix:** Added `'^@job-agent/core$'` and `'^@job-agent/cv-parser$'` to `moduleNameMapper` in `jest.config.ts`, pointing to their built `dist/index.js`.
- **Files modified:** `apps/api/jest.config.ts`
- **Commit:** f473633

**2. [Rule 1 - Bug] Duplicate Mongoose index on userId**
- **Found during:** Task 1 — Mongoose emitted "Duplicate schema index" warning at test runtime
- **Issue:** `@Prop({ index: true, unique: true })` combined with `UserProfileSchema.index({ userId: 1 }, { unique: true })` created two identical index definitions
- **Fix:** Removed `index: true` and `unique: true` from `@Prop` decorator; the schema-level `index()` call is the single source of truth
- **Files modified:** `apps/api/src/modules/profiles/schemas/user-profile.schema.ts`
- **Commit:** f473633

**3. [Rule 2 - Design] UsersService not injected in ProfilesService**
- **Found during:** Task 1 — `noUnusedParameters` TypeScript strict check caused compile failure
- **Issue:** Plan spec said to inject `UsersService` in `ProfilesService` constructor, but the actual design has the controller call `usersService.findById` to get the encrypted token and pass it to `importFromLinkedin`. Injecting it in the service would be unused.
- **Fix:** Removed `UsersService` from `ProfilesService` constructor; controller injects it directly.
- **Files modified:** `apps/api/src/modules/profiles/profiles.service.ts`
- **Commit:** f473633

### Deferred Items

- **Coverage gate (`test:cov`) failing at ~45% statements** — pre-existing issue caused by `users.controller.ts` and `users.service.ts` having near-zero test coverage (created in Plan 02-03 without sufficient tests). This plan's new files achieve 90%+ on `profiles.service.ts` and 100% on `user-profile.schema.ts`. The gate failure pre-dates this plan and is logged for Plan 02-05 or a dedicated coverage sprint.

## Self-Check Verification
