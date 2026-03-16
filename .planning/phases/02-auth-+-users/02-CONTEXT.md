# Phase 2: Auth + Users - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can authenticate via LinkedIn OAuth or Google OAuth, exchange OAuth codes for JWT tokens securely, import their professional profile (via PDF CV upload parsed by Claude API, or LinkedIn OAuth identity fields), edit profile fields, configure search preferences, and save up to 5 named presets — all data persisted per-user in MongoDB.

LinkedIn OAuth provides **identity only** (name, email, photo, headline). The full professional profile (skills, experience, education, languages, seniority) comes from **PDF CV upload + Claude API parsing** (packages/cv-parser).

</domain>

<decisions>
## Implementation Decisions

### Profile data model
- Professional profile fields are **embedded** in the User document as a `profile` subdocument (not a separate collection)
- The Mongoose schema for `profile` mirrors `ProfessionalProfileType` from `packages/core` exactly — packages/core is the single source of truth, no divergence allowed
- On first OAuth login with no profile: redirect to `/profile/setup` page — user must fill critical fields before reaching the dashboard
- When importing (LinkedIn or CV) while a manually edited profile already exists: **merge only** — imported data fills empty fields only; existing manual edits are never overwritten

### LinkedIn profile import
- LinkedIn OAuth provides identity only: name, email, photo, headline — stored immediately after OAuth callback
- Full profile import (skills, experience, education, seniority, languages) is triggered by **CV upload via Claude API** (packages/cv-parser already implements this)
- LinkedIn import is triggered **automatically on first LinkedIn login** — identity fields are populated right after the OAuth callback
- If LinkedIn API call fails or times out: show error with a **Retry button**; the profile setup page still loads (user can fill manually)
- Import is considered successful when: `skills` array is non-empty + `seniority` is set + at least 1 `experience` entry exists
- Minimum critical fields threshold (PROF-04 incomplete alert): skills, seniority, at least 1 work experience entry

### Search presets (SRCH-01, SRCH-02)
- Presets stored as an **embedded array** on the User document (`searchPresets: SearchPreset[]`)
- Each preset shape matches all `AppConfigType` search fields + a preset name:
  ```
  { id, name, keywords[], location, modality[], platforms[], seniority[], languages[],
    datePosted, minScoreToApply, maxApplicationsPerSession, excludedCompanies[] }
  ```
- Maximum 5 presets enforced at the service layer: attempting to save a 6th returns HTTP 400 — `"Maximum 5 presets reached. Delete one first."`
- `activePresetId` stored on the User document — tracks which preset is currently active for search sessions
- Switching active preset via `PATCH /users/presets/active` (sets `activePresetId`)

### Token delivery & storage (security)
- **No tokens in URL params** — use short-lived code-exchange pattern:
  1. OAuth callback stores `{ accessToken, refreshToken }` in Redis with a one-time code (UUID) and 30-second TTL
  2. Redirect to frontend: `${FRONTEND_URL}/auth/callback?code=<uuid>` (no tokens in URL)
  3. Frontend calls `POST /auth/exchange` with the code → backend returns `{ accessToken }` in JSON body + sets `refreshToken` as an **httpOnly Secure SameSite=Strict cookie**
- Access token stored **in-memory** (Zustand store) — lost on page refresh; app silently calls `POST /auth/refresh` on load using the httpOnly cookie
- Refresh token stored as **httpOnly cookie** set by backend on every `/auth/refresh` call — never accessible to JavaScript
- Redis used for auth code TTL storage (already in Phase 1 stack)

### Claude's Discretion
- JWT signing algorithm and exact payload fields (sub, email, name, iat, exp)
- MongoDB index strategy for user lookups
- Rate limiting on `/auth/exchange` and `/auth/refresh`
- Exact field validation rules on profile PATCH endpoint
- Error message copy for incomplete profile banner

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Types and contracts
- `packages/core/src/types/cv.types.ts` — `ProfessionalProfileType`, `WorkExperience`, `Education`, `Language` — the Mongoose profile subdocument must mirror this exactly
- `packages/core/src/types/config.types.ts` — `AppConfigType` search fields — search preset shape must match these fields
- `packages/core/src/types/index.ts` — barrel export, all shared types

### Existing auth implementation (extend, don't replace)
- `apps/api/src/modules/auth/auth.controller.ts` — existing OAuth callbacks; modify to use code-exchange pattern instead of URL params
- `apps/api/src/modules/auth/auth.service.ts` — JWT issuance/rotation; extend with code storage/exchange logic
- `apps/api/src/modules/users/schemas/user.schema.ts` — add `profile`, `searchPresets`, `activePresetId` fields
- `apps/api/src/modules/users/users.service.ts` — extend with profile CRUD and preset management
- `apps/api/src/common/crypto/token-cipher.ts` — AES-256-GCM encryption already implemented; use for any sensitive stored fields

### Configuration and environment
- `config.yaml.example` — search fields that map to `SearchPreset` shape
- `.env.example` — LinkedIn/Google OAuth credentials, Redis URL

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-01..04, PROF-01..04, SRCH-01..02, NF-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/modules/auth/` — Full OAuth + JWT flow already scaffolded. Modify auth callbacks to emit one-time codes instead of URL params. Add `POST /auth/exchange` endpoint.
- `apps/api/src/modules/users/users.service.ts` — `upsertFromLinkedIn` / `upsertFromGoogle` already exist. Extend with profile CRUD methods.
- `apps/api/src/modules/users/schemas/user.schema.ts` — Add `profile: ProfessionalProfile`, `searchPresets: SearchPreset[]`, `activePresetId: string` fields.
- `apps/api/src/common/crypto/token-cipher.ts` — `encryptToken()` already in use for LinkedIn OAuth tokens. Reuse for any sensitive stored values.
- `packages/cv-parser/` — CV parsing via Claude API already implemented. Wire into a `POST /users/profile/cv` endpoint.

### Established Patterns
- AES-256-GCM encryption at rest for OAuth tokens (NF-06, Phase 1 complete) — pattern in `token-cipher.ts`
- Global JWT guard with `@Public()` escape hatch — auth routes already exempted
- `packages/core` as single source of truth for types — all new types defined there, never inline
- upsert pattern with `findOneAndUpdate` — reuse for profile updates

### Integration Points
- Redis (in Phase 1 stack) → auth code TTL store for code-exchange pattern
- `packages/cv-parser` → called from `POST /users/profile/cv` in users module
- Frontend (`apps/web`) → receives tokens from `/auth/exchange`; stores access token in Zustand, refresh token arrives as httpOnly cookie
- `FRONTEND_URL` env var → already used in auth controller for redirects

</code_context>

<specifics>
## Specific Ideas

- LinkedIn OAuth = identity only (name, email, photo, headline). Full profile = CV upload via Claude API. This is the explicit architectural decision — do NOT attempt full LinkedIn API profile import.
- "100x more stable than scraping, no user ban risk, easy maintenance, < 8s response time" — user's words for why CV parsing is preferred over LinkedIn scraping for profile data.
- Security pattern chosen: short-lived one-time code → POST /auth/exchange → httpOnly cookie for refresh token. This is a conscious security decision, not an optional enhancement.
- Access token: Zustand in-memory only. On page refresh, app silently re-acquires via /auth/refresh using the httpOnly cookie.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-auth-+-users*
*Context gathered: 2026-03-16*
