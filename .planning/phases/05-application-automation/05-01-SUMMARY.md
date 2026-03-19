---
phase: 05-application-automation
plan: "01"
subsystem: types-and-schemas
tags: [types, mongoose, email-detection, tdd]
dependency_graph:
  requires: []
  provides:
    - ApplicationStatus (full lifecycle type)
    - ApplicationDocumentType interface
    - EmailDraftAdapter interface
    - SmtpConfigType interface
    - EmailDetectionMethod type
    - VacancyType extended with recipientEmail + emailDetectionMethod
    - Application Mongoose schema with unique constraint
    - detectRecipientEmail utility
  affects:
    - apps/api/src/modules/applications/ (consumes ApplicationStatus)
    - apps/api/src/modules/vacancies/ (extended schema + email detection wired)
    - packages/core (new barrel exports)
tech_stack:
  added: []
  patterns:
    - Adapter pattern for EmailDraftAdapter (mirrors ScoringAdapter)
    - Email detection at persist time (insertMany enrichment)
    - Barrel re-export with LegacyApplicationStatus rename to avoid collision
key_files:
  created:
    - packages/core/src/types/application.types.ts
    - packages/core/src/types/email-draft-adapter.types.ts
    - apps/api/src/modules/applications/schemas/application.schema.ts
    - apps/api/src/modules/vacancies/email-detection.util.ts
    - apps/api/src/modules/vacancies/email-detection.util.test.ts
  modified:
    - packages/core/src/types/vacancy.types.ts
    - packages/core/src/types/user.types.ts
    - packages/core/src/types/job.types.ts
    - packages/core/src/types/index.ts
    - apps/api/src/modules/vacancies/schemas/vacancy.schema.ts
    - apps/api/src/modules/vacancies/vacancies.service.ts
decisions:
  - "LegacyApplicationStatus rename: job.types.ts ApplicationStatus renamed to LegacyApplicationStatus with local alias for backward compat — avoids barrel export collision with Phase 5 ApplicationStatus"
  - "Email detection at persist time: detectRecipientEmail wired into VacanciesService.insertMany with idempotent guard (only runs when recipientEmail is undefined)"
  - "apply_options as cast via Record: apply_options is not a Mongoose schema field (not persisted) so accessed via (v as Record<string, unknown>).apply_options cast"
metrics:
  duration_minutes: 9
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_changed: 11
---

# Phase 5 Plan 01: Type Contracts, Schemas, and Email Detection Summary

**One-liner:** Phase 5 type foundation — ApplicationStatus lifecycle, EmailDraftAdapter interface, SmtpConfigType, Vacancy email detection fields, Application schema with unique constraint, and detectRecipientEmail utility wired into vacancy persist path.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Define Phase 5 type contracts and extend existing types | 4caaf8b | application.types.ts, email-draft-adapter.types.ts, vacancy.types.ts, user.types.ts, job.types.ts, index.ts |
| 2 | Create Application schema, extend Vacancy schema, build email detection utility, and wire detection into vacancy persistence | 4ff6fc3 | application.schema.ts, vacancy.schema.ts, email-detection.util.ts, email-detection.util.test.ts, vacancies.service.ts |

## Verification Results

- `npx tsc --noEmit` exits 0 — zero type errors
- `npx jest --testPathPattern="email-detection"` — 11/11 tests pass
- ApplicationStatus lifecycle confirmed: draft | pending_review | sent | tracking_active | interview_scheduled | offer_received | rejected
- Vacancy schema has recipientEmail and emailDetectionMethod fields
- Application schema has userId+vacancyId unique index
- detectRecipientEmail is called in VacanciesService.insertMany

## Deviations from Plan

None — plan executed exactly as written.

## Key Decisions Made

**1. LegacyApplicationStatus rename**
- `job.types.ts` exported `ApplicationStatus` for Phase 1-4 CLI use
- `application.types.ts` exports a new `ApplicationStatus` for Phase 5 SaaS lifecycle
- Resolution: renamed the Phase 1-4 type to `LegacyApplicationStatus` with a local `type ApplicationStatus = LegacyApplicationStatus` alias for backward compat within the file
- Barrel export in index.ts now has only one `ApplicationStatus` (the Phase 5 one)

**2. Email detection idempotency guard**
- `insertMany` only runs detection when `v.recipientEmail === undefined`
- This makes re-insertion attempts safe (won't overwrite manually set emails)

**3. apply_options field access via Record cast**
- `apply_options` comes from JSearch raw response and is passed in `Partial<Vacancy>`
- It is NOT a Mongoose schema field (not persisted to DB)
- Accessed via `(v as Record<string, unknown>).apply_options` cast — avoids adding an unrelated field to the Vacancy schema

## Self-Check: PASSED

Files verified:
- FOUND: packages/core/src/types/application.types.ts
- FOUND: packages/core/src/types/email-draft-adapter.types.ts
- FOUND: apps/api/src/modules/applications/schemas/application.schema.ts
- FOUND: apps/api/src/modules/vacancies/email-detection.util.ts
- FOUND: apps/api/src/modules/vacancies/email-detection.util.test.ts

Commits verified:
- FOUND: 4caaf8b (feat(05-01): define Phase 5 type contracts)
- FOUND: 4ff6fc3 (feat(05-01): create application schema + email detection)
