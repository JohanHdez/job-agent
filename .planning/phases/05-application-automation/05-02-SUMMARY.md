---
phase: 05-application-automation
plan: "02"
subsystem: applications
tags: [nestjs, mongodb, email, claude-api, smtp, nodemailer, di-pattern]
dependency_graph:
  requires:
    - 05-01 (Application schema, ApplicationStatus types, email-draft-adapter types)
    - 04-01 (VacanciesModule, VacanciesService with MongooseModule exports)
    - 02-01 (UsersModule, UsersService, JWT auth guard pattern)
  provides:
    - ApplicationsModule (NestJS module registered in AppModule)
    - POST /applications — create draft with Claude email generation
    - POST /applications/:id/send — SMTP dispatch via nodemailer
    - GET /applications — paginated list with filters
    - GET /applications/:id — full detail with vacancy join
    - PATCH /applications/:id/status — manual tracking update
    - PATCH /applications/:id/draft — edit before send
    - GET /applications/export/csv — CSV file download
    - GET /applications/pending-count — badge count
    - GET /vacancies/session/:sessionId?includeApplication=true — vacancy+applicationStatus join
  affects:
    - VacanciesService (added Application model injection for status join)
    - VacanciesModule (added Application schema to MongooseModule.forFeature)
    - User schema (added smtpConfig: SmtpConfigType | null field)
    - vacancies.service.test.ts (added Application model mock to test providers)
tech_stack:
  added:
    - nodemailer (SMTP send)
    - "@types/nodemailer"
  patterns:
    - NestJS custom injection token (EMAIL_DRAFT_ADAPTER_TOKEN) for swappable adapter
    - Factory provider pattern (useFactory) for adapter DI wiring
    - Adapter pattern — EmailDraftAdapter interface implemented by ClaudeEmailDraftAdapter
    - exactOptionalPropertyTypes-safe filter construction in controller
key_files:
  created:
    - apps/api/src/workers/adapters/claude-email-draft.adapter.ts
    - apps/api/src/workers/adapters/claude-email-draft.adapter.test.ts
    - apps/api/src/modules/applications/email-sender.service.ts
    - apps/api/src/modules/applications/email-sender.service.test.ts
    - apps/api/src/modules/applications/applications.module.ts
    - apps/api/src/modules/applications/applications.service.ts
    - apps/api/src/modules/applications/applications.controller.ts
    - apps/api/src/modules/applications/applications.service.test.ts
    - apps/api/src/modules/applications/dto/create-application.dto.ts
    - apps/api/src/modules/applications/dto/update-application-status.dto.ts
  modified:
    - apps/api/src/modules/vacancies/vacancies.service.ts
    - apps/api/src/modules/vacancies/vacancies.service.test.ts
    - apps/api/src/modules/vacancies/vacancies.controller.ts
    - apps/api/src/modules/vacancies/vacancies.module.ts
    - apps/api/src/modules/users/schemas/user.schema.ts
    - apps/api/src/app.module.ts
decisions:
  - "ClaudeEmailDraftAdapter registered via EMAIL_DRAFT_ADAPTER_TOKEN symbol — enables swapping without changing ApplicationsService (e.g. no-op for free-tier users)"
  - "VacanciesService augmentWithApplicationStatus uses single batch query (not N+1) — fetches all application statuses in one find() call after getting vacancy list"
  - "User schema extended with smtpConfig: SmtpConfigType | null at schema level — required for SMTP dispatch; Rule 2 auto-fix (missing critical functionality)"
  - "GET /applications/export/csv and GET /applications/pending-count declared before GET /applications/:id — prevents NestJS route shadowing (same pattern as presets/active)"
  - "EmailSenderService test moved to separate file (email-sender.service.test.ts) — ts-jest cannot resolve cross-directory relative .js imports at test time"
metrics:
  duration: 21m
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 10
  files_modified: 6
---

# Phase 5 Plan 02: ApplicationsModule Summary

**One-liner:** ApplicationsModule with Claude email drafts via DI injection token, SMTP dispatch via nodemailer, paginated history with CSV export, and vacancy-application status join.

## What Was Built

### Task 1: ClaudeEmailDraftAdapter and EmailSenderService (TDD)
- `ClaudeEmailDraftAdapter` implements `EmailDraftAdapter` interface using Anthropic API
  - System prompt enforces 150-word body limit and 2 specific job-match points
  - Language detection: writes email in same language as job description
  - 8s timeout via AbortController, 2 retries with exponential backoff
  - Model: `claude-sonnet-4-6-20250514`
- `EmailSenderService` wraps nodemailer, decrypts SMTP password at send time via AES-256-GCM token-cipher
- 8 tests pass across 2 test files

### Task 2: ApplicationsModule Full Implementation

**ApplicationsModule:**
- Registered in AppModule after VacanciesModule
- EMAIL_DRAFT_ADAPTER_TOKEN factory provider — ClaudeEmailDraftAdapter instantiated once with ANTHROPIC_API_KEY
- Imports VacanciesModule (Vacancy model) and UsersModule (user profile + smtpConfig)

**ApplicationsService (9 methods):**
- `createDraft` — finds vacancy, checks for duplicate (409), generates Claude email draft via injected adapter, creates Application in 'draft' status
- `sendApplication` — dispatches via EmailSenderService, transitions to 'sent', updates vacancy status to 'applied'
- `findPaginated` — 20 items/page, filters by status/dateRange
- `findById` — returns `{ application, vacancy }` with populated vacancy data
- `updateStatus` — validates manual states only (`tracking_active|interview_scheduled|offer_received|rejected`), appends history entry
- `exportCsv` — joins vacancy data in single batch query, produces CSV with 7 columns
- `markPendingReview` — draft → pending_review transition
- `updateDraft` — edits email content/recipient before send
- `countPendingReview` — counts draft + pending_review for nav badge

**ApplicationsController (9 endpoints):**
- Route order: `export/csv` and `pending-count` declared before `:id` to prevent shadowing
- No direct ClaudeEmailDraftAdapter instantiation — adapter managed entirely by DI
- `POST /:id/send` fetches smtpConfig from user document, throws 400 if not configured

**Vacancy-Application Status Join:**
- `GET /vacancies/session/:sessionId?includeApplication=true` returns vacancies augmented with `applicationStatus` field
- Single batch query (not N+1) via `augmentWithApplicationStatus` private method
- Dashboard vacancy cards use this to show status badge instead of "Apply by Email" button

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added smtpConfig to User schema**
- **Found during:** Task 2 implementation — ApplicationsController fetches `user.smtpConfig` for SMTP dispatch
- **Issue:** User schema did not have `smtpConfig` field; TypeScript would fail on `user.smtpConfig` access
- **Fix:** Added `@Prop({ type: Object, default: null }) smtpConfig!: SmtpConfigType | null` to User schema
- **Files modified:** `apps/api/src/modules/users/schemas/user.schema.ts`
- **Commit:** 359620d

**2. [Rule 1 - Bug] Fixed vacancies.service.test.ts after Application model injection added**
- **Found during:** Task 2 — VacanciesService constructor now requires `@InjectModel(Application.name)`
- **Issue:** Existing test did not provide Application model mock, causing all 8 tests to fail
- **Fix:** Added Application model mock to test providers array
- **Files modified:** `apps/api/src/modules/vacancies/vacancies.service.test.ts`
- **Commit:** 359620d

**3. [Rule 3 - Blocking] EmailSenderService test moved to separate file**
- **Found during:** Task 1 TDD — ts-jest cannot resolve cross-directory `.js` imports at compile time
- **Issue:** Test file in `workers/adapters/` could not import `modules/applications/email-sender.service.js` due to TypeScript module resolution mismatch
- **Fix:** Created `email-sender.service.test.ts` in the same directory as the service (standard Jest co-location pattern)
- **Files modified:** `apps/api/src/modules/applications/email-sender.service.test.ts` (created), adapter test cleaned up
- **Commit:** c3d3f5f

## Tests

| Test File | Tests | Result |
|-----------|-------|--------|
| `claude-email-draft.adapter.test.ts` | 6 | PASS |
| `email-sender.service.test.ts` | 2 | PASS |
| `applications.service.test.ts` | 12 | PASS |
| `vacancies.service.test.ts` | 8 (existing, still pass) | PASS |

**Total new tests: 20. All pass.**

## Self-Check: PASSED

All key files exist on disk. Both task commits present in git log.
