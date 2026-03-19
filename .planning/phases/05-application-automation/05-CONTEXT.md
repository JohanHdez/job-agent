# Phase 5: Application Automation - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers an email-first application engine. The BullMQ worker from Phase 4 discovers and scores vacancies — Phase 5 adds on top:

1. **Email address detection** on each scored vacancy (hybrid: JSearch apply_options → JD regex → manual_required fallback)
2. **User-initiated email draft generation** via Claude API (on demand from Dashboard)
3. **SMTP sending** with user-configured credentials stored encrypted in their profile
4. **Dashboard review queue** — all drafts go through `pending_review` before sending
5. **`applications` MongoDB collection** with full lifecycle status tracking and history

**LinkedIn Easy Apply automation is deferred** — removed from Phase 5 to avoid LinkedIn bans and Playwright fragility. This simplifies Phase 5 to a pure email pipeline.

No CAPTCHA handling needed in Phase 5 — CAPTCHA is a Phase 4 concern (search scraper). Phase 5 has no LinkedIn bot.

</domain>

<decisions>
## Implementation Decisions

### Scope pivot: APPLY-01 deferred
- LinkedIn Easy Apply removed from Phase 5 scope
- APPLY-01 deferred to v2+ or a future phase
- Phase 5 is email-only: vacancy discovered (Phase 4) → user initiates "Apply by Email" in Dashboard → Claude generates draft → user reviews → SMTP send

### Email application trigger
- **User-initiated from Dashboard** — not automatic after scoring
- Worker (Phase 4) continues to save scored vacancies as before; Phase 5 adds no new logic to the worker pipeline
- User browses scored vacancies in the Dashboard, selects one, and clicks "Apply by Email"
- Claude draft is generated on-demand at that moment (not pre-generated in bulk)

### Email address detection (hybrid strategy)
Detection runs when a vacancy is persisted (Phase 4 pipeline) — the email is stored on the VacancyDocument so the Dashboard can show it immediately:

1. **Structured**: Scan JSearch `apply_options` array for entries with `mailto:` links — extract email
2. **Unstructured fallback**: If step 1 fails, apply email regex to `job_description` text
3. **Multiple emails found**: Use the first match; user can override in the Dashboard review screen
4. **No email + score > 80**: Mark vacancy as `recipientEmail: null, emailDetectionMethod: 'manual_required'` — Dashboard shows a direct link to original `apply_link` for manual application
5. **No email + score ≤ 80**: Standard filtered vacancy — no special handling needed

New fields on VacancyDocument:
- `recipientEmail?: string` — extracted email address (null if not found)
- `emailDetectionMethod?: 'apply_options' | 'jd_regex' | 'manual_required'` — how the email was found

### SMTP configuration
- Dedicated `smtpConfig` sub-document on the User MongoDB document
- Fields: `host`, `port`, `secure` (boolean), `user`, `password` (AES-256-GCM encrypted — same `token-cipher.ts` pattern as OAuth tokens in Phase 2), `fromName`, `fromEmail`
- **Google OAuth pre-fill**: if user authenticated via Google OAuth, pre-fill `fromEmail` with their Google account email — user must still provide SMTP password (app password for Gmail)
- SMTP credentials are never exposed in API responses — only used server-side for sending

### AI email drafting
- Model: `claude-sonnet-4-6` (project standard)
- **Inputs**: Full `ProfessionalProfileType` (CV data from User document) + full `job_description` text from VacancyDocument
- **Language detection**: Claude detects the language of the job description and writes the email in the same language (Spanish JD → Spanish email, English JD → English email)
- **Output format**: `{ subject: string, body: string }` — strict JSON response
- **Body constraints**: max 150 words; must explicitly mention 2 specific points from the vacancy that the user's experience addresses
- **Subject**: Claude crafts an attractive subject line based on the JD (not a rigid format — AI discretion)
- **Timeout + retries**: 8s timeout, max 2 retries with exponential backoff (NF-04)
- Wrap the Claude API call behind an `EmailDraftAdapter` interface (same adapter pattern as `ScoringAdapter` in Phase 4) — allows disabling for free-tier users in the future

### Applications collection schema
Separate MongoDB collection `applications` (NOT embedded in vacancy):

```
applications {
  userId: string            // row-level security (NF-08)
  vacancyId: string         // ref to vacancies collection
  status: ApplicationStatus // see lifecycle below
  emailContent: {
    subject: string
    body: string
  }
  recipientEmail: string    // may differ from vacancy.recipientEmail if user overrides
  history: Array<{
    status: ApplicationStatus
    timestamp: string       // ISO 8601
    note?: string           // optional user note on manual updates
  }>
  createdAt: string
  updatedAt: string
}
```

- **Unique constraint**: `(userId + vacancyId)` — one application per vacancy per user
- **Integrity**: backend validates no duplicate before creating; returns 409 if exists
- **Dashboard join**: GET /vacancies populates `application` status via Mongoose populate (or aggregation $lookup) when returning vacancy list

### Application status lifecycle
```
draft → pending_review → sent → tracking_active (optional) → interview_scheduled | offer_received | rejected
```

- `draft`: ApplicationRecord created after Claude generates the email; user hasn't reviewed yet
- `pending_review`: User has opened the draft in the Dashboard review screen
- `sent`: Email dispatched via SMTP successfully; `history` entry records timestamp
- `tracking_active`: User marks they're actively tracking this application (optional intermediate state)
- `interview_scheduled`, `offer_received`, `rejected`: Terminal tracking states set manually by user (HIST-03)

### History & tracking (HIST-01, HIST-02, HIST-03)
- **HIST-01**: GET /applications with pagination (20/page), filters: `status`, `company`, `platform`, `dateRange`; CSV export endpoint
- **HIST-02**: GET /applications/:id returns full detail: JD (via vacancy populate), score, emailContent, apply_link, current status, `history` array as change timeline
- **HIST-03**: PATCH /applications/:id/status — user sets status to any valid manual state (`tracking_active`, `interview_scheduled`, `offer_received`, `rejected`); optional `note` field; transition is appended to `history` array with timestamp

### Claude's Discretion
- Exact Mongoose indexes for the `applications` collection
- Nodemailer vs `smtp-client` library choice for SMTP transport
- Dashboard API response shape for vacancy + application join (populate vs aggregation)
- Exact email regex pattern for JD extraction
- Error handling when SMTP send fails (retry strategy, status rollback)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — APPLY-02, APPLY-03, HIST-01, HIST-02, HIST-03, NF-04 (APPLY-01 is deferred; APPLY-04 is complete in Phase 4)

### Phase 4 infrastructure (extend, don't replace)
- `.planning/phases/04-pipeline-search-scoring/04-CONTEXT.md` — vacancy pipeline decisions, VacancyStatus enum, worker architecture, JSearch adapter pattern; email detection fields extend VacancyDocument
- `apps/api/src/modules/vacancies/schemas/vacancy.schema.ts` — VacancyDocument schema; extend with `recipientEmail` and `emailDetectionMethod` fields
- `apps/api/src/modules/vacancies/` — VacanciesModule and VacanciesService; Phase 5 extends VacanciesService with email detection and adds new ApplicationsModule

### Phase 2 patterns (encryption + user document)
- `.planning/phases/02-auth-+-users/02-CONTEXT.md` — AES-256-GCM encryption pattern, getUserId() JWT pattern, User schema extension patterns
- `apps/api/src/common/crypto/token-cipher.ts` — AES-256-GCM encrypt/decrypt; reuse for SMTP password

### Phase 3 SSE events (read-only)
- `.planning/phases/03-sessions-bullmq/03-CONTEXT.md` — `application_made` SSE event schema (`{ jobId, method: 'easy_apply' | 'email', status, timestamp }`)

### Types
- `packages/core/src/types/vacancy.types.ts` — VacancyType, VacancyStatus (`new | applied | dismissed | failed`)
- `packages/core/src/types/job.types.ts` — ApplicationRecord, ApplicationStatus, ApplicationMethod (existing; may need extending for new status values)
- `packages/core/src/types/index.ts` — barrel export; new ApplicationStatus and SmtpConfig types must be added here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/common/crypto/token-cipher.ts` — AES-256-GCM encrypt/decrypt; reuse directly for SMTP password field storage (same pattern as Phase 2 OAuth tokens)
- `apps/api/src/modules/users/` — UsersModule + User schema; extend User document with `smtpConfig` sub-document; reuse getUserId() JWT extraction pattern
- `apps/api/src/modules/vacancies/` — VacanciesModule + VacanciesService; extend schema with email detection fields; VacanciesService is the injection point for email detection logic
- `apps/api/src/workers/adapters/jsearch.adapter.ts` — shows `JobSearchAdapter` interface pattern; follow the same pattern for `EmailDraftAdapter` wrapping Claude API
- Phase 4 `ScoringAdapter` interface — exact adapter pattern to follow for `EmailDraftAdapter`

### Established Patterns
- AES-256-GCM encryption via `token-cipher.ts` — all sensitive credential fields encrypted at rest
- `getUserId()` helper in controllers — JWT userId extraction; use in ApplicationsController for all endpoints
- Row-level security: every MongoDB query filtered by `userId` (NF-08) — apply to both `applications` and `vacancies` queries
- Mongoose populate pattern already used in vacancies module — extend for application status joins

### Integration Points
- **User document** (`users` collection) → add `smtpConfig` sub-document; handled in UsersModule Phase 2 extension
- **Vacancy document** (`vacancies` collection) → add `recipientEmail`, `emailDetectionMethod` fields; handled in VacanciesModule extension
- **New `applications` collection** → new ApplicationsModule (NestJS module) with schema, service, controller
- **Dashboard API** → GET /vacancies must accept a `?includeApplication=true` query param and populate application status from `applications` collection
- **Email detection** → runs during vacancy persistence in Phase 4 pipeline; Phase 5 adds a `detectRecipientEmail(vacancy: RawJobResult): string | null` utility called from VacanciesService.save()

</code_context>

<specifics>
## Specific Ideas

- SMTP password stored encrypted with the same AES-256-GCM pattern as OAuth tokens — no new encryption infrastructure needed
- Google OAuth pre-fill: if `user.googleId` exists, pre-fill `smtpConfig.fromEmail` with `user.email` to reduce SMTP setup friction
- Email body: max 150 words, 2 specific vacancy-to-experience connection points, language-matched to JD
- Dashboard shows a "Pending Review" badge/queue — all `draft` and `pending_review` ApplicationRecords surfaced prominently
- When user overrides the recipient email in the Dashboard, the `applications.recipientEmail` is saved (not `vacancy.recipientEmail`) — the override lives on the ApplicationRecord

</specifics>

<deferred>
## Deferred Ideas

- **LinkedIn Easy Apply automation (APPLY-01)** — removed from Phase 5 to avoid LinkedIn bans and Playwright fragility. Deferred to v2+ or a dedicated future phase.
- **Playwright-based CAPTCHA handling in apply flow** — no longer relevant since Easy Apply is deferred
- **Multiple email attempts per vacancy** — current design allows only one ApplicationRecord per (userId, vacancyId); re-apply logic deferred
- **Scheduled/batched email sending** — current design is on-demand user-triggered; batch scheduling deferred
- **Auto-drafting in bulk** (generate drafts for all qualifying vacancies after session) — user chose on-demand trigger; bulk auto-draft deferred

</deferred>

---

*Phase: 05-application-automation*
*Context gathered: 2026-03-18*
