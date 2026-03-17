---
phase: 02-auth-+-users
plan: "01"
subsystem: core-types, api-infrastructure
tags: [types, redis, mongoose, dto, jest]
dependency_graph:
  requires: []
  provides:
    - SearchPresetType exported from @job-agent/core
    - REDIS_CLIENT injectable globally via RedisModule
    - Extended User schema with profile + presets + preferences
    - Validated DTOs for users/auth endpoints
    - Jest coverage includes auth/users/crypto modules
  affects:
    - packages/core/src/types/index.ts (new export)
    - apps/api/src/app.module.ts (RedisModule added)
    - apps/api/src/modules/users/schemas/user.schema.ts (5 new fields)
tech_stack:
  added:
    - ioredis (Redis client, already in package.json)
  patterns:
    - NestJS @Global() module for infrastructure providers
    - Mongoose Schema.Types.Mixed for flexible subdocuments
    - class-validator nested DTOs with @ValidateNested + @Type
key_files:
  created:
    - packages/core/src/types/user.types.ts
    - apps/api/src/common/redis/redis.provider.ts
    - apps/api/src/common/redis/redis.module.ts
    - apps/api/src/modules/users/dto/update-user.dto.ts
    - apps/api/src/modules/users/dto/update-profile.dto.ts
    - apps/api/src/modules/users/dto/create-preset.dto.ts
    - apps/api/src/modules/users/dto/update-preset.dto.ts
    - apps/api/src/modules/auth/dto/exchange-code.dto.ts
  modified:
    - packages/core/src/types/index.ts
    - apps/api/src/modules/users/schemas/user.schema.ts
    - apps/api/src/app.module.ts
    - apps/api/jest.config.ts
decisions:
  - RedisModule is @Global() and imported in AppModule — available everywhere without explicit per-module import
  - User schema uses Schema.Types.Mixed (type: Object) for profile/searchPresets — avoids nested schema class, relies on TypeScript for type safety
  - Jest auth/users/crypto exclusions removed — Phase 2 modules now included in coverage tracking
metrics:
  duration: "3 minutes"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_created: 8
  files_modified: 4
---

# Phase 2 Plan 01: Foundation Types, Redis, Schema, and DTOs Summary

**One-liner:** SearchPresetType + global Redis DI + extended User Mongoose schema with profile/presets/preferences fields + 5 class-validator DTOs for Phase 2 endpoints.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Define SearchPresetType, Redis provider, extend User schema | 0ddc14c | user.types.ts, redis.provider.ts, redis.module.ts, user.schema.ts, app.module.ts, index.ts |
| 2 | Create DTOs + update Jest coverage config | 0dd6459 | 5 DTO files, jest.config.ts |

## What Was Built

### SearchPresetType (packages/core)

New interface exported from `@job-agent/core` barrel. Contains all fields needed for a named search configuration: keywords, location, modality, platforms, seniority, languages, datePosted, minScoreToApply, maxApplicationsPerSession, excludedCompanies.

### Redis Infrastructure (apps/api)

`RedisModule` is decorated `@Global()` and imported once in `AppModule`. Provides the `REDIS_CLIENT` injection token (ioredis instance) to all NestJS modules. Reads from `REDIS_URL` env var, defaults to `redis://localhost:6379`.

### Extended User Schema

Five new fields added to the Mongoose User schema:
- `profile: ProfessionalProfile | null` — parsed CV subdocument
- `searchPresets: SearchPresetType[]` — named search configurations
- `activePresetId: string | null` — currently selected preset
- `languagePreference: string` — 'en' | 'es' platform language (AUTH-04)
- `contactEmail?: string` — editable contact email separate from OAuth email (AUTH-04)

### DTOs

| File | Class | Purpose |
|------|-------|---------|
| update-user.dto.ts | UpdateUserDto | PATCH /users/me — name, contactEmail, languagePreference |
| update-profile.dto.ts | UpdateProfileDto | PATCH /users/profile — full ProfessionalProfile fields with nested validation |
| create-preset.dto.ts | CreatePresetDto | POST /users/presets — required fields with bounds (SRCH-01) |
| update-preset.dto.ts | UpdatePresetDto | PATCH /users/presets/:id — all fields optional |
| exchange-code.dto.ts | ExchangeCodeDto | POST /auth/exchange — one-time code UUID validation |

### Jest Coverage Config

Removed exclusions for `auth`, `users`, and `crypto` modules. Phase 2 implementation will now be tracked by the coverage reporter.

## Verification Results

- `tsc --noEmit -p packages/core/tsconfig.json` — PASS (zero errors)
- `tsc --noEmit -p apps/api/tsconfig.json` — PASS (zero errors)
- SearchPresetType present in `packages/core/src/types/user.types.ts`
- REDIS_CLIENT exported from `apps/api/src/common/redis/redis.provider.ts`
- User schema has all 5 new fields
- Jest config has no auth/users/crypto exclusions

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] packages/core/src/types/user.types.ts exists and exports SearchPresetType
- [x] packages/core/src/types/index.ts re-exports user.types.js
- [x] apps/api/src/common/redis/redis.provider.ts exists with REDIS_CLIENT
- [x] apps/api/src/common/redis/redis.module.ts exists with @Global()
- [x] apps/api/src/modules/users/schemas/user.schema.ts has all 5 new fields
- [x] All 5 DTOs created with class-validator decorators
- [x] apps/api/jest.config.ts has no auth/users/crypto exclusions
- [x] Task 1 commit: 0ddc14c
- [x] Task 2 commit: 0dd6459
