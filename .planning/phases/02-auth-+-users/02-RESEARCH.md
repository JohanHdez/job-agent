# Phase 2: Auth + Users - Research

**Researched:** 2026-03-13
**Domain:** NestJS Auth wiring (RS256 JWT), MongoDB profile management, CV upload via multer, LinkedIn API profile import, search configuration presets
**Confidence:** HIGH (core NestJS/JWT stack), MEDIUM (LinkedIn API scope reality), HIGH (codebase baseline)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**LinkedIn profile import**
- After OAuth login, attempt a full LinkedIn API profile fetch (work experience, skills, education, languages) using the stored OIDC access token.
- If the API call fails (403, missing scope, or restricted access): do NOT show an error — display a partial data summary instead: "Imported: name, headline. Missing: skills, experience, education" with a prompt to upload CV.
- When LinkedIn API succeeds, import all four field groups: work experience (company, title, dates, description), skills list, education (degree, institution, dates), and languages.
- Re-import is explicit only — user manually clicks "Refresh from LinkedIn" in the profile page. No automatic background refresh.

**ProfessionalProfile storage**
- Separate `profiles` MongoDB collection — User document stays auth-only.
- New `ProfilesModule` in `apps/api/src/modules/profiles/` with `ProfilesController`, `ProfilesService`, and `UserProfileSchema`.
- `UserProfileSchema` mirrors `ProfessionalProfile` from `packages/core` — does not re-use the shared type directly as a schema, maps to it.
- One profile per user — `userId` reference, always updated in place. No versioning.

**Profile merge strategy**
- Last write wins — CV upload or LinkedIn import fully overwrites existing profile.
- After any import, profile is fully editable via `PATCH /profiles/me`.
- Incomplete profile alert fires on every login if critical fields (skills, minimum experience) are missing. Alert shows exactly which fields are missing. User can dismiss per-session, but reappears on next login until complete.

**Auth wiring (Phase 1 stubs → Phase 2 complete)**
- Migrate JWT signing from HS256 to RS256 with asymmetric key pair (NF-07 full compliance).
- All auth routes remain `@Public()` — protected routes require valid RS256 JWT.
- `POST /auth/refresh` uses stored refresh tokens in MongoDB (rotation already implemented).

**Search configuration presets**
- Structure of `SearchConfigSchema` fields covers all fields from `AppConfig` in `packages/core`: keywords, location, modality, platforms, seniority, languages, datePosted, minScore, maxApplications, excludedCompanies.
- Up to 5 named presets per user; CRUD via `GET/POST/PATCH/DELETE /users/me/presets`.
- Active preset tracked on the User document or profile.

**Row-level security**
- Every MongoDB query in Phase 2 modules (profiles, presets) must include `userId` filter — no cross-user data leakage (NF-08).

### Claude's Discretion
- Exact `UserProfileSchema` field types and indexes
- RS256 key pair generation and storage approach (env var, file, or MongoDB)
- CV file upload handling: multipart boundary, temp storage, file size limit, cleanup after parse
- LinkedIn API endpoint selection for full profile import (v2 vs OIDC extended)
- Preset naming validation rules (max length, allowed characters)
- Exact alert UI design for incomplete profile (banner vs modal vs sidebar badge)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within Phase 2 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | LinkedIn OAuth 2.0 login — access_token, refresh_token stored; JWT issued 24h | Phase 1 stubs exist; Phase 2 wires MongoDB + RS256 migration |
| AUTH-02 | Google OAuth 2.0 login — email, name, photo stored; JWT issued 24h | Phase 1 stubs exist; same RS256 migration applies |
| AUTH-03 | Protected routes require valid JWT; automatic token refresh without re-login | Global JwtAuthGuard + `POST /auth/refresh` already wired; RS256 migration transparent |
| AUTH-04 | User can edit name, contact email, and platform language preference | `PATCH /users/me` endpoint on `UsersController`; adds `language` field to User schema |
| PROF-01 | Import LinkedIn profile via OAuth token — work experience, education, skills, languages | LinkedIn API reality: OIDC userinfo returns only lite fields; work experience/education/skills unavailable without partner approval; graceful partial-import required |
| PROF-02 | Upload PDF CV; parse with Claude API; generate ProfessionalProfile ≥85% accuracy | `runCvParser()` from `@job-agent/cv-parser` already implemented; wire via `FileInterceptor` |
| PROF-03 | Editable profile form — skills, seniority, languages, experience; save for future searches | `PATCH /profiles/me` with partial update; mirrors `ProfessionalProfile` type |
| PROF-04 | Alert on missing critical fields (skills, minimum experience) with field list | `ProfilesService.checkCompleteness()` → returns missing field list; fires on `GET /auth/me` |
| SRCH-01 | Configure search: keywords, location, modality, platforms, seniority, languages, datePosted, minScore, maxApplications, excludedCompanies; persists in MongoDB | `SearchPresetSchema` mirrors `AppConfig.search` + `AppConfig.matching`; stored in presets collection |
| SRCH-02 | Up to 5 named search presets; switch between them | `GET/POST/PATCH/DELETE /users/me/presets`; max-5 enforcement in service layer |
| NF-03 | LinkedIn profile import completes in < 8 seconds end-to-end | LinkedIn OIDC userinfo: ~200ms; v2 API (if approved): ~1-2s; cv-parser Claude call: ~3-5s; total well within 8s for either path |
</phase_requirements>

---

## Summary

Phase 2 extends Phase 1's auth stubs into a fully functional auth + profile system. The codebase already has OAuth strategies (LinkedIn OIDC + Google), JWT issuance/rotation/revocation, and the global `JwtAuthGuard`. Phase 2 has three discrete work areas: (1) migrate JWT from HS256 to RS256, (2) build a `ProfilesModule` with CV upload, LinkedIn import, and editable profile, and (3) build search configuration presets.

The most significant research finding is about LinkedIn API scope reality. The OIDC `userinfo` endpoint (which Phase 1 already uses) only returns: `sub`, `name`, `given_name`, `family_name`, `picture`, `email`, `email_verified`, `locale`. Work experience, education, skills, and languages are NOT available through the standard OIDC flow — they require approved LinkedIn partner access to `r_basicprofile` or private API permissions. The CONTEXT.md decision to "attempt the API and fall back gracefully" is the correct approach. In practice for most apps, the import will only return name + headline, prompting the user to upload their CV instead.

RS256 migration in `@nestjs/jwt` is straightforward: change `JwtModule.registerAsync` to pass `privateKey` + `publicKey` (PEM strings from env vars) with `signOptions: { algorithm: 'RS256' }`. The `JwtStrategy` must switch from `secretOrKey` to `secretOrKeyProvider` or pass the public key directly. Both the `AuthModule` and `JwtStrategy` need updating; the global guard remains unchanged.

**Primary recommendation:** Build in this order — RS256 migration first (unblocks all protected routes), then `ProfilesModule` (CV upload + LinkedIn import + editable profile), then `UsersController` additions (PATCH /users/me, presets CRUD). This order respects dependencies and allows incremental testing.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/jwt` | ^10.2.0 (installed) | JWT sign/verify with RS256 | Official NestJS JWT module; already in package.json |
| `passport-jwt` | ^4.0.1 (installed) | JWT extraction from Bearer header | Already wired in JwtStrategy |
| `@nestjs/mongoose` | ^10.0.6 (installed) | Mongoose ODM integration | Already used for User schema |
| `mongoose` | ^8.4.1 (installed) | Schema definition + queries | Already in production use |
| `multer` | bundled with `@nestjs/platform-express` | Multipart file upload | NestJS built-in; no extra install |
| `@job-agent/cv-parser` | workspace `*` | PDF → ProfessionalProfile | Already implemented; just wire it |
| `class-validator` | ^0.15.1 (installed) | DTO validation | Already installed |
| `class-transformer` | ^0.5.1 (installed) | DTO transformation | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `crypto` (built-in) | — | RS256 key pair: `createPrivateKey()`, `createPublicKey()` | Used in `JwtModule.registerAsync` for performance |
| `@nestjs/config` | ^3.2.2 (installed) | Read env vars in registerAsync | Already used in app.module.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| memoryStorage for CV upload | diskStorage | memoryStorage simpler; CV goes straight to cv-parser as Buffer, no temp file cleanup needed; PDFs ≤ 10MB fit in RAM easily |
| Env var PEM (base64-encoded) | File path or MongoDB | Env var is 12-factor; file path requires fs access in containers; MongoDB adds round-trip; env var wins for MVP |
| `passport-jwt` secretOrKey | secretOrKeyProvider | secretOrKey is simpler and sufficient when key is static; secretOrKeyProvider needed for multi-key rotation (Phase 2 doesn't need rotation) |

**Installation (nothing new needed):**
```bash
# All required packages already installed in apps/api/package.json
# No additional npm install required for Phase 2
```

---

## Architecture Patterns

### Recommended Project Structure

Phase 2 adds two new modules and extends one existing module:

```
apps/api/src/
├── modules/
│   ├── auth/                         # EXISTS — migrate to RS256
│   │   ├── auth.module.ts            # UPDATE: JwtModule RS256 config
│   │   ├── auth.service.ts           # NO CHANGE (token issuance already works)
│   │   └── strategies/
│   │       └── jwt.strategy.ts       # UPDATE: secretOrKey → publicKey
│   ├── users/                        # EXISTS — add PATCH /me + presets
│   │   ├── users.module.ts           # UPDATE: export UsersService for ProfilesModule
│   │   ├── users.controller.ts       # NEW: PATCH /users/me, presets CRUD
│   │   ├── users.service.ts          # UPDATE: add updateProfile(), preset methods
│   │   └── schemas/
│   │       ├── user.schema.ts        # UPDATE: add language field, activePresetId
│   │       └── search-preset.schema.ts  # NEW
│   └── profiles/                     # NEW MODULE
│       ├── profiles.module.ts        # NEW
│       ├── profiles.controller.ts    # NEW: GET/PATCH /profiles/me, POST /profiles/me/cv, POST /profiles/me/import-linkedin
│       ├── profiles.service.ts       # NEW
│       └── schemas/
│           └── user-profile.schema.ts  # NEW: mirrors ProfessionalProfile
├── common/
│   ├── crypto/
│   │   └── token-cipher.ts           # NO CHANGE (used in Phase 2 for LinkedIn token decrypt)
│   └── guards/
│       └── jwt-auth.guard.ts         # NO CHANGE (already handles RS256 transparently)
└── app.module.ts                     # UPDATE: add ProfilesModule
```

### Pattern 1: RS256 JWT Migration

**What:** Replace `secret` with `privateKey`/`publicKey` (PEM) in `JwtModule.registerAsync`. Store PEM keys as base64-encoded env vars decoded at runtime.

**When to use:** Any time asymmetric signing is needed (NF-07 requirement).

**Key generation (one-time, developer runs locally):**
```bash
# Generate 2048-bit RSA private key
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048
# Extract public key
openssl rsa -in private_key.pem -pubout -out public_key.pem
# Base64-encode for env var (no newlines)
base64 -w 0 private_key.pem  # → JWT_PRIVATE_KEY value
base64 -w 0 public_key.pem   # → JWT_PUBLIC_KEY value
```

**auth.module.ts update:**
```typescript
// Source: https://github.com/nestjs/jwt + official @nestjs/jwt docs
import { createPrivateKey, createPublicKey } from 'crypto';

JwtModule.registerAsync({
  useFactory: () => {
    const privateKeyPem = Buffer.from(
      process.env['JWT_PRIVATE_KEY'] ?? '', 'base64'
    ).toString('utf8');
    const publicKeyPem = Buffer.from(
      process.env['JWT_PUBLIC_KEY'] ?? '', 'base64'
    ).toString('utf8');

    return {
      privateKey: createPrivateKey(privateKeyPem),
      publicKey: createPublicKey(publicKeyPem),
      signOptions: { algorithm: 'RS256', expiresIn: '24h' },
    };
  },
}),
```

**jwt.strategy.ts update:**
```typescript
// Replace secretOrKey with publicKey
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: Buffer.from(
    process.env['JWT_PUBLIC_KEY'] ?? '', 'base64'
  ).toString('utf8'),
  algorithms: ['RS256'],
});
```

### Pattern 2: ProfilesModule with NestJS Module Pattern

**What:** Standard NestJS module with controller, service, schema — follows the same structure as the existing `users` module.

**When to use:** Any new domain-bounded feature.

**ProfilesController routes:**
```typescript
GET    /profiles/me                    // fetch current user's profile
PATCH  /profiles/me                    // partial update (editable fields)
POST   /profiles/me/cv                 // CV upload (multipart/form-data)
POST   /profiles/me/import-linkedin    // trigger LinkedIn API import
```

**CV upload with memoryStorage:**
```typescript
// Source: NestJS official docs — file upload
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Post('me/cv')
@UseInterceptors(FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new BadRequestException('Only PDF files are accepted'), false);
      return;
    }
    cb(null, true);
  },
}))
async uploadCv(
  @Req() req: AuthenticatedRequest,
  @UploadedFile() file: Express.Multer.File,
): Promise<UserProfileDocument> {
  return this.profilesService.uploadCv(req.user._id.toString(), file.buffer);
}
```

**ProfilesService.uploadCv:**
```typescript
async uploadCv(userId: string, buffer: Buffer): Promise<UserProfileDocument> {
  // Write buffer to a temp path, call runCvParser, delete temp file
  const tmpPath = `/tmp/cv-${userId}-${Date.now()}.pdf`;
  await fs.writeFile(tmpPath, buffer);
  try {
    const profile = await runCvParser(tmpPath);
    return this.upsertProfile(userId, profile);
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}
```

### Pattern 3: Row-Level Security in MongoDB Queries

**What:** Every query in `ProfilesService` and preset methods must filter by `userId`.

**When to use:** All Phase 2 data access — non-negotiable (NF-08).

```typescript
// CORRECT — always scope to userId
await this.profileModel.findOneAndUpdate(
  { userId },          // ← row-level filter ALWAYS first
  { $set: update },
  { upsert: true, new: true }
);

// WRONG — missing userId filter
await this.profileModel.findById(id);  // ← exposes cross-user risk
```

### Pattern 4: Search Presets CRUD with 5-preset cap

**What:** Preset array stored on User document (or separate collection). Service enforces max-5 before insert.

**Recommendation (Claude's Discretion):** Store presets as an embedded array on the User document. Simpler than a separate collection for 5 items max.

```typescript
// user.schema.ts addition
@Prop({
  type: [{
    id: { type: String, required: true },       // nanoid() or uuid
    name: { type: String, required: true, maxlength: 50 },
    config: { type: Object, required: true },   // SearchPresetConfig shape
    createdAt: { type: Date, required: true },
  }],
  default: [],
  validate: (v: unknown[]) => v.length <= 5,   // max-5 enforced at schema level
})
presets!: StoredPreset[];

@Prop()
activePresetId?: string;
```

### Anti-Patterns to Avoid

- **RS256 key as plain string without createPrivateKey():** `@nestjs/jwt` accepts raw PEM strings, but using `createPrivateKey()` / `createPublicKey()` from Node.js `crypto` is recommended for performance (avoids re-parsing on every sign operation).
- **Storing RSA private key in MongoDB:** Private key must never be persisted in a database — env var only.
- **Using JWT_SECRET after RS256 migration:** The `jwt.strategy.ts` must be updated simultaneously with `auth.module.ts`. A mismatch will cause all existing tokens to fail verification with algorithm mismatch.
- **Keeping `!**/modules/auth/**` exclusion in jest.config.ts:** Phase 1 excluded auth/users from coverage. Phase 2 must remove these exclusions and add real tests.
- **Calling `runCvParser` with a file path that no longer exists:** Always use `try/finally` to delete the temp file after parsing, even on error.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT asymmetric signing | Custom RS256 sign/verify | `@nestjs/jwt` with `privateKey`/`publicKey` | Handles algorithm headers, expiry, payload encoding correctly |
| PDF multipart upload | Custom body-parser | NestJS `FileInterceptor` + multer | Handles chunked transfers, file size limits, MIME validation |
| CV parsing from PDF | Custom Claude prompt | `runCvParser()` from `@job-agent/cv-parser` | Already implemented, tested, and handles Claude fallback |
| Token encryption | Custom AES | `encryptToken()` / `decryptToken()` from `token-cipher.ts` | Already in use; consistent key management via `TOKEN_CIPHER_KEY` |
| LinkedIn token decrypt before API call | Inline decrypt | `decryptToken()` from `token-cipher.ts` | `linkedinAccessToken` stored encrypted; must decrypt before use |
| DTO validation | Manual `if` checks | `class-validator` + `ValidationPipe` | Already installed; use `@IsString()`, `@IsArray()`, `@IsEnum()`, `@IsOptional()` |

**Key insight:** All the hard pieces — token cipher, CV parser, JWT infrastructure, OAuth strategies — are already built. Phase 2 is wiring, not building from scratch.

---

## Common Pitfalls

### Pitfall 1: LinkedIn OIDC Userinfo Returns Only Lite Profile

**What goes wrong:** Code calls `GET https://api.linkedin.com/v2/userinfo` expecting work experience, education, and skills — gets only `{sub, name, given_name, family_name, picture, email, locale}`.

**Why it happens:** LinkedIn OIDC `userinfo` endpoint only returns OIDC standard claims. Extended profile data (`r_basicprofile` fields including positions, educations, skills) requires LinkedIn partner program approval — not self-service.

**How to avoid:** Build the import service to always handle partial data. Map OIDC response to what's available (name, headline from `profile` — but even headline is NOT in the OIDC userinfo; it's only in `GET /v2/me` with `r_basicprofile`). The import flow must:
1. Call OIDC userinfo → get name, email, picture
2. Optionally call `GET /v2/me` with the stored OIDC token — may return `localizedHeadline` if `r_basicprofile` is approved
3. Attempt `GET /v2/positions`, `GET /v2/educations` etc. — will 403 for most apps
4. Show partial import summary regardless of outcome

**Warning signs:** 403 responses from any LinkedIn v2 API beyond `/v2/userinfo`. Treat 403 as expected, not as an error.

### Pitfall 2: JWT Algorithm Mismatch After RS256 Migration

**What goes wrong:** `auth.module.ts` updated to RS256, but `jwt.strategy.ts` still has `secretOrKey: process.env['JWT_SECRET']`. All token validation fails with `invalid signature` or `invalid algorithm`.

**Why it happens:** These two files must be updated atomically. The strategy validates with a different algorithm than what signed the token.

**How to avoid:** Update both files in the same task/commit. Add `algorithms: ['RS256']` explicitly to the strategy's `super()` call. Invalidate all existing HS256 tokens by bumping the JWT secret (or just accepting that all users must re-login after deploy).

**Warning signs:** `401 Unauthorized` on all protected routes after RS256 migration. Check `jwt.strategy.ts` constructor.

### Pitfall 3: Coverage Exclusions Not Updated in jest.config.ts

**What goes wrong:** Phase 1 excluded `!**/modules/auth/**` and `!**/modules/users/**` from coverage. These exclusions remain in Phase 2, meaning new auth/users/profiles code never counts toward the 70% coverage gate — CI passes but coverage is false.

**Why it happens:** jest.config.ts exclusion list was intentional for Phase 1, but must be revisited for Phase 2.

**How to avoid:** Remove `!**/modules/auth/**` and `!**/modules/users/**` from `collectCoverageFrom`. Add `!**/modules/profiles/**` exclusions only for files you deliberately defer (none in Phase 2).

**Warning signs:** CI passes coverage but new modules have 0% visible test coverage.

### Pitfall 4: PEM Key Newlines Stripped in .env

**What goes wrong:** RSA PEM keys have literal newlines. `.env` files don't handle multiline values reliably. Key stored as single line breaks signature validation.

**Why it happens:** PEM format requires `-----BEGIN...-----\n[base64 lines]\n-----END...-----`. If newlines are stripped, `createPrivateKey()` throws `ERR_OSSL_PEM_NO_START_LINE`.

**How to avoid:** Store keys as base64-encoded blobs in `.env` (single-line), decode to PEM at runtime in `JwtModule.registerAsync`. This is the recommended pattern.

```bash
# .env
JWT_PRIVATE_KEY=<base64 encoded PEM, no newlines>
JWT_PUBLIC_KEY=<base64 encoded PEM, no newlines>
```

**Warning signs:** `Error: error:0909006C:PEM routines:get_name:no start line` on API startup.

### Pitfall 5: Profile Upsert Missing userId Index

**What goes wrong:** `UserProfileSchema` created without a unique index on `userId`. `findOneAndUpdate({ userId })` with `upsert: true` creates duplicate profiles if called concurrently.

**Why it happens:** Mongoose `upsert: true` is not atomic across concurrent requests without a unique index.

**How to avoid:** Add `UserProfileSchema.index({ userId: 1 }, { unique: true })` after schema creation. One profile per user enforced at DB level, not just application level.

**Warning signs:** Duplicate profile documents in the `profiles` collection when a user uploads CV and imports LinkedIn simultaneously.

---

## Code Examples

Verified patterns from the existing codebase and official sources:

### Logger Injection Pattern (follows existing codebase)
```typescript
// Source: apps/api/src/modules/logger/logger.module.ts — established pattern
import { Inject } from '@nestjs/common';
import type { Logger } from 'winston';
import { LOGGER } from '../logger/logger.constants.js';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(UserProfile.name) private readonly profileModel: Model<UserProfileDocument>,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}
}
```

### RS256 JwtModule Configuration
```typescript
// Source: @nestjs/jwt docs + verified pattern
import { createPrivateKey, createPublicKey } from 'crypto';

JwtModule.registerAsync({
  useFactory: () => {
    const privPem = Buffer.from(process.env['JWT_PRIVATE_KEY'] ?? '', 'base64').toString('utf8');
    const pubPem  = Buffer.from(process.env['JWT_PUBLIC_KEY']  ?? '', 'base64').toString('utf8');
    return {
      privateKey: createPrivateKey(privPem),
      publicKey:  createPublicKey(pubPem),
      signOptions: { algorithm: 'RS256', expiresIn: '24h' },
    };
  },
}),
```

### JwtStrategy RS256 Update
```typescript
// Update to src/modules/auth/strategies/jwt.strategy.ts
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: Buffer.from(process.env['JWT_PUBLIC_KEY'] ?? '', 'base64').toString('utf8'),
  algorithms: ['RS256'],
});
```

### UserProfileSchema (mirrors ProfessionalProfile from packages/core)
```typescript
// New file: apps/api/src/modules/profiles/schemas/user-profile.schema.ts
@Schema({ timestamps: true, collection: 'profiles' })
export class UserProfile {
  @Prop({ required: true, index: true, unique: true })
  userId!: string;

  @Prop({ required: true }) fullName!: string;
  @Prop({ required: true }) email!: string;
  @Prop() phone?: string;
  @Prop() location?: string;
  @Prop() linkedinUrl?: string;
  @Prop({ required: true }) headline!: string;
  @Prop({ required: true }) summary!: string;
  @Prop({ required: true, enum: ['Junior','Mid','Senior','Lead','Principal','Executive'] })
  seniority!: string;
  @Prop({ required: true }) yearsOfExperience!: number;
  @Prop({ type: [String], default: [] }) skills!: string[];
  @Prop({ type: [String], default: [] }) techStack!: string[];
  @Prop({ type: [Object], default: [] }) languages!: LanguageEntry[];
  @Prop({ type: [Object], default: [] }) experience!: WorkExperienceEntry[];
  @Prop({ type: [Object], default: [] }) education!: EducationEntry[];
}
export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
UserProfileSchema.index({ userId: 1 }, { unique: true });
```

### LinkedIn API Import with Graceful Degradation
```typescript
// ProfilesService.importFromLinkedin() — partial import pattern
async importFromLinkedin(userId: string, encryptedToken: string): Promise<ImportResult> {
  const accessToken = decryptToken(encryptedToken);
  const imported: string[] = [];
  const missing: string[] = [];

  // OIDC userinfo — always succeeds if token is valid
  const userinfo = await this.fetchLinkedInUserinfo(accessToken);
  const partial: Partial<ProfessionalProfile> = {
    fullName: userinfo.name ?? '',
    email: userinfo.email ?? '',
  };
  imported.push('name');
  if (userinfo.email) imported.push('email');

  // Attempt v2/me for headline — may return 403 for non-partner apps
  try {
    const me = await this.fetchLinkedInMe(accessToken);
    if (me.localizedHeadline) {
      partial.headline = me.localizedHeadline;
      imported.push('headline');
    }
  } catch {
    missing.push('headline');
  }

  // Extended fields — will 403 for non-partner apps
  // (work experience, education, skills, languages)
  // ... each wrapped in try/catch, failure → push to missing[]

  return { profile: await this.upsertProfile(userId, partial), imported, missing };
}
```

### Incomplete Profile Check
```typescript
// ProfilesService.checkCompleteness()
checkCompleteness(profile: UserProfileDocument | null): string[] {
  const missing: string[] = [];
  if (!profile) return ['entire profile'];
  if (!profile.skills?.length) missing.push('skills');
  if (!profile.yearsOfExperience) missing.push('years of experience');
  if (!profile.experience?.length) missing.push('work experience');
  return missing;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HS256 symmetric JWT | RS256 asymmetric JWT (Phase 2) | Phase 1→2 boundary | Any service can verify tokens with public key only |
| JWT_SECRET string | JWT_PRIVATE_KEY + JWT_PUBLIC_KEY PEM (base64) | Phase 2 | Both env vars required in .env; JWT_SECRET can be removed |
| `passport-linkedin-oauth2` (deprecated v1 API) | `passport-oauth2` + OIDC userinfo | Phase 1 (already done) | Current implementation is correct |
| CV stored as file path | Buffer → cv-parser → discard | Phase 2 decision | No file persistence; parse-once-and-discard pattern |

**Deprecated/outdated:**
- `JWT_SECRET` env var: replaced by `JWT_PRIVATE_KEY` + `JWT_PUBLIC_KEY` in Phase 2. Keep in `.env.example` with a deprecation note until migration confirmed.
- LinkedIn `r_liteprofile` + `r_emailaddress` scopes: deprecated; already migrated to OIDC `openid profile email` in Phase 1.

---

## Open Questions

1. **LinkedIn work experience/education — partner access**
   - What we know: OIDC userinfo only returns lite profile (name, email, picture, locale). Extended fields require LinkedIn partner program.
   - What's unclear: Whether the app will ever be approved as a LinkedIn partner for extended data.
   - Recommendation: Build the import service to expect only lite fields for the MVP. The "partial import summary" UX from CONTEXT.md is the right default. The import architecture should be designed to handle the full data set IF partner access is ever granted, without requiring a rewrite.

2. **Preset storage: embedded array on User vs separate Presets collection**
   - What we know: Up to 5 presets per user; CRUD needed.
   - What's unclear: Whether Mongoose `validate` on array length works reliably in concurrent upsert scenarios.
   - Recommendation (Claude's Discretion): Embedded array on User document for MVP simplicity. Add `validate: (v) => v.length <= 5` at schema level AND enforce in service layer before `$push`. This double-enforcement prevents race condition gaps.

3. **`AUTH-04` language preference field**
   - What we know: User can edit name, contact email, and platform language preference.
   - What's unclear: Where to store `language: 'en' | 'es'` — User document or Profile document.
   - Recommendation: Add `language` field to `User` schema (it's auth/account data, not profile data). `PATCH /users/me` endpoint on `UsersController`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 + ts-jest + @nestjs/testing |
| Config file | `apps/api/jest.config.ts` |
| Quick run command | `cd apps/api && npm test` |
| Full suite command | `cd apps/api && npm run test:cov` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | LinkedIn OAuth upserts user + issues RS256 JWT | unit | `npm test -- --testPathPattern=auth.service` | Wave 0 |
| AUTH-02 | Google OAuth upserts user + issues RS256 JWT | unit | `npm test -- --testPathPattern=auth.service` | Wave 0 |
| AUTH-03 | JwtAuthGuard passes valid RS256 JWT, rejects HS256 | unit | `npm test -- --testPathPattern=jwt-auth.guard` | Wave 0 |
| AUTH-04 | PATCH /users/me updates name/email/language | unit | `npm test -- --testPathPattern=users.service` | Wave 0 |
| PROF-01 | LinkedIn import returns partial summary on 403 | unit | `npm test -- --testPathPattern=profiles.service` | Wave 0 |
| PROF-02 | CV upload calls runCvParser with buffer, returns ProfessionalProfile | unit (mock cv-parser) | `npm test -- --testPathPattern=profiles.service` | Wave 0 |
| PROF-03 | PATCH /profiles/me applies partial update with userId filter | unit | `npm test -- --testPathPattern=profiles.service` | Wave 0 |
| PROF-04 | checkCompleteness returns missing field names | unit | `npm test -- --testPathPattern=profiles.service` | Wave 0 |
| SRCH-01 | POST /users/me/presets creates preset with all config fields | unit | `npm test -- --testPathPattern=users.service` | Wave 0 |
| SRCH-02 | 6th preset creation rejected; active preset switching works | unit | `npm test -- --testPathPattern=users.service` | Wave 0 |
| NF-03 | LinkedIn import returns in < 8s (network mocked) | unit (timing) | `npm test -- --testPathPattern=profiles.service` | Wave 0 |
| NF-08 | All profile/preset queries include userId filter | unit | `npm test -- --testPathPattern=profiles.service` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/api && npm test`
- **Per wave merge:** `cd apps/api && npm run test:cov`
- **Phase gate:** Full suite green with ≥70% coverage before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/modules/profiles/profiles.service.test.ts` — covers PROF-01 through PROF-04, NF-03, NF-08
- [ ] `apps/api/src/modules/users/users.service.test.ts` — covers AUTH-04, SRCH-01, SRCH-02
- [ ] `apps/api/src/modules/auth/auth.service.test.ts` — covers AUTH-01, AUTH-02, AUTH-03
- [ ] `apps/api/src/common/crypto/token-cipher.test.ts` — unit tests for encrypt/decrypt (excluded from Phase 1, required in Phase 2)
- [ ] **jest.config.ts update:** Remove `!**/modules/auth/**` and `!**/modules/users/**` exclusions from `collectCoverageFrom`; add `!**/modules/profiles/**` only if explicitly deferred (none should be)

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/api/src/` — all Phase 1 implementation files read directly
- `packages/core/src/types/cv.types.ts` — `ProfessionalProfile` interface structure
- `packages/cv-parser/src/index.ts` — `runCvParser()` API
- `apps/api/package.json` — installed dependency versions
- `apps/api/jest.config.ts` — coverage exclusions and test setup

### Secondary (MEDIUM confidence)
- [LinkedIn OIDC Sign In v2 official docs](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) — confirmed OIDC userinfo fields (name, email, picture, locale only)
- [LinkedIn Profile API official docs](https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api) — confirmed extended profile fields require partner approval
- [@nestjs/jwt GitHub](https://github.com/nestjs/jwt) — RS256 `privateKey`/`publicKey` configuration shape
- [NestJS file upload docs](https://deepwiki.com/nestjs/nest/9.3-file-upload-handling) — `FileInterceptor` + `memoryStorage` pattern

### Tertiary (LOW confidence — verify at implementation)
- [RS256 NestJS with env var base64](https://medium.com/@xjaroo.iphone/secure-jwt-auth-in-nestjs-with-rsa-key-from-env-e2b4120b4022) — base64 PEM in env var approach (community article, not official)
- LinkedIn r_basicprofile scope restrictions — multiple community sources agree; verify at app registration time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- RS256 migration pattern: HIGH — official @nestjs/jwt docs + Node.js crypto built-in
- LinkedIn API scope reality: HIGH — official Microsoft/LinkedIn docs confirm OIDC userinfo fields
- Architecture: HIGH — follows established module pattern from Phase 1 codebase
- Pitfalls: HIGH — derived from direct code inspection of Phase 1 implementation

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (LinkedIn API policy may change; check before implementation)
