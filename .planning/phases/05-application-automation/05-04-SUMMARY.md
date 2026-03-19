---
phase: 05-application-automation
plan: "04"
subsystem: ui
tags: [react, inline-styles, email-draft, modal, drawer, csv-export, smtp, tanstack-query, accessibility]

# Dependency graph
requires:
  - phase: 05-application-automation
    provides: 05-02 ApplicationsController (POST /applications, GET /applications, PATCH status/draft, POST send/review, GET pending-count, GET export/csv)
  - phase: 05-application-automation
    provides: 05-03 UsersController PUT/GET /users/smtp-config
  - phase: 05-application-automation
    provides: 05-01 VacanciesService augmentWithApplicationStatus, recipientEmail/emailDetectionMethod fields
  - phase: 02-auth-+-users
    provides: ProfilePage, AppLayout, api.ts shared axios instance

provides:
  - SmtpConfigSection: load/save SMTP credentials form with AES-encrypted password note
  - ApplicationFilters: status/company/platform/date filter row with clear button
  - CsvExportButton: blob download with loading/done/error states
  - StatusUpdateMenu: accessible role=menu dropdown with note field and keyboard navigation
  - EmailDraftModal: full-overlay modal for generate-edit-send email application flow
  - ApplicationDetailDrawer: right-side drawer with status timeline, email content, status update
  - PendingReviewQueue: horizontal scroll queue of draft applications on Dashboard
  - DashboardPage: vacancy grid with Apply by Email / Apply Manually / status badge cards
  - ApplicationHistoryPage upgraded: filters, pagination, row-click drawer, CSV export, Phase 5 statuses
  - AppLayout updated: Applications nav item with pending count badge
  - router updated: /applications route for DashboardPage

affects: [05-05, user-facing application automation workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Inline style objects (not Tailwind) — matches existing ProfilePage and ApplicationHistoryPage pattern
    - Focus trap pattern via TabKey + querySelectorAll('[role="menuitem"]') for modal/drawer accessibility
    - api.ts shared axios instance for all API calls — no raw fetch, no new axios instances
    - prefers-reduced-motion media query checked in useEffect to disable animations
    - Toast component uses role=status + aria-live=polite, auto-dismisses after 4 seconds

key-files:
  created:
    - apps/web/src/features/profile/SmtpConfigSection.tsx
    - apps/web/src/features/history/ApplicationFilters.tsx
    - apps/web/src/features/history/CsvExportButton.tsx
    - apps/web/src/features/applications/StatusUpdateMenu.tsx
    - apps/web/src/features/applications/EmailDraftModal.tsx
    - apps/web/src/features/applications/ApplicationDetailDrawer.tsx
    - apps/web/src/features/dashboard/PendingReviewQueue.tsx
    - apps/web/src/features/dashboard/DashboardPage.tsx
  modified:
    - apps/web/src/features/profile/ProfilePage.tsx
    - apps/web/src/features/history/ApplicationHistoryPage.tsx
    - apps/web/src/components/AppLayout.tsx
    - apps/web/src/router.tsx

key-decisions:
  - "DashboardPage fetches vacancies with includeApplication=true param to join application status in a single request — avoids N+1"
  - "EmailDraftModal calls POST /applications on mount (creates draft with Claude email), then POST /review — draft creation and review transition happen automatically on modal open"
  - "ApplicationDetailDrawer refreshes its own data on status update (re-GETs application) — decoupled from parent list refresh"
  - "AppLayout polls /applications/pending-count every 60 seconds for badge count — frequent enough without hammering API"
  - "PendingReviewQueue queries status=pending_review directly — does not reuse the pending-count endpoint which only returns a number"
  - "ApplicationHistoryPage wrapper bg/minHeight removed — page renders inside AppLayout which provides bg and scroll"
  - "SmtpConfigSection password field always renders empty — never pre-fills the masked string returned by GET /users/smtp-config"

patterns-established:
  - "Modal focus trap: save previous focus ref on mount, restore on unmount, intercept Tab/Shift+Tab to keep focus inside"
  - "Drawer slide-in animation with @keyframes slideIn, disabled with prefers-reduced-motion media query"
  - "Status badge pattern extended: STATUS_BADGE_STYLES record covers all Phase 5 statuses + legacy statuses for backward compat"
  - "Apply button logic: hasApplication → status badge, emailDetectionMethod !== manual_required && recipientEmail → Apply by Email, else → Apply Manually"

requirements-completed: [APPLY-02, APPLY-03, HIST-01, HIST-02, HIST-03]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 5 Plan 04: Application Automation Frontend Summary

**7 new React components + 3 upgraded files completing the full email application workflow — SMTP config, vacancy browsing with Apply by Email, draft generation modal, application history with filters/pagination/drawer, and manual status tracking**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T23:35:39Z
- **Completed:** 2026-03-18T23:43:39Z
- **Tasks:** 2 auto tasks completed (Task 3 is checkpoint:human-verify — paused)
- **Files modified:** 12

## Accomplishments
- Built complete email application UI: SmtpConfigSection (SMTP form), EmailDraftModal (generate-edit-send), ApplicationDetailDrawer (detail + history + status), StatusUpdateMenu (manual tracking)
- Built DashboardPage with vacancy grid — conditionally shows Apply by Email, Apply Manually, or application status badge based on emailDetectionMethod and applicationStatus
- Upgraded ApplicationHistoryPage to use shared api instance, ApplicationFilters, CsvExportButton, pagination, row-click drawer, and all Phase 5 statuses
- Added Applications nav item to AppLayout with pending review count badge (polls every 60s)
- All components use inline style objects with design tokens matching existing codebase pattern
- Full accessibility: role=dialog/menu, aria-modal, aria-label, focus trap, prefers-reduced-motion, keyboard navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: SmtpConfigSection, ApplicationFilters, CsvExportButton, StatusUpdateMenu** - `41f2394` (feat)
2. **Task 2: EmailDraftModal, ApplicationDetailDrawer, PendingReviewQueue, DashboardPage, history upgrade, AppLayout, router** - `22899e1` (feat)

## Files Created/Modified
- `apps/web/src/features/profile/SmtpConfigSection.tsx` - SMTP form with load/save, validation, encrypted password note
- `apps/web/src/features/history/ApplicationFilters.tsx` - Status/company/platform/date filter row with clear
- `apps/web/src/features/history/CsvExportButton.tsx` - Blob download with idle/loading/done/error states
- `apps/web/src/features/applications/StatusUpdateMenu.tsx` - Accessible role=menu with color dots, note field, keyboard nav
- `apps/web/src/features/applications/EmailDraftModal.tsx` - Full-overlay modal: loading → draft → sending → toast/error states
- `apps/web/src/features/applications/ApplicationDetailDrawer.tsx` - Right drawer: timeline, job details, email content, status update
- `apps/web/src/features/dashboard/PendingReviewQueue.tsx` - Horizontal scroll of pending_review cards
- `apps/web/src/features/dashboard/DashboardPage.tsx` - Vacancy grid with conditional Apply by Email / Apply Manually / status badge
- `apps/web/src/features/profile/ProfilePage.tsx` - Added SmtpConfigSection below profile with separator
- `apps/web/src/features/history/ApplicationHistoryPage.tsx` - Major rewrite with api instance, filters, pagination, drawer
- `apps/web/src/components/AppLayout.tsx` - Added Applications nav item with pending count badge
- `apps/web/src/router.tsx` - Added /applications route pointing to DashboardPage

## Decisions Made
- DashboardPage fetches vacancies with `?includeApplication=true` query parameter — uses VacanciesService batch join to avoid N+1 per card
- EmailDraftModal creates the application on mount (POST /applications) and immediately calls POST /review — no explicit button to initiate; modal opening IS the trigger
- ApplicationDetailDrawer refreshes its own data after status update via a separate GET — decoupled from parent list, always shows fresh timeline
- AppLayout polls `/applications/pending-count` every 60 seconds — badge shows pending review count next to Applications nav item
- ApplicationHistoryPage wrapper `bg: '#0f0f14', minHeight: '100vh'` removed — page now renders inside AppLayout which provides the shell
- SmtpConfigSection password field always renders empty — never pre-fills the masked `'********'` returned by the public GET endpoint

## Deviations from Plan

None — plan executed exactly as written. All components match design token specifications and API patterns from context interfaces.

## Issues Encountered
None — TypeScript passed with zero errors on both task checkpoints.

## User Setup Required
None - no external service configuration required for this plan. SMTP credentials are entered by the user through the SmtpConfigSection UI.

## Next Phase Readiness
- All Phase 5 frontend components built and integrated
- EmailDraftModal wired to POST /applications + POST /review + PATCH /draft + POST /send
- ApplicationDetailDrawer wired to GET /applications/:id
- DashboardPage wired to GET /vacancies?includeApplication=true
- ApplicationHistoryPage wired to GET /applications with filters + GET /applications/export/csv
- SmtpConfigSection wired to PUT/GET /users/smtp-config
- Awaiting human verification (Task 3 checkpoint) to confirm visual and functional correctness

---
*Phase: 05-application-automation*
*Completed: 2026-03-18*
