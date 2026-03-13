# Architecture Patterns

**Domain:** Job Search Automation SaaS (CLI-to-Web Migration)
**Researched:** 2026-03-11
**Confidence:** HIGH — Based on direct codebase analysis (.planning/codebase/), requirements (PROJECT.md), and established NestJS patterns.

---

## Recommended Architecture

### Overview: NestJS Modular Monolith + Decoupled Playwright Workers

The recommended architecture is a **NestJS Modular Monolith** that acts as the HTTP/WS gateway and domain orchestrator, with **Playwright automation workers** decoupled via a **BullMQ job queue** (Redis-backed). The React frontend communicates exclusively through the NestJS API. The existing packages (`linkedin-mcp`, `cv-parser`, `job-search`, `ats-apply`, `reporter`) are consumed as internal libraries by the NestJS modules and workers — they are NOT rewritten.

```
+-------------------------------------------------------------+
|                  apps/web (React 18 + Vite)                 |
|   Zustand (UI state) + TanStack Query (server state)        |
|   EventSource listener for real-time session progress       |
+------------------------+------------------------------------+
                         |
                HTTP + SSE (EventSource)
                         |
+------------------------v------------------------------------+
|       apps/microservices/api/ (NestJS Modular Monolith)     |
|                                                             |
|  +--------+  +--------+  +----------+  +--------------+   |
|  |  Auth  |  | Users  |  |  Jobs    |  | Applications |   |
|  | Module |  | Module |  |  Module  |  |   Module     |   |
|  +--------+  +--------+  +----------+  +--------------+   |
|                                                             |
|  +------------------------------------------------------+  |
|  |           Sessions Module (SSE + BullMQ)             |  |
|  |  POST /sessions -> enqueue -> SSE /sessions/:id      |  |
|  +------------------------------------------------------+  |
+---------------------------+---------------------------------+
                            |
                    BullMQ (Redis)
                            |
+---------------------------v---------------------------------+
|              Playwright Worker Process(es)                  |
|  packages/linkedin-mcp  (runLinkedInAgent)                  |
|  packages/ats-apply     (applyToAts)                        |
|  packages/cv-parser     (runCvParser)                       |
|  packages/job-search    (runMultiPlatformSearch)            |
|  packages/reporter      (generateReport)                    |
|                                                             |
|  Emits: BullMQ progress events -> SSE bridge in NestJS     |
+---------------------------+---------------------------------+
                            |
              +-------------+--------------+
              |                            |
+-------------v-----------+  +------------v-----------+
|   MongoDB               |  |   Redis                |
|  (per-domain            |  |  - BullMQ queues       |
|   collections)          |  |  - Session state       |
|                         |  |  - Rate limit locks    |
+-------------------------+  +------------------------+
```

---

## Component Boundaries

### apps/web (React 18 + Vite)

| Responsibility | Details |
|----------------|---------|
| User authentication UI | OAuth redirect flows (LinkedIn, Google), JWT refresh |
| Configuration management | Search preferences form wired to `AppConfigType` |
| Session control | Start/stop agent run, real-time progress via SSE |
| History and reporting | Application history, filters, CSV export, report viewer |
| Profile management | CV upload, profile editing, skill visualization |

**Communicates with:** NestJS API only. No direct calls to packages or workers.
**Constraint:** Never import from packages directly. All data via HTTP + TanStack Query.

---

### apps/microservices/api/ — NestJS Modular Monolith

This is the new primary backend. The existing `packages/api` (Express) is superseded by this.

#### AuthModule

| Responsibility | Details |
|----------------|---------|
| OAuth strategies | Passport LinkedIn OAuth2, Passport Google OAuth2 |
| JWT issuance | Access tokens (15m) + refresh tokens (7d) stored in Redis |
| Guards | `JwtAuthGuard` applied globally; `OptionalJwtGuard` for public routes |
| Token refresh | `POST /auth/refresh` with sliding session |

**Communicates with:** UsersModule (lookup/create user on OAuth callback).

#### UsersModule

| Responsibility | Details |
|----------------|---------|
| User CRUD | Profile read/update (`ProfessionalProfileType`) |
| CV storage | GridFS or S3-compatible binary storage for uploaded CVs |
| Credential storage | LinkedIn credentials encrypted AES-256-GCM in MongoDB |
| Config persistence | Per-user `AppConfigType` stored in MongoDB (replaces `config.yaml`) |

**Communicates with:** AuthModule (user lookup), SessionsModule (passes user credentials to worker).

#### JobsModule

| Responsibility | Details |
|----------------|---------|
| Job search results | Store and query `JobListingType[]` per user/session |
| Deduplication | Cross-session job ID deduplication via MongoDB unique indexes |
| Compatibility scoring | Exposes scored job lists; scoring computed by worker |
| Job dismissal | Manual dismiss endpoint (`PATCH /jobs/:id/dismiss`) |

**Communicates with:** SessionsModule (receives job events from workers), ApplicationsModule.

#### ApplicationsModule

| Responsibility | Details |
|----------------|---------|
| Application history | Persistent `ApplicationRecordType[]` per user |
| Status management | Manual status update endpoint |
| CSV export | Streams `ApplicationRecord[]` as CSV |
| Deduplication check | Guards against duplicate apply attempts |

**Communicates with:** JobsModule (job references), SessionsModule (receives applied events).

#### SessionsModule

| Responsibility | Details |
|----------------|---------|
| Session lifecycle | Create session, validate pre-conditions, enqueue to BullMQ |
| SSE streaming | `GET /sessions/:id/events` — SSE endpoint replaying progress from MongoDB |
| Progress persistence | Write progress events to MongoDB (not in-memory) |
| Rate limit enforcement | Redis-backed global apply rate limiter per user credential pair |
| CAPTCHA handling | Detect `captcha_detected` event, pause session, notify user via SSE |

**Communicates with:** All domain modules (writes jobs/applications as events arrive), BullMQ workers.

---

### Playwright Workers (Separate Process)

**Critical architectural decision:** Playwright workers MUST run in a separate Node.js process, not inside NestJS request handlers.

**Why:** Playwright opens a Chromium browser per session (~200MB RAM). If run inside NestJS, a crashed browser takes down the API server. Decoupling via BullMQ means:
- NestJS stays alive if Playwright crashes.
- Workers restart independently without affecting active HTTP connections.
- Multiple workers scale horizontally within LinkedIn rate limit constraints.

The NestJS API and the Playwright worker are separate Node.js processes sharing only Redis.

```
apps/microservices/api/src/main.ts         -> API server (port 4000)
apps/microservices/api/src/worker.main.ts  -> Worker process (no HTTP server)
```

The worker process bootstraps a minimal NestJS app with only `SessionsWorkerModule` (no HTTP adapter). It uses `@nestjs/bullmq` processors to call the existing package functions.

Worker job payload:

```typescript
interface SessionJobPayload {
  sessionId: string;
  userId: string;
  config: AppConfigType;
  cvObjectKey: string;          // GridFS / S3 key for uploaded CV
  linkedinCredentials: {        // Decrypted just-in-time, never persisted
    email: string;
    password: string;
  };
}
```

Worker emits progress via BullMQ's built-in `job.updateProgress()`. SessionsModule listens to these BullMQ events and bridges them to SSE clients.

**Maximum concurrency:** 2-3 Playwright workers simultaneously. More than 4 risks LinkedIn anti-bot detection across all users. Enforced via BullMQ queue `concurrency` setting.

---

### packages/ (Existing — Consumed as Libraries)

These packages are NOT rewritten. They are imported by NestJS modules and the worker process.

| Package | Consumed by | Migration notes |
|---------|-------------|-----------------|
| `packages/core` | Every module | Single source of truth for types — no changes needed |
| `packages/logger` | All NestJS modules + workers | Already factory-based; wire correlationId + userId via NestJS context |
| `packages/cv-parser` | Worker (pipeline step 3) | Add GridFS/S3 buffer input; remove file-path dependency |
| `packages/job-search` | Worker (pipeline step 5) | No changes needed |
| `packages/linkedin-mcp` | Worker (pipeline step 7) | Inject credentials from payload; remove `.env` dependency |
| `packages/ats-apply` | Worker (pipeline step 7) | No changes needed |
| `packages/reporter` | Worker (pipeline step 8) | Write output to MongoDB document, not `output/` directory |

---

### MongoDB Collections (Per-Domain Namespacing)

Single MongoDB instance for the Modular Monolith. Collections namespaced by domain module. No cross-module collection reads — services are the only access point.

| Collection | Owner Module | Key fields |
|------------|-------------|------------|
| `users` | UsersModule | `_id`, `email`, `oauthProviders`, `profile`, `configPresets`, `linkedinCredentials` (encrypted) |
| `sessions` | SessionsModule | `_id`, `userId`, `status`, `config`, `progressEvents[]`, `createdAt`, `completedAt` |
| `jobs` | JobsModule | `_id`, `sessionId`, `userId`, `platformJobId` (unique per platform+user), `listing`, `score`, `dismissed` |
| `applications` | ApplicationsModule | `_id`, `sessionId`, `userId`, `jobId`, `status`, `method`, `appliedAt`, `confirmationId` |

**Row-level security:** Every query MUST include a `userId` filter. NestJS guards inject `userId` from the validated JWT. Services receive it as an explicit parameter — never trust the request body for `userId`.

---

### Redis Usage

| Use case | Key pattern | TTL |
|----------|-------------|-----|
| JWT refresh tokens | `refresh:{userId}:{tokenId}` | 7 days |
| BullMQ job queues | Managed by BullMQ internally | N/A |
| Apply rate limiter | `ratelimit:apply:{linkedinEmail}` | 12 seconds |
| Active session lock | `session:lock:{userId}` | 24 hours |
| SSE client registry | In-memory Map in NestJS process | N/A (process-scoped) |

---

## Data Flow

### 1. Authentication Flow

```
Browser -> GET /auth/linkedin
        -> NestJS AuthModule -> Passport LinkedIn OAuth2 strategy
        -> LinkedIn callback -> AuthModule.validateOAuthUser()
        -> UsersModule.findOrCreate(oauthProfile)
        -> JWT issued (access + refresh) stored in Redis
        -> Browser receives tokens (HttpOnly cookie + Authorization header)
```

### 2. Session Start Flow (Agent Run)

```
Browser -> POST /sessions { configOverrides? }
        -> JwtAuthGuard validates token, injects userId
        -> SessionsModule.createSession(userId, config)
        -> Writes session document to MongoDB (status: 'pending')
        -> Enqueues BullMQ job with SessionJobPayload
        -> Returns { sessionId } immediately (202 Accepted)

Browser -> GET /sessions/:id/events (SSE / EventSource)
        -> SessionsModule SSE handler
        -> Replays buffered progressEvents[] from MongoDB (late-join safe)
        -> Keeps connection open, pushes new events as worker emits them
```

### 3. Worker Pipeline (Async, Isolated Process)

```
BullMQ dequeues session job
Worker starts:
  Step 1: Load config from payload (no file I/O; config from MongoDB)
  Step 2: Fetch CV buffer from GridFS/S3 using cvObjectKey
  Step 3: runCvParser(cvBuffer) -> ProfessionalProfile
  Step 4: runMultiPlatformSearch(config, profile) -> JobListing[]
          -> for each job found:
             emit progress event -> persisted to MongoDB + forwarded to SSE bridge
  Step 5: rankJobs(jobs, profile) -> scored JobListing[]
          -> persist jobs to MongoDB (JobsModule collection)
  Step 6: Filter jobs above config.matching.minScoreToApply
  Step 7: runLinkedInAgent(filteredJobs, credentials, config)
          -> for each application attempt:
             acquire Redis rate limit lock (12s window per credential pair)
             emit job_applying / job_applied / job_failed events
             persist ApplicationRecord to MongoDB
  Step 8: generateReport(session) -> stored in MongoDB session document
          -> emit session_complete event

On CAPTCHA detected:
  -> emit captcha_detected event -> SSE bridge -> browser alert
  -> update session status: 'paused_captcha' in MongoDB
  -> BullMQ job moves to 'delayed' state (retry after 10 minutes)

On unhandled error:
  -> emit session_error event with message
  -> update session status: 'failed' in MongoDB
  -> BullMQ marks job as failed (visible in BullMQ dashboard)
```

### 4. Real-Time SSE Bridge

```
BullMQ worker:
  job.updateProgress({ type: 'job_found', data: JobListingType })

NestJS SessionsModule BullMQ event listener (queue.on('progress')):
  -> Write event to MongoDB session.progressEvents[]
  -> Look up in-memory SSE client Map[sessionId]
  -> Push serialized event to all connected EventSource clients

Browser EventSource receives typed event:
  -> React updates TanStack Query cache (job found / applying / complete)
  -> Zustand sessionStore updates active session status badge
```

### 5. React Frontend Data Flow

```
Auth state:    Zustand authStore { user, accessToken }

Server state:  TanStack Query hooks
  useSession(id)           -> GET /sessions/:id
  useJobList(sessionId)    -> GET /jobs?sessionId=:id
  useApplicationHistory()  -> GET /applications
  useUserProfile()         -> GET /users/me

Real-time:     EventSource('/api/sessions/:id/events')
  -> On job_found:    invalidate useJobList query cache
  -> On job_applied:  invalidate useApplicationHistory query cache
  -> On session_complete / session_error: update Zustand sessionStore
```

---

## Build Order

The dependency graph between components enforces a strict phase sequence. Each phase unlocks the next.

### Phase 1: Foundation

**What:** NestJS app scaffold, MongoDB + Redis connectivity, shared types audit, structured logging wired to NestJS DI.

**Deliverables:**
- `apps/microservices/api/` bootstrapped with `AppModule`
- `@nestjs/mongoose` database connection
- `@nestjs/bullmq` queue registration
- `packages/logger` wired via `LoggerModule` into NestJS DI
- Any missing `packages/core` types added (SessionType, ProgressEventType)

**Why first:** Nothing else compiles without shared types and a working NestJS app with DB connectivity. This is the prerequisite for every module.

---

### Phase 2: Auth + Users

**What:** AuthModule (Passport + JWT), UsersModule (profile, CV storage, per-user config persistence).

**Dependencies:** Phase 1.

**Deliverables:**
- `POST /auth/linkedin` and `POST /auth/google` OAuth flows
- `POST /auth/refresh` token refresh
- `GET /users/me`, `PATCH /users/me` profile endpoints
- `POST /users/me/cv` CV upload to GridFS/S3
- Per-user `AppConfigType` stored in MongoDB (replaces `config.yaml`)

**Why second:** Every subsequent feature is user-scoped. Without authentication no route is safe to deploy. CV parsing (Phase 3) requires CV storage in UsersModule. Per-user config (Phase 3 onwards) requires UsersModule.

---

### Phase 3: Sessions Module + BullMQ Worker Scaffold

**What:** SessionsModule with session CRUD, BullMQ queue setup, SSE endpoint, and a worker process that runs a stub pipeline (logs steps, does not call Playwright yet).

**Dependencies:** Phase 1 + Phase 2.

**Deliverables:**
- `POST /sessions` enqueues BullMQ job, returns 202 with sessionId
- `GET /sessions/:id/events` SSE endpoint with MongoDB-backed replay
- Worker process bootstraps and processes queue (stub implementation)
- End-to-end SSE flow validated: enqueue -> worker progress -> SSE -> browser

**Why third:** This is the backbone of the automation product. Validating the async pipeline and SSE bridge with a stub worker is far safer than building it alongside live Playwright. All subsequent phases plug real pipeline steps into this scaffold.

---

### Phase 4: Pipeline — CV Parser + Job Search

**What:** Wire `packages/cv-parser` and `packages/job-search` into the worker. Persist jobs to JobsModule.

**Dependencies:** Phase 3 (worker scaffold).

**Deliverables:**
- Worker loads CV from GridFS/S3 and runs cv-parser
- Worker runs multi-platform search (LinkedIn, Indeed, Computrabajo)
- Scored `JobListing[]` persisted to MongoDB
- `GET /jobs?sessionId=:id` endpoint returning scored jobs
- Real-time `job_found` events visible in browser

**Why fourth:** These are non-destructive steps — no LinkedIn interaction. Safe to test and iterate. Validates the full data pipeline from CV upload to scored job list before automation risk is introduced.

---

### Phase 5: Application Automation

**What:** Wire `packages/linkedin-mcp` and `packages/ats-apply` into the worker. Persist applications to ApplicationsModule. Enforce Redis rate limits. Handle CAPTCHA pause.

**Dependencies:** Phase 4 (jobs exist before applying).

**Deliverables:**
- Worker applies to filtered jobs via Easy Apply and ATS handlers
- Redis rate limiter enforced (12s window per LinkedIn credential pair)
- `ApplicationRecord` persisted on each attempt (applied/failed/skipped)
- CAPTCHA detection pauses session, emits SSE event to browser
- `GET /applications` history endpoint with filters
- `PATCH /applications/:id` manual status update

**Why fifth:** Most complex and highest-risk step. LinkedIn credential handling, rate limiting, CAPTCHA, and multi-step form parsing all converge here. Building after the safer pipeline steps reduces the debugging surface area significantly.

---

### Phase 6: React Frontend

**What:** Replace vanilla `apps/ui` with React 18 + Vite. Wire all auth flows, dashboard, config form, application history, and real-time session view.

**Dependencies:** Phase 2 (auth endpoints), Phase 3 (SSE), Phase 4-5 (jobs/applications data).

**Deliverables:**
- OAuth login page (LinkedIn + Google)
- Dashboard with active session progress (SSE-driven)
- Configuration form wired to `AppConfigType`
- Job results list with score badges and dismiss controls
- Application history table with CSV export
- CV upload and profile editor

**Note:** Frontend development can begin in parallel with Phase 4-5 once the Phase 3 API contract (SSE event shapes, session endpoints) is stable. Full integration requires Phase 4-5 to complete.

---

### Phase 7: Reports + Export

**What:** Reporter integration writing to MongoDB. CSV/PDF export endpoints. Aggregated metrics dashboard.

**Dependencies:** Phase 4-5 (applications data), Phase 6 (UI to surface reports).

**Deliverables:**
- `packages/reporter` writing session report to MongoDB session document
- `GET /sessions/:id/report` returns HTML/Markdown report
- `GET /applications/export` streams CSV
- Metrics dashboard: total applications, success rate, top job titles

**Why last:** Reporting is read-only aggregation over data produced in earlier phases. No other phase depends on it. Safe to defer until core automation loop is proven.

---

## Patterns to Follow

### Pattern 1: Module-Scoped Mongoose Schemas

Each NestJS module registers only its own Mongoose schemas. Cross-module data access goes through the owning module's exported service — never via direct model injection.

```typescript
// applications.module.ts
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ApplicationRecord.name, schema: ApplicationRecordSchema }
    ])
  ],
  providers: [ApplicationsService],
  exports: [ApplicationsService]    // Export service, NOT the model
})
export class ApplicationsModule {}
```

### Pattern 2: Row-Level Security via Service Signature

Every service method that reads or writes user data takes `userId` as an explicit first parameter. Controllers extract `userId` from the JWT guard's decorator — never from the request body.

```typescript
// jobs.service.ts
async findBySession(userId: string, sessionId: string): Promise<JobListingType[]> {
  return this.jobModel.find({ userId, sessionId }).exec();
  //                          ^^^^^^ always scoped to authenticated user
}

// jobs.controller.ts
@Get()
findBySession(@GetUser('id') userId: string, @Query('sessionId') sessionId: string) {
  return this.jobsService.findBySession(userId, sessionId);
}
```

### Pattern 3: BullMQ SSE Bridge

BullMQ progress events are the single source of truth for session state. The SSE endpoint is a replay of MongoDB-persisted events plus a live push channel.

```typescript
// sessions.service.ts — wire BullMQ progress events on module init
onModuleInit() {
  this.queueEvents.on('progress', ({ jobId, data }) => {
    this.persistProgressEvent(jobId, data);     // write to MongoDB
    this.broadcastToSseClients(jobId, data);    // push to EventSource clients
  });
}
```

### Pattern 4: Credential Just-In-Time Decryption

LinkedIn credentials are stored AES-256-GCM encrypted in MongoDB. The worker decrypts them immediately before use and zeroes the plaintext after the session ends.

```typescript
// Inside worker processor
const raw = await this.cryptoService.decrypt(user.linkedinCredentials);
try {
  await runLinkedInAgent(jobs, raw, config);
} finally {
  raw.password = '';    // zero out immediately after use
}
```

### Pattern 5: Config in MongoDB, Not on Disk

The existing `AppConfigType` shape is preserved exactly. Only the storage mechanism changes — from `config.yaml` on disk to a `configPresets` field in the `users` collection.

```typescript
// users.service.ts
async getConfig(userId: string): Promise<AppConfigType> {
  const user = await this.userModel.findById(userId).select('configPresets').exec();
  return user.configPresets ?? DEFAULT_CONFIG_CONSTANT;
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Playwright Inside NestJS Request Handler

**What:** Calling `runLinkedInAgent()` or any Playwright function directly inside a NestJS controller or service that handles HTTP requests.

**Why bad:** A Playwright crash (browser timeout, CAPTCHA, OOM) kills the HTTP server process. All connected users lose their sessions and SSE connections simultaneously.

**Instead:** Always enqueue via BullMQ. The controller returns 202 Accepted with a sessionId. Playwright runs in the isolated worker process.

---

### Anti-Pattern 2: In-Memory Session State

**What:** Storing `SessionState`, progress event arrays, or SSE client maps as module-scope variables without Redis/MongoDB backing (the exact issue documented in CONCERNS.md).

**Why bad:** Server restart loses all session progress. Horizontal scaling causes split-brain — two API instances do not share in-memory state.

**Instead:** Progress events are written to MongoDB on every emit. SSE connections are in-memory per process (acceptable), but events are always replayed from MongoDB for new or reconnecting clients.

---

### Anti-Pattern 3: Cross-Module Model Imports

**What:** `ApplicationsModule` importing `JobModel` from `JobsModule` directly to query jobs inside its own service.

**Why bad:** Creates tight coupling. Makes future extraction to independent microservices impossible. Violates module boundary contract.

**Instead:** `ApplicationsModule` calls `JobsService.findById(jobId, userId)` via the exported and injected service. `JobsModule` exports only its service, never its Mongoose model.

---

### Anti-Pattern 4: Config.yaml as Persistence

**What:** Continuing to read/write user configuration from `config.yaml` on disk in the SaaS version.

**Why bad:** File-based config is not multi-tenant. Two users' configs overwrite each other. Impossible to support concurrent sessions.

**Instead:** Per-user config stored in `users.configPresets` in MongoDB. The `AppConfigType` shape is preserved — only the storage mechanism changes.

---

### Anti-Pattern 5: Output Directory as Database

**What:** Continuing to write `profile.json`, `jobs-found.json`, `applications.json` to `output/` in the SaaS deployment (the vulnerability documented in CONCERNS.md — static serve exposes all user data).

**Why bad:** Filesystem is not shared between server instances. No access control. No query capability. Race conditions when concurrent sessions write to the same directory.

**Instead:** All output persisted to MongoDB collections scoped by `userId` + `sessionId`. Report HTML/Markdown stored as a MongoDB document field or S3 object. The `output/` directory is retained for CLI-only (local) mode.

---

## Scalability Considerations

| Concern | At 10 users | At 100 users | At 1000 users |
|---------|-------------|--------------|---------------|
| Playwright workers | 2-3 concurrent (BullMQ concurrency=2) | Worker pool, 5-8 processes; rate limited per LinkedIn account | Multiple worker hosts; per-user LinkedIn accounts required |
| MongoDB | Single instance, no sharding | Add replica set for read scaling | Atlas sharding on `userId` |
| Redis | Single instance sufficient | Single instance sufficient | Redis Cluster for queue durability |
| NestJS API | Single process | Horizontal replicas behind load balancer | Stateless API scales freely; worker count is the constraint |
| SSE connections | In-process Map | Sticky sessions on load balancer | Redis Pub/Sub to broadcast SSE events across API instances |
| LinkedIn rate limits | 1 account, 25 apps/session enforced in Redis | Multiple accounts per user; Redis limiter enforced globally | Credential pool with health-check rotation |

**Binding constraint at all scales:** LinkedIn rate limits, not compute. Architecture must treat the LinkedIn credential + session as a scarce resource managed by the Redis rate limiter — not just a config value.

---

## Migration Strategy (CLI to SaaS — Zero Disruption)

The existing `packages/api` (Express, port 3000) and `apps/cli` continue to work unchanged. The NestJS Modular Monolith is a new app at `apps/microservices/api/` on port 4000. Both coexist during the transition.

```
Phase 1-5: NestJS API (port 4000) is built alongside Express (port 3000)
Phase 6:   React frontend (apps/web) wires to NestJS on port 4000
           Vanilla apps/ui continues pointing to Express on port 3000
Phase 7:   Once React frontend is fully functional:
           - packages/api (Express) is deprecated, not deleted
           - apps/ui is archived
           - apps/cli updated to call NestJS API or remain standalone for offline use
```

This preserves the working CLI tool throughout the build, allowing developers to validate automation logic locally while the SaaS layer is constructed.

---

## Sources

- `C:/Users/1234/OneDrive/Escritorio/claude/job-agent/.planning/PROJECT.md` — MVP requirements, tech stack constraints, key decisions (HIGH confidence)
- `C:/Users/1234/OneDrive/Escritorio/claude/job-agent/.planning/codebase/STACK.md` — Exact package versions, NestJS 10.x, BullMQ, Mongoose 8, Winston (HIGH confidence)
- `C:/Users/1234/OneDrive/Escritorio/claude/job-agent/.planning/codebase/CONCERNS.md` — In-memory session state debt, scaling limits, rate limiting gaps, security vulnerabilities (HIGH confidence)
- NestJS modular architecture and BullMQ queue patterns: training data aligned with NestJS 10.x official documentation patterns (MEDIUM confidence)
- LinkedIn rate limiting constraints (3-5s search scroll, 8-12s Easy Apply): directly observed in existing codebase implementation, non-negotiable per ToS (HIGH confidence)

---

*Architecture research: 2026-03-11*
