# Phase 3: Sessions + BullMQ - Research

**Researched:** 2026-03-17
**Domain:** NestJS BullMQ job queues, Redis Pub/Sub, Server-Sent Events, MongoDB embedded arrays
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Worker/API event bridge:** Redis Pub/Sub keyed by `session:{sessionId}:events`; Worker publishes, NestJS SSE endpoint subscribes. `ioredis` already installed; add a dedicated subscriber client (pub/sub requires separate connection from the general-purpose publisher).
- **Concurrent session policy:** One active session per user (MVP). `POST /sessions` while `status: running` exists → `409 Conflict` with `{ code: "SESSION_ALREADY_ACTIVE", sessionId }`. Statuses: `queued` → `running` → `completed` | `cancelled` | `failed`.
- **SSE replay strategy:** Session MongoDB document embeds `events` array (not a separate collection). Max 100 events per session (ring buffer). Each event: `{ id: number, type: string, data: object, timestamp: ISO string }`. `id` = monotonically increasing integer per session (starting at 1). On reconnect with `Last-Event-ID: N`: replay all stored events where `event.id > N`, then switch to live pub/sub. No TTL — sessions kept indefinitely.
- **Event schema:** Locked in Phase 3 in `packages/core/src/types/session.types.ts`. Types: `session_started`, `job_found`, `job_skipped`, `application_made`, `session_complete`, `session_error`, `captcha_detected`. Phase 4 replaces stub data, not the schema.
- **BullMQ worker design:** Single `search-session` queue; worker concurrency = 2. Worker is a separate Node.js process (not a NestJS child module). Job payload: `{ sessionId: string, userId: string }` only. Worker reads config from MongoDB. Worker publishes to Redis channel `session:{sessionId}:events` as JSON strings.

### Claude's Discretion

- BullMQ job retry strategy (backoff, max attempts) for failed sessions
- Exact Mongoose schema for Session document (indexes, field ordering)
- NestJS SSE endpoint implementation pattern (@Sse decorator vs raw res.write)
- Redis subscriber connection management (reconnect on failure)
- Mock data generator implementation (static fixtures vs faker.js)

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RT-01 | Session search progress updates in real time in the UI (jobs found, applications made) via SSE without manual polling | NestJS @Sse + Observable pattern, Redis Pub/Sub subscriber, MongoDB event replay on reconnect |
| NF-05 | System supports 100 concurrent users running searches without degradation; p99 < 3s response time | BullMQ worker isolation (separate process), Redis Pub/Sub per-session channels, concurrency=2 worker limit, SSE cleanup on disconnect |
</phase_requirements>

---

## Summary

Phase 3 builds the real-time infrastructure that all subsequent phases depend on: a session lifecycle system backed by BullMQ, a Redis Pub/Sub bridge from worker to API, and an SSE endpoint with Last-Event-ID replay from MongoDB. The actual search and application logic is deferred to Phases 4-5; Phase 3 delivers a stubbed pipeline with realistic mock data so the React frontend (Phase 6) can be fully built against the locked event schema.

The three non-trivial engineering problems are: (1) keeping the BullMQ worker process fully isolated from the NestJS API process so a Playwright crash cannot take down the API; (2) implementing SSE connection management that handles the NestJS `@Sse` decorator's known limitations around error handling and cleanup; and (3) implementing the MongoDB ring-buffer update (MongoDB `$push` + `$slice: -100`) that persists events for replay without unbounded array growth.

The existing codebase already provides `ioredis` (v5.3.2), `rxjs` (v7.8.1), `@nestjs/mongoose`, and a global `REDIS_CLIENT` injection token — all reused directly. The only new dependency is `@nestjs/bullmq` + `bullmq`.

**Primary recommendation:** Use `@nestjs/bullmq` (v11.x) for queue registration in NestJS and a standalone `apps/api/src/workers/search-session.worker.ts` entry point spawned via `child_process.fork` from the NestJS `OnModuleInit` lifecycle hook. Use raw `res.write` SSE (not `@Sse` decorator) for full control over Last-Event-ID and connection close handling.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `bullmq` | 5.71.0 | Job queue backed by Redis streams | Industry standard for Node.js background jobs; robust retry, concurrency, stalled-job detection |
| `@nestjs/bullmq` | 11.0.4 | BullMQ integration with NestJS DI | Official NestJS package: `BullModule.forRoot`, `@Processor`, `WorkerHost` |
| `ioredis` | 5.3.2 (already installed) | Redis client for pub/sub subscriber + publisher | Already in `apps/api/package.json`; pub/sub requires a dedicated connection separate from the general client |
| `rxjs` | 7.8.1 (already installed) | Observable streams for SSE | Already in NestJS; `Subject` + `takeUntil` + `finalize` for SSE lifecycle management |
| `mongoose` / `@nestjs/mongoose` | already installed | Session document persistence with ring-buffer events | `$push` + `$slice: -100` update for bounded events array |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@faker-js/faker` | latest | Realistic mock job data for stub pipeline | Claude's Discretion: faker preferred over static fixtures because it produces varied realistic data that exercises the frontend schema fully |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Redis Pub/Sub bridge | BullMQ `QueueEvents` (Redis Streams) | QueueEvents provides delivery guarantees but couples worker-to-API event flow through the queue layer; Pub/Sub is simpler for per-session fan-out and matches the locked decision |
| Separate worker process (`child_process.fork`) | BullMQ sandboxed processors (Worker class + file path) | Sandboxed processors auto-respawn but add complexity; manual fork gives explicit control over lifecycle and graceful shutdown signaling |
| Raw `res.write` SSE | `@Sse` decorator + `Observable` return | `@Sse` has documented issues (empty initial message, no error code on HttpException, connection established before validation); raw `res.write` is the NestJS maintainer-recommended approach for production SSE |

**Installation (new dependencies only):**
```bash
npm install -w apps/api @nestjs/bullmq bullmq
npm install -w apps/api @faker-js/faker
```

**Version verification (confirmed 2026-03-17):**
```
@nestjs/bullmq  11.0.4   (npm view @nestjs/bullmq version)
bullmq          5.71.0   (npm view bullmq version)
```

---

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── modules/
│   ├── sessions/
│   │   ├── sessions.module.ts         # BullModule.registerQueue registration
│   │   ├── sessions.controller.ts     # POST /sessions, GET /sessions/:id/events, DELETE /sessions/:id
│   │   ├── sessions.service.ts        # Session CRUD + enqueue + 409 guard
│   │   ├── dto/
│   │   │   └── create-session.dto.ts  # Empty or minimal (config read from MongoDB)
│   │   └── schemas/
│   │       └── session.schema.ts      # Session Mongoose schema with embedded events[]
├── workers/
│   └── search-session.worker.ts       # Standalone entry point (spawned by fork)
└── common/
    └── redis/
        ├── redis.module.ts             # (existing — @Global, exports REDIS_CLIENT)
        ├── redis.provider.ts           # (existing — publisher client)
        └── redis-subscriber.provider.ts  # NEW: dedicated subscriber ioredis instance
packages/core/src/types/
└── session.types.ts                   # NEW: SessionEventType union + SessionStatus
```

### Pattern 1: BullMQ Module Registration (NestJS)

**What:** Register `@nestjs/bullmq` in AppModule and the `search-session` queue in SessionsModule. Use `BullModule.forRootAsync` to reuse the existing `REDIS_URL` env var.

**When to use:** On every NestJS module that needs to enqueue jobs.

```typescript
// apps/api/src/app.module.ts — add to imports[]
// Source: https://docs.bullmq.io/guide/nestjs

import { BullModule } from '@nestjs/bullmq';

BullModule.forRootAsync({
  useFactory: () => ({
    connection: {
      url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    },
  }),
}),

// apps/api/src/modules/sessions/sessions.module.ts
BullModule.registerQueue({ name: 'search-session' }),
```

**Important:** `BullModule.forRoot` takes a `connection` object (not a top-level `url`). For ioredis-style URL, use `connection: { lazyConnect: false }` with a `url` key OR separate `host`/`port` fields. Verify against `@nestjs/bullmq` v11 docs before implementation.

### Pattern 2: Standalone Worker Process Entry Point

**What:** A plain TypeScript file (compiled to JS) that creates a BullMQ `Worker` directly and publishes events to Redis. Spawned by `SessionsModule.onModuleInit` via `child_process.fork`.

**When to use:** Any CPU- or IO-heavy job that must not crash the API process.

```typescript
// apps/api/src/workers/search-session.worker.ts
// Source: BullMQ docs (https://docs.bullmq.io/guide/workers)

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

// Dedicated publisher — not shared with BullMQ worker connection
const publisher = new Redis(redisUrl);

const worker = new Worker(
  'search-session',
  async (job: Job<{ sessionId: string; userId: string }>) => {
    const { sessionId } = job.data;
    const channel = `session:${sessionId}:events`;

    // Publish events to Redis Pub/Sub channel
    await publisher.publish(channel, JSON.stringify({
      id: 1,
      type: 'session_started',
      data: { sessionId },
      timestamp: new Date().toISOString(),
    }));

    // ... stub pipeline: emit job_found events with mock data ...
  },
  {
    connection: new Redis(redisUrl, { maxRetriesPerRequest: null }),
    concurrency: 2,
  }
);

worker.on('error', (err) => {
  // Worker errors are logged but do NOT affect the API process
  console.error('[worker] error', err);
});

// Handle cancellation signal from parent process
process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
```

**Critical:** Set `maxRetriesPerRequest: null` on the Worker's ioredis connection. This is a BullMQ requirement — ioredis will throw if this is not set for Worker instances.

### Pattern 3: Worker Process Spawning from NestJS

**What:** The NestJS `SessionsModule` spawns the worker process once on startup and holds a reference to kill it on shutdown.

**When to use:** Crash isolation requirement — worker crash must not affect API.

```typescript
// apps/api/src/modules/sessions/sessions.module.ts (simplified)
import { fork, ChildProcess } from 'child_process';
import { join } from 'path';
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';

export class SessionsModule implements OnModuleInit, OnModuleDestroy {
  private worker: ChildProcess | null = null;

  onModuleInit(): void {
    this.worker = fork(join(__dirname, '../../workers/search-session.worker.js'));
    this.worker.on('exit', (code) => {
      // Worker died — restart or alert; API is unaffected
    });
  }

  onModuleDestroy(): void {
    this.worker?.kill('SIGTERM');
  }
}
```

**Alternative:** BullMQ sandboxed processors (`new Worker(queueName, path.join(__dirname, 'processor.js'), {...})`) auto-respawn on crash. This is simpler but gives less control over graceful shutdown. Use sandboxed processors if the restart-on-crash behavior is desired without manual management.

### Pattern 4: Dedicated Redis Subscriber for Pub/Sub

**What:** A second `ioredis` instance dedicated to subscriptions. Redis pub/sub requires a connection that cannot be used for other commands once it enters subscriber mode.

**When to use:** Always — mixing pub and sub on one connection causes errors.

```typescript
// apps/api/src/common/redis/redis-subscriber.provider.ts
import Redis from 'ioredis';

export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';

export const RedisSubscriberProvider = {
  provide: REDIS_SUBSCRIBER,
  useFactory: (): Redis =>
    new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
};
```

Add `RedisSubscriberProvider` to `RedisModule` providers and exports. The existing `REDIS_CLIENT` continues to be used for regular commands (get/set/publish). The subscriber is used only in `SessionsService` for SSE fan-out.

### Pattern 5: SSE with Raw res.write (Recommended over @Sse)

**What:** Use `@Get` + `@Res()` + manual SSE headers instead of `@Sse`. Read `Last-Event-ID` header before flushing headers to enable replay. Use `req.on('close')` for cleanup.

**Why not @Sse:** The NestJS `@Sse` decorator has a documented bug where the connection is established *before* the handler executes, preventing session validation. It also sends an empty initial message and cannot return HTTP error codes. The NestJS maintainer confirmed raw `res.write` is the recommended approach for production SSE.

```typescript
// apps/api/src/modules/sessions/sessions.controller.ts
import { Get, Param, Req, Res, Header } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Subject, takeUntil } from 'rxjs';

@Get(':id/events')
async streamEvents(
  @Param('id') sessionId: string,
  @Req() req: Request,
  @Res() res: Response
): Promise<void> {
  // 1. Validate session ownership BEFORE establishing SSE connection
  const userId = getUserId(req as AuthenticatedRequest);
  const session = await this.sessionsService.findByIdForUser(sessionId, userId);
  // If invalid, throw here — 404/403 will be returned as normal HTTP response

  // 2. Read Last-Event-ID for replay
  const lastEventIdHeader = req.headers['last-event-id'];
  const lastEventId = lastEventIdHeader ? parseInt(String(lastEventIdHeader), 10) : 0;

  // 3. Set SSE headers and flush
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if applicable
  res.flushHeaders();

  const close$ = new Subject<void>();
  req.on('close', () => close$.next());

  // 4. Replay missed events from MongoDB
  const missedEvents = session.events.filter(e => e.id > lastEventId);
  for (const event of missedEvents) {
    res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  }

  // 5. Subscribe to live Redis Pub/Sub channel
  await this.sessionsService.subscribeToEvents(sessionId, (event) => {
    res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  }, close$);
}
```

### Pattern 6: MongoDB Ring Buffer for Event Persistence

**What:** Each event write to the Session document uses `$push` with `$each` and `$slice: -100` to maintain a bounded array without a separate collection.

**When to use:** Every time the worker publishes an event to Redis, it must also persist it to MongoDB for replay.

```typescript
// Mongoose update — persist event AND enforce 100-event cap atomically
// Source: https://learnmongodbthehardway.com/schema/arraycache/
await this.sessionModel.updateOne(
  { _id: sessionId },
  {
    $push: {
      events: {
        $each: [{ id: nextId, type, data, timestamp: new Date().toISOString() }],
        $slice: -100,    // keep only the 100 most recent events
      },
    },
  }
);
```

**Note:** The worker process does not have access to NestJS DI or Mongoose. The worker must either: (a) use the raw `mongoose` package directly, or (b) only publish to Redis and have a separate NestJS `QueueEvents` listener in the API process persist events. Option (b) is architecturally cleaner and keeps MongoDB access inside NestJS where the connection pool is managed. This is a discretion decision for the planner.

### Anti-Patterns to Avoid

- **Using `ioredis` subscriber connection for other commands:** Once `subscribe()` is called, the connection is in subscriber mode and cannot run `get`/`set`/`publish`. Always use separate connections.
- **Defining `SessionEventType` inline in the module:** Must go in `packages/core/src/types/session.types.ts` (CLAUDE.md rule — single source of truth).
- **Using `@Sse` decorator for this phase:** Has documented bugs with pre-connection establishment that breaks session validation. Use raw `res.write`.
- **Passing full config in BullMQ job payload:** Locked decision says payload = `{ sessionId, userId }` only. Worker reads config from MongoDB.
- **In-memory session registry (Map/Set):** Existing architectural decision prohibits this. Session ownership and status live in MongoDB only.
- **`maxRetriesPerRequest` default on Worker ioredis connection:** BullMQ throws unless `maxRetriesPerRequest: null` is set on the Worker's connection.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue with retry/backoff | Custom retry loop in worker | BullMQ `attempts` + `backoff` config | Handles stalled jobs, exponential backoff, dead-letter queue, Redis Streams delivery guarantees |
| Process crash isolation | `try/catch` around Playwright calls in NestJS request handler | `child_process.fork` + BullMQ Worker (separate process) | A `try/catch` doesn't prevent a Playwright segfault from killing the Node.js process |
| Event delivery ordering | Custom sequence counter + sort | BullMQ job `id` ordering + MongoDB `events.id` monotonic int | Monotonic counter in MongoDB is sufficient; BullMQ Redis Streams maintain ordering natively |
| SSE heartbeat/keep-alive | `setInterval` writing `:\n\n` every N seconds | Standard SSE spec comment ping every 30s | Browser EventSource auto-reconnects after 3s timeout; keep-alive prevents proxy timeouts |
| Bounded event storage | Separate TTL collection with `createdAt` index | MongoDB `$push` + `$slice: -100` | Single atomic update on the Session document; no separate collection to join or clean up |

**Key insight:** BullMQ's value is not just queueing — it's stalled-job detection (via Redis key expiry), reliable delivery (Redis Streams), and the concurrency guarantee that prevents running more than 2 simultaneous Playwright sessions regardless of how many API pods are running.

---

## Common Pitfalls

### Pitfall 1: Redis Pub/Sub Subscriber Connection Mode Lock
**What goes wrong:** Code calls `subscriber.publish(...)` after calling `subscriber.subscribe(...)` on the same ioredis instance. Redis returns an error: "ERR only (P)SUBSCRIBE / (P)UNSUBSCRIBE / PING / QUIT / RESET allowed in this context."
**Why it happens:** Once an ioredis connection enters subscriber mode, it cannot execute regular Redis commands.
**How to avoid:** Always create a dedicated `REDIS_SUBSCRIBER` provider separate from `REDIS_CLIENT`. `REDIS_CLIENT` = publisher + regular commands. `REDIS_SUBSCRIBER` = subscriptions only.
**Warning signs:** `ERR only (P)SUBSCRIBE` error in logs after the first SSE connection is established.

### Pitfall 2: Worker ioredis maxRetriesPerRequest Default
**What goes wrong:** BullMQ `Worker` throws `"MaxRetriesPerRequestError: Reached the max retries per request limit"` immediately on startup.
**Why it happens:** The default ioredis value (20) causes ioredis to give up retrying commands during Redis downtime. BullMQ workers need to wait indefinitely for Redis to come back.
**How to avoid:** Always pass `{ maxRetriesPerRequest: null }` in the ioredis connection options passed to `new Worker(...)`.
**Warning signs:** Worker exits immediately with an ioredis error before processing any jobs.

### Pitfall 3: @Sse Decorator Connection Before Validation
**What goes wrong:** JWT validation fails but the SSE connection is already open. NestJS sends the error as an SSE event, not an HTTP 401/403. The browser EventSource silently reconnects in a loop.
**Why it happens:** `@Sse` establishes the TCP connection before the handler method executes, so guards run too late to return proper HTTP status codes.
**How to avoid:** Use raw `@Get` + `@Res()` + manual headers. Validate session ownership before calling `res.flushHeaders()`.
**Warning signs:** Browser EventSource loop with no visible error in the network tab (status shows 200 but reconnects immediately).

### Pitfall 4: SSE Connection Leak on Client Disconnect
**What goes wrong:** Redis `subscriber.on('message', handler)` callbacks accumulate in memory as clients connect and disconnect. After hours of operation, Redis subscriber has hundreds of orphaned channel subscriptions.
**Why it happens:** `req.on('close')` is not wired to `subscriber.unsubscribe(channel)`.
**How to avoid:** In the SSE handler, wire `req.on('close', () => { subscriber.unsubscribe(channel); ... })` to clean up. Use RxJS `takeUntil(close$)` to complete the Observable and trigger cleanup.
**Warning signs:** Redis `CLIENT LIST` shows growing number of subscribed channels; API memory usage grows over time.

### Pitfall 5: BullMQ Job Payload Size
**What goes wrong:** Developer includes full `AppConfig` (search config) in the BullMQ job payload. Redis job payloads are limited and serialization of large objects causes performance issues.
**Why it happens:** Convenient to pass all context in the job.
**How to avoid:** Payload = `{ sessionId: string, userId: string }` only (locked decision). Worker reads config from MongoDB using sessionId.
**Warning signs:** Redis `OBJECT ENCODING` on job keys shows `embstr` → `raw`; job payload size > 1KB.

### Pitfall 6: Worker Cannot Use NestJS DI or Mongoose
**What goes wrong:** Developer imports NestJS decorators or `@nestjs/mongoose` models in the worker file. TypeScript compiles but runtime crashes because NestJS metadata is not bootstrapped in the forked process.
**Why it happens:** The worker is a plain Node.js process, not a NestJS app context.
**How to avoid:** Worker uses raw `mongoose.connect()` + raw mongoose models, OR communicates back to the API process via Redis messages to trigger MongoDB writes. The latter (API process handles all MongoDB writes via `QueueEvents` listener) is architecturally cleaner.
**Warning signs:** `Error: Nest can't resolve dependencies` or `Mongoose model not registered` in worker stderr.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Session Mongoose Schema (ring-buffer events array)
```typescript
// apps/api/src/modules/sessions/schemas/session.schema.ts
// Pattern follows existing user.schema.ts conventions

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { SessionEventUnion, SessionStatus } from '@job-agent/core';

export type SessionDocument = HydratedDocument<Session>;

interface StoredEvent {
  id: number;           // monotonically increasing per session, starting at 1
  type: string;
  data: object;
  timestamp: string;    // ISO 8601
}

@Schema({ timestamps: true, collection: 'sessions' })
export class Session {
  @Prop({ required: true, index: true })
  userId!: string;      // owner — all queries include userId filter (NF-08)

  @Prop({ required: true, enum: ['queued', 'running', 'completed', 'cancelled', 'failed'], default: 'queued' })
  status!: SessionStatus;

  @Prop({ type: Object, required: true })
  config!: object;      // SearchConfigSnapshot — shape from AppConfig at start time

  @Prop({ type: [Object], default: [] })
  events!: StoredEvent[];   // ring buffer — max 100 via $push + $slice

  @Prop({ type: Number, default: 0 })
  nextEventId!: number;   // monotonic counter, incremented per event

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Compound index for: find active session by user, list user's sessions
SessionSchema.index({ userId: 1, status: 1 });
SessionSchema.index({ userId: 1, createdAt: -1 });
```

### BullMQ Job Retry (discretion recommendation)
```typescript
// Source: https://docs.bullmq.io/guide/retrying-failing-jobs
// Recommended: 2 attempts with exponential backoff for Playwright failures

await this.searchSessionQueue.add(
  'run-session',
  { sessionId, userId },
  {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,    // 5s initial, 10s second attempt
    },
    removeOnComplete: { count: 100 },  // keep last 100 completed jobs for debugging
    removeOnFail: { count: 100 },
  }
);
```

### Session 409 Conflict Check
```typescript
// apps/api/src/modules/sessions/sessions.service.ts
async createSession(userId: string): Promise<{ sessionId: string }> {
  // NF-08: row-level security — always filter by userId
  const active = await this.sessionModel.findOne({
    userId,
    status: { $in: ['queued', 'running'] },
  });

  if (active) {
    throw new ConflictException({
      code: 'SESSION_ALREADY_ACTIVE',
      sessionId: active._id.toHexString(),
    });
  }
  // ... create + enqueue
}
```

### MongoDB Ring-Buffer Event Append
```typescript
// Source: MongoDB array slice cache pattern
// https://learnmongodbthehardway.com/schema/arraycache/

async appendEvent(sessionId: string, type: string, data: object): Promise<number> {
  const session = await this.sessionModel.findByIdAndUpdate(
    sessionId,
    {
      $inc: { nextEventId: 1 },
    },
    { new: true, projection: { nextEventId: 1 } }
  );
  const eventId = session!.nextEventId;

  await this.sessionModel.updateOne(
    { _id: sessionId },
    {
      $push: {
        events: {
          $each: [{ id: eventId, type, data, timestamp: new Date().toISOString() }],
          $slice: -100,
        },
      },
    }
  );
  return eventId;
}
```

### SSE Last-Event-ID Replay Pattern
```typescript
// apps/api/src/modules/sessions/sessions.controller.ts
// Source: NestJS maintainer-recommended raw res.write approach
// (https://github.com/nestjs/nest/issues/12670)

@Get(':id/events')
async streamEvents(
  @Param('id') sessionId: string,
  @Req() req: Request,
  @Res() res: Response,
): Promise<void> {
  const userId = getUserId(req as AuthenticatedRequest);
  const session = await this.sessionsService.findByIdForUser(sessionId, userId);
  // ^^^ Throws 404/403 BEFORE headers are set — correct HTTP error codes returned

  const lastEventId = Number(req.headers['last-event-id'] ?? '0');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Replay all stored events with id > lastEventId
  for (const event of session.events.filter(e => e.id > lastEventId)) {
    res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  }

  // Live stream via Redis Pub/Sub — cleanup on client disconnect
  const channel = `session:${sessionId}:events`;
  const onMessage = (_ch: string, message: string) => {
    res.write(message);    // message pre-formatted as "id:...\nevent:...\ndata:...\n\n"
  };
  await this.redisSubscriber.subscribe(channel);
  this.redisSubscriber.on('message', onMessage);

  req.on('close', async () => {
    this.redisSubscriber.removeListener('message', onMessage);
    await this.redisSubscriber.unsubscribe(channel);
    res.end();
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bull (v3, bull npm) | BullMQ (v5+) | 2021 | BullMQ uses Redis Streams (not lists); better stalled-job handling, TypeScript-first |
| `@nestjs/bull` | `@nestjs/bullmq` | 2022 | Official NestJS package for BullMQ; separate from the legacy `@nestjs/bull` |
| WebSocket for server push | SSE (EventSource) | 2020+ | SSE is simpler for unidirectional server→client streams; auto-reconnect built-in; no socket server needed |
| Polling API for progress | SSE/WebSocket | — | RT-01 explicitly prohibits polling |
| `Bull` (Redis Lists) | `BullMQ` (Redis Streams) | 2021 | Ordered delivery, consumer groups, better observability |

**Deprecated/outdated:**
- `@nestjs/bull` (the old `bull` package integration): Do not install. Only `@nestjs/bullmq` with `bullmq`.
- `bull-board` for `@nestjs/bull`: Replaced by `@bull-board/nestjs` which works with both bull and bullmq.
- `passport 1.0.x`: Existing codebase decision — do not upgrade (0.7.x locked).

---

## Open Questions

1. **Worker MongoDB access: raw mongoose vs QueueEvents relay**
   - What we know: The worker process cannot use NestJS DI. It needs to write events to MongoDB for replay.
   - What's unclear: Should the worker maintain its own raw `mongoose.connect()` and write directly, or should a `QueueEvents` listener in the NestJS API process handle all MongoDB writes?
   - Recommendation: Use `QueueEvents` listener in the API process to write events to MongoDB (keeps MongoDB access inside NestJS where the connection pool is managed). The worker publishes to Redis Pub/Sub only. The `QueueEvents` listener + SSE service handles persistence. This is architecturally cleaner.

2. **Redis subscriber per-session-connection vs single global subscriber**
   - What we know: Each SSE connection calls `subscriber.subscribe(channel)`. If all SSE connections share one subscriber, the `message` event fires for ALL channels and must be filtered.
   - What's unclear: Whether to create one subscriber per SSE connection (simpler routing, but more Redis connections) or one global subscriber with channel filtering.
   - Recommendation: Single global subscriber in `SessionsService` that maintains a `Map<channel, Set<handler>>`. This scales better for NF-05 (100 concurrent users) as it uses a single Redis connection regardless of active SSE count.

3. **Worker process respawn strategy**
   - What we know: Locked decision requires the worker to be a separate process. BullMQ sandboxed processors auto-respawn.
   - What's unclear: Whether to use manual `child_process.fork` + respawn logic, or BullMQ sandboxed processor file path approach.
   - Recommendation: BullMQ sandboxed processor (passing file path to `Worker` constructor) — simpler, auto-respawns, and is the BullMQ-idiomatic approach. Manual `child_process.fork` is an alternative if explicit lifecycle control is needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest |
| Config file | `apps/api/jest.config.js` (exists) |
| Quick run command | `npm run test -w apps/api -- --testPathPattern sessions` |
| Full suite command | `npm run test:cov -w apps/api` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RT-01 | POST /sessions returns 202 in < 200ms | unit | `npm test -w apps/api -- --testPathPattern sessions.controller` | ❌ Wave 0 |
| RT-01 | GET /sessions/:id/events replays events with id > Last-Event-ID | unit | `npm test -w apps/api -- --testPathPattern sessions.service` | ❌ Wave 0 |
| RT-01 | SessionsService.appendEvent increments nextEventId and enforces 100-event cap | unit | `npm test -w apps/api -- --testPathPattern sessions.service` | ❌ Wave 0 |
| NF-05 | POST /sessions returns 409 when active session exists for user | unit | `npm test -w apps/api -- --testPathPattern sessions.service` | ❌ Wave 0 |
| NF-05 | DELETE /sessions/:id sets status=cancelled | unit | `npm test -w apps/api -- --testPathPattern sessions.controller` | ❌ Wave 0 |
| NF-05 | Worker process crash does not throw in NestJS API (manual-only) | manual | N/A — requires process kill | manual-only |

### Sampling Rate
- **Per task commit:** `npm run test -w apps/api -- --testPathPattern sessions --passWithNoTests`
- **Per wave merge:** `npm run test:cov -w apps/api`
- **Phase gate:** Full suite ≥ 70% coverage on new `sessions/` files before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/modules/sessions/sessions.service.test.ts` — covers RT-01 (appendEvent, findByIdForUser, 409 guard), NF-05
- [ ] `apps/api/src/modules/sessions/sessions.controller.test.ts` — covers RT-01 (202 response, header extraction), NF-05 (DELETE cancel)
- [ ] `packages/core/src/types/session.types.ts` — new file, no test needed (types only)
- [ ] Framework already installed: Jest + ts-jest in `apps/api` — no install needed

---

## Sources

### Primary (HIGH confidence)
- `https://docs.bullmq.io/guide/nestjs` — BullMQ NestJS integration, `@Processor`, `WorkerHost`, `BullModule.forRoot`
- `https://docs.bullmq.io/guide/connections` — ioredis connection reuse, `maxRetriesPerRequest: null` requirement for Workers
- `https://docs.bullmq.io/guide/retrying-failing-jobs` — `attempts` + `backoff` configuration (exponential/fixed)
- `https://docs.bullmq.io/guide/workers/sandboxed-processors` — separate process execution, auto-respawn, file path API
- `https://learnmongodbthehardway.com/schema/arraycache/` — MongoDB `$push` + `$slice` ring-buffer pattern
- `https://github.com/nestjs/nest/issues/12670` — NestJS `@Sse` known issues + raw `res.write` recommendation from maintainer
- `apps/api/src/common/redis/` (existing codebase) — `REDIS_CLIENT` injection token, `ioredis` setup pattern
- `apps/api/src/modules/users/` (existing codebase) — `getUserId()` pattern, `@Prop({ type: [Object] })` schema pattern, Jest mock structure
- `npm view @nestjs/bullmq version` → 11.0.4 (verified 2026-03-17)
- `npm view bullmq version` → 5.71.0 (verified 2026-03-17)

### Secondary (MEDIUM confidence)
- `https://oneuptime.com/blog/post/2026-01-21-bullmq-sandboxed-processors/view` — sandboxed processor implementation with auto-respawn details (verified against BullMQ docs)
- `https://www.niraj.life/blog/exploring-server-sent-events-sse-nestjs` — SSE `Last-Event-ID` + `req.on('close')` cleanup pattern (consistent with NestJS issue thread findings)

### Tertiary (LOW confidence)
- Medium/DEV articles on Redis Pub/Sub in NestJS — general patterns consistent with ioredis docs but not independently verified against official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via `npm view`; `@nestjs/bullmq` and `bullmq` are official/widely used; `ioredis` and `rxjs` already in codebase
- Architecture: HIGH — patterns derive from existing codebase conventions + official BullMQ docs + NestJS issue tracker (maintainer-confirmed)
- Pitfalls: HIGH — `maxRetriesPerRequest: null` and subscriber connection lock are in official ioredis/BullMQ docs; `@Sse` issue is from the official NestJS issue tracker

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (BullMQ and NestJS are stable; check @nestjs/bullmq changelog if > 30 days)
