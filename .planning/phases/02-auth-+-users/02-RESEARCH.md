# Phase 2: Auth + Users - Research

**Researched:** 2026-03-16
**Domain:** NestJS OAuth + JWT code-exchange, MongoDB user schema extension, CV upload pipeline, search preset CRUD, React Zustand auth flow migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Profile data model**
- Professional profile fields are embedded in the User document as a `profile` subdocument (not a separate collection)
- The Mongoose schema for `profile` mirrors `ProfessionalProfileType` from `packages/core` exactly — packages/core is the single source of truth, no divergence allowed
- On first OAuth login with no profile: redirect to `/profile/setup` — user must fill critical fields before reaching the dashboard
- When importing (LinkedIn or CV) while a manually edited profile already exists: merge only — imported data fills empty fields only; existing manual edits are never overwritten

**LinkedIn profile import**
- LinkedIn OAuth provides identity only: name, email, photo, headline — stored immediately after OAuth callback
- Full profile import (skills, experience, education, seniority, languages) is triggered by CV upload via Claude API (packages/cv-parser already implements this)
- LinkedIn import is triggered automatically on first LinkedIn login — identity fields are populated right after the OAuth callback
- If LinkedIn API call fails or times out: show error with a Retry button; the profile setup page still loads (user can fill manually)
- Import is considered successful when: `skills` array is non-empty + `seniority` is set + at least 1 `experience` entry exists
- Minimum critical fields threshold (PROF-04 incomplete alert): skills, seniority, at least 1 work experience entry

**Search presets (SRCH-01, SRCH-02)**
- Presets stored as an embedded array on the User document (`searchPresets: SearchPreset[]`)
- Each preset shape matches all `AppConfigType` search fields + a preset name:
  `{ id, name, keywords[], location, modality[], platforms[], seniority[], languages[], datePosted, minScoreToApply, maxApplicationsPerSession, excludedCompanies[] }`
- Maximum 5 presets enforced at the service layer: attempting to save a 6th returns HTTP 400 — `"Maximum 5 presets reached. Delete one first."`
- `activePresetId` stored on the User document — tracks which preset is currently active for search sessions
- Switching active preset via `PATCH /users/presets/active` (sets `activePresetId`)

**Token delivery and storage (security)**
- No tokens in URL params — use short-lived code-exchange pattern:
  1. OAuth callback stores `{ accessToken, refreshToken }` in Redis with a one-time code (UUID) and 30-second TTL
  2. Redirect to frontend: `${FRONTEND_URL}/auth/callback?code=<uuid>` (no tokens in URL)
  3. Frontend calls `POST /auth/exchange` with the code → backend returns `{ accessToken }` in JSON body + sets `refreshToken` as an httpOnly Secure SameSite=Strict cookie
- Access token stored in-memory (Zustand store) — lost on page refresh; app silently calls `POST /auth/refresh` on load using the httpOnly cookie
- Refresh token stored as httpOnly cookie set by backend on every `/auth/refresh` call — never accessible to JavaScript
- Redis used for auth code TTL storage (already in Phase 1 stack)

### Claude's Discretion
- JWT signing algorithm and exact payload fields (sub, email, name, iat, exp)
- MongoDB index strategy for user lookups
- Rate limiting on `/auth/exchange` and `/auth/refresh`
- Exact field validation rules on profile PATCH endpoint
- Error message copy for incomplete profile banner

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | LinkedIn OAuth 2.0 login — access_token, refresh_token, basic profile stored; JWT issued with 24h expiry | OAuth strategy already built in Phase 1; needs code-exchange pattern migration |
| AUTH-02 | Google OAuth 2.0 login — email, name, photo stored; JWT issued with 24h expiry | Google strategy already built; same code-exchange migration needed |
| AUTH-03 | All protected routes require valid JWT; automatic token refresh before expiry without re-login | JWT guard already global; silent refresh on page load via httpOnly cookie is new work |
| AUTH-04 | User can edit name, contact email, platform language preference; changes persist in MongoDB | New `PATCH /users/me` endpoint + frontend form needed |
| PROF-01 | Import professional profile from LinkedIn API using OAuth token → ProfessionalProfileType | CONTEXT clarifies: LinkedIn provides identity only; full profile = CV upload |
| PROF-02 | User can upload PDF CV; system parses it with Claude API; generates ProfessionalProfileType with >= 85% accuracy on critical fields | packages/cv-parser pipeline already exists; needs `POST /users/profile/cv` NestJS endpoint with multer |
| PROF-03 | User can review imported profile in an editable form and save changes | Frontend editable form + `PATCH /users/profile` endpoint |
| PROF-04 | If imported profile lacks critical fields, show alert with missing fields list | Completeness check service method + frontend banner |
| SRCH-01 | User can configure search params; config persists in MongoDB and can be saved as named preset | New SearchPreset embedded schema + CRUD endpoints |
| SRCH-02 | User can save up to 5 named search presets and switch between them | 5-preset cap enforced in service layer; `activePresetId` tracking |
| NF-03 | LinkedIn profile import completes in < 8 seconds end-to-end | cv-parser uses Claude API; async processing within NestJS request lifetime; must time-bound the Claude call |
</phase_requirements>

---

## Summary

Phase 2 is a migration + extension phase. The underlying OAuth infrastructure (LinkedIn OIDC, Google OAuth, JWT guard, upsert patterns, AES-256-GCM token encryption) was fully scaffolded in Phase 1. The work breaks into four coherent tracks:

**Track 1 — Auth security hardening:** The existing OAuth callbacks redirect tokens in URL query params, which exposes them in browser history, server logs, and referrer headers. This must be replaced with the locked code-exchange pattern (Redis one-time code, 30s TTL, `POST /auth/exchange`, httpOnly cookie for refresh token). The JWT strategy currently uses HS256 with a shared secret — Phase 2 is the decision point for upgrading to RS256 (asymmetric). Given that REQUIREMENTS.md notes "HS256 in Phase 1; RS256 deferred to Phase 2", this is expected work.

**Track 2 — User schema + profile CRUD:** The User Mongoose schema currently has only identity fields (email, name, photo, headline, OAuth IDs, refreshTokens). Three new embedded documents must be added: `profile` (mirrors `ProfessionalProfile` from packages/core), `searchPresets[]` (mirrors `AppConfig.search` fields + name + id), and `activePresetId`. Service methods for profile merge-upsert, completeness check, and preset CRUD must be added to `UsersService`.

**Track 3 — CV upload pipeline:** A `POST /users/profile/cv` endpoint must wire multer (multipart file upload) into the existing `runCvParser` function from `@job-agent/cv-parser`. The parsed `ProfessionalProfile` must be merge-applied to `user.profile` using the fill-empty-fields-only rule. The NF-03 requirement (< 8s end-to-end) constrains how long the Claude API call can take — a timeout of 7s with one retry is appropriate.

**Track 4 — Frontend migration:** The `AuthCallbackPage` currently reads `accessToken` and `refreshToken` from URL search params, then stores both in Zustand. This must change to: read `?code=`, call `POST /auth/exchange`, store only `accessToken` in Zustand (refresh token arrives as httpOnly cookie and is never read by JS). A silent refresh-on-load effect must be added to the root `App` component. The `ProfilePage` must be extended to: show a profile setup redirect for new users, render an editable form (not just a display), and show the incomplete-profile banner when PROF-04 threshold is not met. A new `ConfigPage` section (or separate page) must handle search preset management.

**Primary recommendation:** Implement in dependency order — (1) code-exchange backend endpoints, (2) Redis integration in auth module, (3) User schema extension + service methods, (4) CV upload endpoint, (5) frontend auth flow migration, (6) profile edit UI, (7) search preset UI.

---

## Standard Stack

### Core (all already installed — no new installs needed except multer)

| Library | Version (verified) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `@nestjs/jwt` | 11.0.2 (installed: ^10.2.0) | JWT sign/verify | Official NestJS JWT integration |
| `passport-jwt` | 4.0.1 | JWT strategy for Passport | De facto standard for NestJS JWT auth |
| `ioredis` | 5.10.0 (installed: ^5.3.2) | Redis client | Already installed; used for auth code TTL |
| `mongoose` | 8.x (installed: ^8.4.1) | MongoDB ODM | Already in use |
| `class-validator` | 0.15.x (installed) | DTO validation | Already in use; NestJS standard |
| `class-transformer` | 0.5.x (installed) | DTO transform | Already in use |
| `crypto` (Node built-in) | — | UUID for one-time codes | No install needed; randomUUID() |

### New Install Required

| Library | Version (verified) | Purpose | Why |
|---------|-------------------|---------|-----|
| `multer` | 2.1.1 | Multipart file upload middleware | Standard NestJS file upload; `@nestjs/platform-express` includes it |
| `@types/multer` | 2.1.0 | TypeScript types for multer | Dev dependency |

**Note:** `@nestjs/platform-express` already installed. NestJS re-exports `FileInterceptor` and `UploadedFile` decorators from `@nestjs/common` — multer is the peer dependency. No additional NestJS package needed beyond installing `multer` and `@types/multer`.

### Testing Additions (web)

| Library | Version (verified) | Purpose |
|---------|-------------------|---------|
| `vitest` | 4.1.0 | Test runner for web (ESM-native) |
| `@testing-library/react` | 16.3.2 | Component testing |
| `@testing-library/user-event` | 14.6.1 | User interaction simulation |
| `jsdom` | 29.0.0 | DOM environment for Vitest |

The `apps/web` package has no test runner configured yet. Vitest must be added to `apps/web/package.json` devDependencies and a `vitest.config.ts` created.

**Installation:**
```bash
# In apps/api
npm install multer
npm install -D @types/multer

# In apps/web
npm install -D vitest @testing-library/react @testing-library/user-event jsdom @vitest/coverage-v8
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
apps/api/src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts          # ADD: POST /auth/exchange, modify callbacks
│   │   ├── auth.service.ts             # ADD: storeAuthCode(), exchangeCode() methods
│   │   └── strategies/
│   │       └── jwt.strategy.ts         # MODIFY: upgrade to RS256 (optional)
│   └── users/
│       ├── users.controller.ts         # NEW: PATCH /users/me, /users/profile, preset CRUD
│       ├── users.service.ts            # ADD: profile merge, completeness check, preset CRUD
│       ├── schemas/
│       │   └── user.schema.ts          # MODIFY: add profile, searchPresets, activePresetId
│       └── dto/
│           ├── update-user.dto.ts      # NEW
│           ├── update-profile.dto.ts   # NEW
│           ├── create-preset.dto.ts    # NEW
│           └── update-preset.dto.ts    # NEW

packages/core/src/types/
└── user.types.ts                       # NEW: SearchPreset interface (or add to config.types.ts)

apps/web/src/
├── features/
│   ├── auth/
│   │   └── AuthCallbackPage.tsx        # MODIFY: code-exchange flow, remove URL token reading
│   └── profile/
│       ├── ProfilePage.tsx             # MODIFY: edit mode, incomplete alert, setup redirect
│       └── ProfileSetupPage.tsx        # NEW: first-login onboarding
├── store/
│   └── auth.store.ts                   # MODIFY: remove refreshToken from Zustand state
└── vitest.config.ts                    # NEW: Vitest configuration
```

### Pattern 1: Redis One-Time Code Exchange

The auth callback generates a UUID code, stores `{ accessToken, refreshToken }` in Redis with 30s TTL, then redirects to the frontend with only the code.

```typescript
// auth.service.ts — new methods
import { randomUUID } from 'crypto';

const AUTH_CODE_TTL_SECONDS = 30;

async storeAuthCode(tokens: TokenPairDto): Promise<string> {
  const code = randomUUID();
  const key = `auth:code:${code}`;
  await this.redis.setex(key, AUTH_CODE_TTL_SECONDS, JSON.stringify(tokens));
  return code;
}

async exchangeCode(code: string): Promise<TokenPairDto> {
  const key = `auth:code:${code}`;
  const raw = await this.redis.get(key);
  if (!raw) throw new UnauthorizedException('Invalid or expired auth code');
  await this.redis.del(key); // one-time use
  return JSON.parse(raw) as TokenPairDto;
}
```

The modified callbacks become:
```typescript
// auth.controller.ts — modified linkedinCallback
const tokens = await this.authService.issueTokens(req.user);
const code = await this.authService.storeAuthCode(tokens);
res.redirect(`${FRONTEND_URL}/auth/callback?code=${code}`);
```

The new `POST /auth/exchange` endpoint:
```typescript
@Post('exchange')
@HttpCode(200)
@Public()
async exchange(@Body() body: { code: string }, @Res({ passthrough: true }) res: Response) {
  const tokens = await this.authService.exchangeCode(body.code);
  // Set refresh token as httpOnly cookie
  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/auth/refresh',
  });
  return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
}
```

### Pattern 2: Profile Merge (fill-empty-only)

The locked decision is that importing never overwrites existing manual edits. Implement as a shallow merge where only undefined/empty/null fields are filled:

```typescript
// users.service.ts
async mergeProfile(userId: string, incoming: Partial<ProfessionalProfile>): Promise<UserDocument> {
  const user = await this.userModel.findById(userId).exec();
  if (!user) throw new NotFoundException('User not found');

  const existing = user.profile ?? {};
  const merged: Partial<ProfessionalProfile> = { ...incoming };

  // For each field: keep existing value if it is non-empty
  for (const key of Object.keys(incoming) as Array<keyof ProfessionalProfile>) {
    const existingVal = existing[key];
    if (Array.isArray(existingVal) && existingVal.length > 0) {
      (merged as Record<string, unknown>)[key] = existingVal; // keep existing array
    } else if (existingVal !== undefined && existingVal !== null && existingVal !== '') {
      (merged as Record<string, unknown>)[key] = existingVal; // keep existing scalar
    }
  }

  return this.userModel.findOneAndUpdate(
    { _id: userId },
    { $set: { profile: merged } },
    { new: true, runValidators: true }
  ).exec() as Promise<UserDocument>;
}
```

### Pattern 3: Redis Injection in NestJS

Redis (ioredis) is already in the `package.json` dependency list but has no NestJS module wrapping it. The cleanest pattern for a NestJS modular monolith is a simple custom provider using an injection token:

```typescript
// common/redis/redis.provider.ts
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
};
```

Inject with `@Inject(REDIS_CLIENT) private readonly redis: Redis` in `AuthService`. Register `RedisProvider` in `AuthModule.providers` and export it so other modules can use the same Redis instance.

**Alternative:** `@nestjs-modules/ioredis` package provides a module wrapper, but adding a new package when a simple provider suffices is unnecessary overhead.

### Pattern 4: Multer File Upload in NestJS

```typescript
// users.controller.ts
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors, Post, MaxFileSizeValidator, ParseFilePipe, FileTypeValidator } from '@nestjs/common';

@Post('profile/cv')
@UseGuards(JwtAuthGuard)
@UseInterceptors(FileInterceptor('cv', {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new BadRequestException('Only PDF files are accepted'), false);
  },
}))
async uploadCv(
  @Req() req: AuthenticatedRequest,
  @UploadedFile(
    new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
        new FileTypeValidator({ fileType: 'application/pdf' }),
      ],
    })
  ) file: Express.Multer.File
) {
  return this.usersService.importCvProfile(req.user._id.toString(), file.buffer);
}
```

The `importCvProfile` service method writes the buffer to a temp path, calls `runCvParser`, then calls `mergeProfile`. It must enforce a total timeout of 7s to meet NF-03 (< 8s end-to-end including HTTP overhead).

### Pattern 5: Frontend Silent Refresh on Load

The `useAuthStore` currently stores both `accessToken` and `refreshToken`. Under the new pattern, `refreshToken` must be removed from Zustand state entirely — it lives only in the httpOnly cookie.

Silent refresh in `App.tsx` or a top-level `useEffect`:

```typescript
// apps/web/src/App.tsx — add this effect
useEffect(() => {
  if (accessToken) return; // already authenticated
  // Attempt silent refresh via httpOnly cookie (browser sends cookie automatically)
  fetch('/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data?.accessToken) {
        setTokens(data.accessToken);
        // then fetch /auth/me to populate user
      }
    })
    .catch(() => { /* unauthenticated, do nothing */ });
}, []);
```

**CORS configuration note:** The API must set `credentials: true` in NestJS CORS config for the httpOnly cookie to be sent cross-origin. The current `main.ts` must be checked — if `cors` is not yet enabled with credentials, it must be added.

### Pattern 6: Preset CRUD Service Methods

```typescript
// Preset endpoints
GET  /users/presets             → return all presets
POST /users/presets             → create preset (enforce max 5)
PATCH /users/presets/:id        → update preset
DELETE /users/presets/:id       → delete preset
PATCH /users/presets/active     → set activePresetId
```

The 5-preset cap must be checked before the `$push`:
```typescript
async createPreset(userId: string, dto: CreatePresetDto): Promise<UserDocument> {
  const user = await this.userModel.findById(userId).exec();
  if (!user) throw new NotFoundException();
  if ((user.searchPresets ?? []).length >= 5) {
    throw new BadRequestException('Maximum 5 presets reached. Delete one first.');
  }
  // ...
}
```

### Anti-Patterns to Avoid

- **Storing refreshToken in Zustand / localStorage:** Exposed to XSS. The entire point of httpOnly cookies is to keep the token inaccessible to JavaScript.
- **URL params for tokens:** Already present in the codebase — MUST be replaced, not left in place as a fallback.
- **Inline types for profile/preset shapes:** All new types (SearchPreset) must be defined in `packages/core/src/types/` and imported via `@job-agent/core` barrel export.
- **Using `findByIdAndUpdate` without `new: true`:** Returns the stale document before the update; always pass `{ new: true }`.
- **Multer disk storage for CV:** Store in-memory (`memoryStorage`) — the file content is immediately consumed by cv-parser and should not persist on the server filesystem.
- **Not deleting the auth code after exchange:** The one-time code must be `DEL`-ed immediately after it is successfully read from Redis.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multipart file upload | Custom multipart parser | `multer` + NestJS `FileInterceptor` | Handles boundaries, limits, streaming; edge cases around encoding are extensive |
| JWT sign/verify | `crypto.sign()` manually | `@nestjs/jwt` + `jsonwebtoken` | RS256 key rotation, expiry, payload validation are subtle; library is hardened |
| Redis TTL key-value | MongoDB with `createdAt` + cleanup job | `ioredis` `setex()` | Atomic TTL at the storage level; no cleanup required |
| DTO validation | Manual `if/else` type checks | `class-validator` decorators | Already installed; handles nested objects, arrays, conditional validation |
| PDF text extraction | Writing a PDF parser | `packages/cv-parser` (already built) | Already implements Claude API + heuristic fallback |
| Password hashing | `crypto.createHash` | N/A — no passwords in this phase | OAuth-only; no passwords |

---

## Common Pitfalls

### Pitfall 1: CORS credentials for httpOnly cookies
**What goes wrong:** The frontend sends `fetch('/auth/refresh', { credentials: 'include' })` but the browser blocks it because the NestJS server's CORS config does not include `credentials: true` and an explicit `origin` (not `*`).
**Why it happens:** `Access-Control-Allow-Credentials: true` is incompatible with wildcard `Access-Control-Allow-Origin: *`.
**How to avoid:** In `main.ts`, set:
```typescript
app.enableCors({
  origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});
```
**Warning signs:** Browser console shows `"CORS policy: credential flag is 'true', but the 'Access-Control-Allow-Credentials' header is 'false'"`.

### Pitfall 2: `SameSite=Strict` blocks the cookie on first OAuth redirect
**What goes wrong:** The backend sets `SameSite=Strict` on the refresh token cookie. But the first `/auth/exchange` call comes right after an OAuth redirect from a different origin (LinkedIn/Google), so `SameSite=Strict` blocks the cookie from being set or sent.
**Why it happens:** `SameSite=Strict` means the cookie is only sent when the request origin matches the cookie's domain exactly, with no top-level navigation from a third-party site.
**How to avoid:** Use `SameSite=Lax` for the refresh cookie during the exchange endpoint only, OR — simpler and the locked design — the exchange endpoint is called from the frontend (`/auth/callback` page) which is same-origin, so the cookie IS set on the response. There is no cross-site issue at that point. `SameSite=Strict` is correct for the `/auth/refresh` endpoint (same-origin fetch with `credentials: include`). The locked design is safe.
**Warning signs:** Cookie not visible in DevTools Application > Cookies after `/auth/exchange` response.

### Pitfall 3: Multer `memoryStorage` vs `diskStorage` for large CVs
**What goes wrong:** Using `diskStorage` creates temp files on the server, which can accumulate if the CV parser fails mid-way and cleanup is not implemented.
**Why it happens:** The default NestJS `FileInterceptor` uses `diskStorage` to `/tmp`. On crash/timeout, the temp file persists.
**How to avoid:** Explicitly pass `storage: multer.memoryStorage()` to the `FileInterceptor` options. The file buffer is held in memory, passed to `runCvParser` (which accepts a buffer path — check the cv-parser API), then GC'd.
**Note:** `runCvParser` currently takes a file path (`cvPath: string`). The service must write the buffer to a unique tmp path (`/tmp/{uuid}.pdf`), call the parser, then delete the tmp file in a `finally` block.
**Warning signs:** Disk fills up on `/tmp` over time; `ENOENT` errors in parser after timeout.

### Pitfall 4: Mongoose schema divergence from `ProfessionalProfile` type
**What goes wrong:** The embedded `profile` subdocument in the Mongoose schema is defined with different field names or types than `ProfessionalProfile` in `packages/core`.
**Why it happens:** Developer writes the Mongoose `@Prop` decorators from memory instead of referencing the type.
**How to avoid:** The Mongoose subdocument type must be `ProfessionalProfile` from `@job-agent/core`. Use a nested schema class with `@Prop` decorators that exactly mirrors every field. After any `packages/core` type change, update the schema immediately. Run `tsc --noEmit` to catch mismatches.
**Warning signs:** TypeScript errors on `user.profile.skills` access; silent data truncation in MongoDB.

### Pitfall 5: Auth code race condition (double exchange)
**What goes wrong:** Two simultaneous requests to `POST /auth/exchange` with the same code both succeed — one gets tokens, the other also gets them because the `GET` and `DEL` are not atomic.
**Why it happens:** Non-atomic read-then-delete: `GET auth:code:<uuid>` → (other request reads same key) → `DEL auth:code:<uuid>`.
**How to avoid:** Use a Redis `GETDEL` command (available in ioredis, atomic since Redis 6.2) instead of separate `GET` + `DEL`. For ioredis 5.x: `await this.redis.getdel(key)` — this is atomic.
**Warning signs:** Under concurrent load, two clients receive the same tokens from a single OAuth code.

### Pitfall 6: `refreshToken` left in Zustand store after migration
**What goes wrong:** The migration to httpOnly cookie leaves the old `refreshToken` field in `useAuthStore`, and some code path still calls `setTokens(at, rt)` storing it in memory.
**Why it happens:** Incomplete refactor — the store interface is updated but the old two-argument `setTokens` call remains in `AuthCallbackPage`.
**How to avoid:** Change `setTokens` signature to `setAccessToken(at: string)` — one argument only. TypeScript will flag every call site that still passes a second argument.
**Warning signs:** Chrome DevTools > Application > Memory shows `refreshToken` in Zustand state.

### Pitfall 7: Profile setup redirect loop
**What goes wrong:** The `/profile/setup` page also requires authentication, which means an unauthenticated user trying to visit `/profile/setup` gets redirected to `/login`, logs in, gets redirected to `/profile/setup` — which is correct. But if the setup page itself calls `GET /auth/me` and the user is not redirected away from `/profile/setup` after completing setup, they get stuck.
**Why it happens:** Missing redirect-after-setup logic.
**How to avoid:** After successful profile save in ProfileSetupPage, explicitly navigate to `/config` (or the dashboard). The redirect-to-setup logic in `AuthCallbackPage` should only fire when `user.profile` is empty; once profile is saved, the redirect should not re-trigger.

---

## Code Examples

### Existing upsert pattern (reuse for profile PATCH)
```typescript
// Source: apps/api/src/modules/users/users.service.ts (Phase 1)
await this.userModel.findOneAndUpdate(
  { $or: [{ linkedinId: dto.linkedinId }, { email: dto.email }] },
  { $set: { ... } },
  { upsert: true, new: true, runValidators: true }
);
```

### Existing AES-256-GCM encryption (reuse for any sensitive stored fields)
```typescript
// Source: apps/api/src/common/crypto/token-cipher.ts
import { encryptToken, decryptToken } from '../../common/crypto/token-cipher.js';
const encrypted = encryptToken(plaintext); // "iv:authTag:ciphertext" hex string
```

### JWT strategy (HS256, current — note RS256 upgrade needed)
```typescript
// Source: apps/api/src/modules/auth/strategies/jwt.strategy.ts
// Current: secretOrKey: process.env['JWT_SECRET']
// Phase 2 RS256: use secretOrKeyProvider with public key from env/file
import { passportJwtSecret } from 'jwks-rsa'; // if JWKS endpoint approach
// OR simply:
// privateKey: fs.readFileSync('./keys/private.pem')
// publicKey: fs.readFileSync('./keys/public.pem')
```

### runCvParser function signature (already implemented)
```typescript
// Source: packages/cv-parser/src/index.ts
export async function runCvParser(cvPath: string, outputPath?: string): Promise<ProfessionalProfile>
// Takes a file path — service must write buffer to tmp, then parse, then unlink
```

### ioredis GETDEL (atomic, use for auth code exchange)
```typescript
// ioredis 5.x supports GETDEL natively
const raw = await this.redis.getdel(`auth:code:${code}`);
if (!raw) throw new UnauthorizedException('Invalid or expired auth code');
return JSON.parse(raw) as TokenPairDto;
```

---

## State of the Art

| Old Approach (Phase 1 — must change) | New Approach (Phase 2) | Impact |
|--------------------------------------|------------------------|--------|
| OAuth callback redirects tokens in URL params | Code-exchange: `?code=<uuid>` only | Tokens never in browser history, logs, or referrer |
| `refreshToken` stored in Zustand state | `refreshToken` in httpOnly Secure cookie only | XSS-resilient token storage |
| `POST /auth/refresh` accepts token in JSON body | `POST /auth/refresh` reads token from httpOnly cookie | Token never in request body |
| HS256 with shared `JWT_SECRET` | RS256 with asymmetric key pair | Standard for OAuth-issuing services; easier key rotation |
| `refreshTokens` stored in MongoDB array | `refreshTokens` in MongoDB (short-term); Redis auth codes for exchange flow | Hybrid: Redis for ephemeral codes; MongoDB for durable refresh token revocation list |

**Deprecated/outdated (in current codebase):**
- `AuthCallbackPage` reading `accessToken` + `refreshToken` from URL search params — must be replaced entirely
- `useAuthStore.setTokens(at, rt)` two-argument form — must become `setAccessToken(at)` only
- `POST /auth/refresh` accepting `refreshToken` in request body — must change to cookie-only

---

## Open Questions

1. **RS256 vs HS256 for JWT**
   - What we know: REQUIREMENTS.md says "HS256 in Phase 1; RS256 deferred to Phase 2". STATE.md says "JWT guard uses HS256 with JWT_SECRET in Phase 1; RS256 with asymmetric keys deferred to Phase 2 (OAuth token issuance)".
   - What's unclear: Should Phase 2 do the RS256 migration or continue with HS256? The phase has enough scope without key management work. RS256 adds value (standard for OAuth-issuing systems) but requires generating and managing key pairs, updating `JWT_SECRET` → `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` env vars.
   - Recommendation: Implement RS256 in Phase 2 since it was explicitly deferred here. Use a 2048-bit RSA key pair generated at project setup and stored in `.env` as base64-encoded PEM strings. This is Claude's Discretion.

2. **GridFS vs S3 vs tmp-only for CV storage**
   - What we know: STATE.md flags "GridFS vs S3 for CV storage undecided — must decide before Phase 2 implementation begins".
   - What's unclear: Should the raw CV PDF be stored persistently, or only the parsed profile?
   - Recommendation: Store only the parsed `ProfessionalProfile` in MongoDB (embedded in User document). Do not persist the raw PDF — `multer.memoryStorage()` + parse + discard. This is simpler, avoids GridFS/S3 setup, and is sufficient for MVP since re-parsing can always re-upload. The profile data is the durable asset, not the PDF.

3. **JWT `exp` check for silent refresh trigger**
   - What we know: AUTH-03 requires "automatic token refresh before expiry without re-login".
   - What's unclear: Should the frontend check the JWT `exp` field proactively (decode the JWT in Zustand) and refresh N minutes before expiry, or simply catch 401 responses and refresh reactively?
   - Recommendation: Reactive 401 handling is simpler and more robust. Use a TanStack Query `onError` callback or an axios interceptor that catches 401, calls `POST /auth/refresh` (cookie-based), and retries the original request. This is Claude's Discretion.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 (API) + Vitest 4.1.0 (web — to be installed) |
| Config file | `apps/api/jest.config.ts` (exists) / `apps/web/vitest.config.ts` (Wave 0 gap) |
| Quick run command (API) | `npm run test --workspace=apps/api` |
| Quick run command (web) | `npm run test --workspace=apps/web` |
| Full suite with coverage | `npm run test:cov --workspace=apps/api` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | LinkedIn OAuth callback issues JWT via code-exchange | unit | `jest --testPathPattern=auth.service.test.ts` | ❌ Wave 0 |
| AUTH-02 | Google OAuth callback issues JWT via code-exchange | unit | `jest --testPathPattern=auth.service.test.ts` | ❌ Wave 0 |
| AUTH-03 | `POST /auth/exchange` returns accessToken + sets httpOnly cookie | unit | `jest --testPathPattern=auth.controller.test.ts` | ❌ Wave 0 |
| AUTH-03 | `POST /auth/refresh` reads cookie and issues new tokens | unit | `jest --testPathPattern=auth.controller.test.ts` | ❌ Wave 0 |
| AUTH-04 | `PATCH /users/me` updates name/email/language, persists | unit | `jest --testPathPattern=users.service.test.ts` | ❌ Wave 0 |
| PROF-01 | LinkedIn identity fields (name, email, photo, headline) stored on callback | unit | `jest --testPathPattern=users.service.test.ts` | ❌ Wave 0 |
| PROF-02 | `POST /users/profile/cv` parses PDF and stores profile | unit (mocked cv-parser) | `jest --testPathPattern=users.service.test.ts` | ❌ Wave 0 |
| PROF-03 | `PATCH /users/profile` updates profile; existing non-empty fields are preserved | unit | `jest --testPathPattern=users.service.test.ts` | ❌ Wave 0 |
| PROF-04 | `checkProfileCompleteness()` returns missing fields list | unit | `jest --testPathPattern=users.service.test.ts` | ❌ Wave 0 |
| SRCH-01 | `POST /users/presets` creates preset, persists in DB | unit | `jest --testPathPattern=users.service.test.ts` | ❌ Wave 0 |
| SRCH-02 | Attempting to create a 6th preset returns HTTP 400 with correct message | unit | `jest --testPathPattern=users.service.test.ts` | ❌ Wave 0 |
| SRCH-02 | `PATCH /users/presets/active` updates `activePresetId` | unit | `jest --testPathPattern=users.service.test.ts` | ❌ Wave 0 |
| NF-03 | CV parse + profile merge completes in < 8s | manual timing (Claude API) | manual-only — Claude API latency is external | manual |
| NF-08 | Profile PATCH endpoint filters by `userId` from JWT, not from body | unit (security) | `jest --testPathPattern=users.controller.test.ts` | ❌ Wave 0 |

**Note on NF-03:** The < 8s requirement cannot be guaranteed by a deterministic unit test (Claude API latency is external). The service should enforce a 7s timeout with `Promise.race`. The timeout behavior can be unit-tested by mocking `runCvParser` to return after 8s and verifying a `RequestTimeoutException` is thrown.

### Sampling Rate
- **Per task commit:** `npm run test --workspace=apps/api -- --passWithNoTests`
- **Per wave merge:** `npm run test:cov --workspace=apps/api`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/modules/auth/auth.service.test.ts` — covers AUTH-01, AUTH-02, AUTH-03 (storeAuthCode, exchangeCode, issueTokens)
- [ ] `apps/api/src/modules/auth/auth.controller.test.ts` — covers AUTH-03 (POST /auth/exchange, POST /auth/refresh cookie handling)
- [ ] `apps/api/src/modules/users/users.service.test.ts` — covers AUTH-04, PROF-01, PROF-02, PROF-03, PROF-04, SRCH-01, SRCH-02, NF-08
- [ ] `apps/api/src/modules/users/users.controller.test.ts` — covers NF-08 (userId from JWT, not body)
- [ ] `apps/api/src/common/crypto/token-cipher.test.ts` — covers AES-256-GCM encrypt/decrypt round-trip (excluded from coverage in Phase 1; now in scope)
- [ ] `apps/web/vitest.config.ts` — Vitest configuration for web package
- [ ] `apps/web/src/features/auth/AuthCallbackPage.test.tsx` — code-exchange flow
- [ ] `apps/web/src/features/profile/ProfilePage.test.tsx` — edit form, incomplete alert

**Jest coverage exclusion update:** `jest.config.ts` currently excludes `!**/modules/auth/**` and `!**/modules/users/**` and `!**/crypto/**`. These exclusions MUST be removed in Phase 2 since these modules are now under active development and test.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `apps/api/src/modules/auth/`, `apps/api/src/modules/users/`, `packages/cv-parser/src/`, `packages/core/src/types/` — all files read directly
- `apps/api/jest.config.ts` — confirmed test framework, exclusions, and coverage thresholds
- `apps/api/package.json` — confirmed installed versions: ioredis 5.3.2, multer not installed, @nestjs/jwt 10.2.0, jest 29.7.0
- `apps/web/package.json` — confirmed vitest not installed; zustand 5.0.4, react-query 5.80.7

### Secondary (MEDIUM confidence)
- npm registry version checks (run 2026-03-16): multer@2.1.1, @types/multer@2.1.0, vitest@4.1.0, @testing-library/react@16.3.2, ioredis@5.10.0 — all current
- ioredis `GETDEL` support: Available in ioredis 5.x (Redis 6.2+ command) — HIGH confidence based on ioredis 5.x changelog knowledge

### Tertiary (LOW confidence)
- RS256 implementation approach using PEM keys in env vars — standard pattern, not verified against current `@nestjs/jwt` 10.x docs. Verify `JwtModule.registerAsync` options for `algorithm: 'RS256'` + `privateKey` / `publicKey` fields before implementing.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against npm registry on research date
- Architecture: HIGH — based on direct codebase inspection; patterns match existing Phase 1 conventions
- Pitfalls: HIGH — identified from code analysis of existing implementations (URL param token exposure already present in codebase, CORS not currently configured)
- RS256 migration: MEDIUM — deferred from Phase 1 with explicit intent; exact NestJS JWT RS256 config should be verified against `@nestjs/jwt` 10.x docs before implementation

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable dependencies; Redis/NestJS change infrequently)
