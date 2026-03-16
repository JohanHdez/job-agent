# Phase 2: Auth + Users - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users authenticate via LinkedIn OAuth or Google OAuth, receive JWT access + refresh tokens, and set up their professional profile (via CV PDF upload or LinkedIn profile import). They can edit profile fields, configure search preferences, and save up to 5 named presets — all persisted per-user in MongoDB.

Auth module stubs are already implemented from Phase 1 (OAuth flows, JWT issuance/refresh/revocation, `GET /auth/me`). Phase 2 wires them up to real MongoDB connections, migrates to RS256, adds profile management, CV upload, LinkedIn import, and search presets.

</domain>

<decisions>
## Implementation Decisions

### LinkedIn profile import
- After OAuth login, **attempt** a full LinkedIn API profile fetch (work experience, skills, education, languages) using the stored OIDC access token.
- If the API call fails (403, missing scope, or restricted access): do NOT show an error — display a partial data summary instead: "Imported: name, headline. Missing: skills, experience, education" with a prompt to upload CV.
- When LinkedIn API succeeds, import all four field groups: work experience (company, title, dates, description), skills list, education (degree, institution, dates), and languages.
- Re-import is **explicit only** — user manually clicks "Refresh from LinkedIn" in the profile page. No automatic background refresh.

### ProfessionalProfile storage
- Separate `profiles` MongoDB collection — User document stays auth-only (email, linkedinId, googleId, refreshTokens).
- New `ProfilesModule` in `apps/api/src/modules/profiles/` with `ProfilesController`, `ProfilesService`, and `UserProfileSchema`.
- `UserProfileSchema` is a new Mongoose schema that mirrors `ProfessionalProfileType` from `packages/core` — does not re-use the shared type directly as a schema, but maps to it.
- **One profile per user** — `userId` reference, always updated in place. No versioning.

### Profile merge strategy
- **Last write wins** — CV upload or LinkedIn import fully overwrites the existing profile. No field-level merging.
- After any import, the profile becomes **fully editable** via `PATCH /profiles/me` (partial field updates). Imported data is a starting point; user refines it.
- **Incomplete profile alert**: fires on every login if critical fields (skills, minimum experience) are missing. Alert shows exactly which fields are missing. User can dismiss per-session, but it reappears on next login until complete.

### Auth wiring (Phase 1 stubs → Phase 2 complete)
- Migrate JWT signing from HS256 (Phase 1) to RS256 with asymmetric key pair (NF-07 full compliance).
- All auth routes remain `@Public()` — protected routes require valid RS256 JWT.
- `POST /auth/refresh` uses stored refresh tokens in MongoDB (rotation already implemented).

### Search configuration presets
- **Claude's Discretion**: structure of `SearchConfigSchema` fields (must cover all fields from `config.yaml`: keywords, location, modality, platforms, seniority, languages, datePosted, minScore, maxApplications, excludedCompanies).
- Up to 5 named presets per user; CRUD via `GET/POST/PATCH/DELETE /users/me/presets`.
- Active preset tracked on the User document or profile.

### Row-level security
- Every MongoDB query in Phase 2 modules (profiles, presets) must include `userId` filter — no cross-user data leakage (NF-08).

### Claude's Discretion
- Exact `UserProfileSchema` field types and indexes (Claude aligns with `ProfessionalProfileType` from packages/core)
- RS256 key pair generation and storage approach (env var, file, or MongoDB)
- CV file upload handling: multipart boundary, temp storage, file size limit, cleanup after parse
- LinkedIn API endpoint selection for full profile import (v2 vs OIDC extended)
- Preset naming validation rules (max length, allowed characters)
- Exact alert UI design for incomplete profile (banner vs modal vs sidebar badge)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/common/crypto/token-cipher.ts`: AES-256-GCM encrypt/decrypt — already used for LinkedIn OAuth tokens, reuse for any sensitive storage in Phase 2
- `apps/api/src/common/decorators/public.decorator.ts`: `@Public()` decorator — auth routes stay public, already wired
- `apps/api/src/common/guards/jwt-auth.guard.ts`: Global APP_GUARD — all new Phase 2 endpoints protected by default
- `apps/api/src/modules/auth/`: Full OAuth stub already present (LinkedIn OIDC strategy, Google strategy, AuthService, AuthController) — Phase 2 completes wiring, adds RS256
- `apps/api/src/modules/users/users.service.ts`: `upsertFromLinkedIn`, `upsertFromGoogle`, refresh token management — Phase 2 adds profile and preset methods
- `apps/api/src/modules/users/schemas/user.schema.ts`: Has `linkedinAccessToken` (encrypted), `refreshTokens[]` — no profile fields; those go in separate `profiles` collection
- `packages/cv-parser/`: CV PDF → `ProfessionalProfileType` — import and call in `ProfilesService.uploadCv()`
- `packages/core/src/types/`: `ProfessionalProfileType`, `JobListingType` — `UserProfileSchema` must mirror `ProfessionalProfileType`

### Established Patterns
- NestJS module pattern: `*.module.ts` + `*.controller.ts` + `*.service.ts` + `schemas/*.schema.ts` — follow the same structure in `ProfilesModule`
- Encrypted storage: `encryptToken()` / `decryptToken()` from `token-cipher.ts` — reuse for LinkedIn access token decryption before API calls
- JSDoc on all public methods (CLAUDE.md rule)
- No `any` — use `unknown` + type guards
- Structured Winston logging via `@InjectLogger()` (from Phase 1 LoggerModule)
- Jest tests with `@nestjs/testing` — coverage ≥ 70% gate enforced in CI

### Integration Points
- `ProfilesController` wires into `app.module.ts` (add `ProfilesModule` to imports)
- CV upload POST needs `multer` or NestJS `FileInterceptor` for multipart
- LinkedIn API calls use the stored `linkedinAccessToken` (decrypt from User doc before use)
- `SearchPresetsController` / method on `UsersController` — stores presets in User or Presets collection, indexed by userId

</code_context>

<specifics>
## Specific Ideas

- "Try LinkedIn API, show partial data if it fails" — not silent fallback, not hard error. Show exactly what was imported and what's missing.
- Incomplete profile alert persists across sessions (not one-time dismissal) until the required fields are filled.
- Profile is a starting point, always editable — imports are non-destructive in the sense that the user can immediately correct them.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within Phase 2 scope.

</deferred>

---

*Phase: 02-auth-+-users*
*Context gathered: 2026-03-13*
