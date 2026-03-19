/**
 * Standalone BullMQ worker process for the job-search automation pipeline.
 *
 * This file is a plain Node.js entry point — it is NOT a NestJS module.
 * It is spawned by SessionsModule via child_process.fork so that a worker crash
 * (e.g. Playwright crash, CAPTCHA loop, unhandled exception) cannot affect the
 * NestJS API process. The two processes share no memory; communication happens
 * through MongoDB and Redis.
 *
 * Responsibilities:
 * 1. Connects to Redis (BullMQ consumer) and MongoDB (event persistence)
 * 2. Picks up `search-session` jobs from the BullMQ queue (concurrency: 2)
 * 3. Loads session config and user profile from MongoDB
 * 4. Runs the real search pipeline via runSearchPipeline (Phase 4)
 * 5. Persists each event to MongoDB via a ring-buffer ($push + $slice: -100)
 * 6. Publishes each event to Redis Pub/Sub channel `session:{sessionId}:events`
 *    so the NestJS SSE gateway can push them to the connected browser in real time
 * 7. Updates session status: queued → running → completed | cancelled
 *
 * @module search-session.worker
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import mongoose, { Schema } from 'mongoose';
import type { Model } from 'mongoose';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import chalk = require('chalk');
import type { StoredSessionEvent, SessionStatus, SearchConfigSnapshotType, ProfessionalProfile } from '@job-agent/core';
import { JSearchAdapter } from './adapters/jsearch.adapter.js';
import { createScoringAdapter } from './adapters/ai-provider.factory.js';
import { runSearchPipeline, type AnyModel } from './pipeline.js';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const MONGO_URI =
  process.env['MONGO_API_URI'] ?? 'mongodb://localhost:27017/job-agent-api';

// ---------------------------------------------------------------------------
// Minimal Session schema for the worker (plain Mongoose, no @nestjs/mongoose)
// Mirrors apps/api/src/modules/sessions/schemas/session.schema.ts
// ---------------------------------------------------------------------------

interface SessionDocumentRaw {
  _id: mongoose.Types.ObjectId | string;
  status: SessionStatus;
  nextEventId: number;
  events: StoredSessionEvent[];
}

const sessionSchema = new Schema<SessionDocumentRaw>(
  {
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'cancelled', 'failed'],
      required: true,
    },
    nextEventId: { type: Number, default: 0 },
    events: { type: [Object], default: [] },
  },
  { strict: false, collection: 'sessions' },
);

/** Raw Mongoose model — strict: false lets us read userId / config without re-defining every field */
let SessionModel: Model<SessionDocumentRaw>;

// ---------------------------------------------------------------------------
// Minimal User schema for the worker (read-only — fetch profile only)
// ---------------------------------------------------------------------------

const userSchema = new Schema({}, { strict: false, collection: 'users' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let UserModel: ReturnType<typeof mongoose.model<any>>;

// ---------------------------------------------------------------------------
// Redis publisher connection (separate from BullMQ consumer connection)
// Both connections require maxRetriesPerRequest: null for BullMQ compatibility
// ---------------------------------------------------------------------------

const publisher = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

// ---------------------------------------------------------------------------
// Worker job payload type
// ---------------------------------------------------------------------------

interface SearchSessionJobData {
  sessionId: string;
  userId: string;
}

// ---------------------------------------------------------------------------
// Core processor
// ---------------------------------------------------------------------------

/**
 * Processes a single BullMQ search-session job via the real pipeline.
 *
 * 1. Marks session status → 'running'
 * 2. Loads session config (SearchConfigSnapshotType) from MongoDB
 * 3. Loads user profile (ProfessionalProfile) from MongoDB
 * 4. Creates JSearchAdapter and ClaudeScoringAdapter from env vars
 * 5. Runs runSearchPipeline (search → filter → score → persist → emit SSE events)
 * 6. Marks session status → 'completed' (or leaves as 'cancelled')
 *
 * @param job - BullMQ Job containing sessionId and userId
 */
async function processSession(job: Job<SearchSessionJobData>): Promise<void> {
  const { sessionId, userId } = job.data;

  process.stdout.write(
    chalk.blue(`[search-session-worker] Starting job ${job.id} for session ${sessionId}\n`),
  );

  // 1. Mark session as running
  await SessionModel.updateOne(
    { _id: sessionId },
    { $set: { status: 'running', startedAt: new Date() } },
  );

  // 2. Load session config
  const session = (await SessionModel.findById(sessionId).lean()) as {
    config: SearchConfigSnapshotType;
  } | null;

  if (!session?.config) {
    process.stderr.write(
      chalk.red(`[search-session-worker] Session ${sessionId} has no config\n`),
    );
    await SessionModel.updateOne(
      { _id: sessionId },
      { $set: { status: 'failed', completedAt: new Date() } },
    );
    return;
  }

  // 3. Load user profile
  const user = (await UserModel.findById(userId).lean()) as {
    profile: ProfessionalProfile | null;
  } | null;

  if (!user?.profile) {
    process.stderr.write(
      chalk.red(`[search-session-worker] User ${userId} has no profile\n`),
    );
    await SessionModel.updateOne(
      { _id: sessionId },
      { $set: { status: 'failed', completedAt: new Date() } },
    );
    return;
  }

  // 4. Create adapters from environment variables
  const rapidApiKey = process.env['RAPIDAPI_KEY'] ?? '';

  if (!rapidApiKey) {
    process.stderr.write(chalk.yellow('[search-session-worker] RAPIDAPI_KEY not set — JSearch calls will fail\n'));
  }

  const adapter = new JSearchAdapter(rapidApiKey);

  let scorer;
  try {
    scorer = createScoringAdapter();
    process.stdout.write(chalk.blue(`[search-session-worker] Using scorer: ${scorer.name}\n`));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(chalk.yellow(`[search-session-worker] Scorer init failed: ${message} — scores will be 0\n`));
    // Fallback: import and use a no-op scorer so the pipeline can still save vacancies
    scorer = {
      name: 'NoOpScorer',
      scoreBatch: async (jobs: Array<{ index: number }>) =>
        jobs.map((j) => ({ index: j.index, score: 0, reason: 'no_scorer_configured' })),
    };
  }

  // 5. Run pipeline
  try {
    await runSearchPipeline({
      sessionId,
      userId,
      config: session.config,
      profile: user.profile,
      adapter,
      scorer,
      publisher,
      SessionModel: SessionModel as unknown as AnyModel,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(chalk.red(`[search-session-worker] Pipeline error: ${message}\n`));
  }

  // 6. Mark session as completed (unless cancelled by user)
  const finalSession = (await SessionModel.findById(sessionId, { status: 1 }).lean()) as {
    status: string;
  } | null;

  if (finalSession?.status !== 'cancelled') {
    await SessionModel.updateOne(
      { _id: sessionId },
      { $set: { status: 'completed', completedAt: new Date() } },
    );
    process.stdout.write(
      chalk.green(`[search-session-worker] Session ${sessionId} completed\n`),
    );
  }
}

// ---------------------------------------------------------------------------
// BullMQ Worker instantiation
// ---------------------------------------------------------------------------

/**
 * BullMQ Worker connected to the `search-session` queue.
 *
 * concurrency: 2 — process up to 2 sessions in parallel.
 * connection accepts a URL string; BullMQ manages its own ioredis instance
 * internally, avoiding the bundled-ioredis vs workspace-ioredis type mismatch.
 * maxRetriesPerRequest: null is set via the connection options object.
 */
const worker = new Worker<SearchSessionJobData>(
  'search-session',
  processSession,
  {
    connection: { url: REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 2,
  },
);

worker.on('completed', (job: Job<SearchSessionJobData>) => {
  process.stdout.write(
    chalk.green(`[search-session-worker] Job ${job.id} completed successfully\n`),
  );
});

worker.on('failed', (job: Job<SearchSessionJobData> | undefined, err: Error) => {
  process.stderr.write(
    chalk.red(`[search-session-worker] Job ${job?.id} failed: ${err.message}\n`),
  );
});

// ---------------------------------------------------------------------------
// Startup: connect to MongoDB then start consuming
// ---------------------------------------------------------------------------

/**
 * Initialises MongoDB connections and starts the BullMQ worker.
 * Exits process with code 1 on connection failure.
 */
async function start(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    SessionModel = mongoose.model<SessionDocumentRaw>('Session', sessionSchema);
    UserModel = mongoose.model('User', userSchema);
    process.stdout.write(
      chalk.blue(`[search-session-worker] Connected to MongoDB at ${MONGO_URI}\n`),
    );
    process.stdout.write(
      chalk.blue('[search-session-worker] Worker listening on queue: search-session\n'),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      chalk.red(`[search-session-worker] Startup failed: ${message}\n`),
    );
    process.exit(1);
  }
}

void start();

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on('SIGTERM', () => {
  void (async () => {
    process.stdout.write(
      chalk.yellow('[search-session-worker] SIGTERM received — shutting down gracefully\n'),
    );
    try {
      await worker.close();
      await publisher.quit();
      await mongoose.disconnect();
      process.stdout.write(chalk.green('[search-session-worker] Shutdown complete\n'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        chalk.red(`[search-session-worker] Shutdown error: ${message}\n`),
      );
    } finally {
      process.exit(0);
    }
  })();
});
