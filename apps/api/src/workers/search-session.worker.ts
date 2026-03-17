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
 * 3. Runs the stub pipeline (Phase 3: mock events; Phase 4: real LinkedIn scraping)
 * 4. Persists each event to MongoDB via a ring-buffer ($push + $slice: -100)
 * 5. Publishes each event to Redis Pub/Sub channel `session:{sessionId}:events`
 *    so the NestJS SSE gateway can push them to the connected browser in real time
 * 6. Updates session status: queued → running → completed | cancelled
 *
 * @module search-session.worker
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import mongoose, { Schema, Model } from 'mongoose';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import chalk = require('chalk');
import { generateMockSessionEvents } from './mock-data.generator.js';
import type { StoredSessionEvent, SessionStatus } from '@job-agent/core';

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
 * Processes a single BullMQ search-session job.
 *
 * 1. Updates session status → 'running'
 * 2. Generates mock events (Phase 3 stub)
 * 3. For each event: persists to MongoDB ring buffer and publishes to Redis Pub/Sub
 * 4. Respects cancellation: checks session status before each event
 * 5. Updates session status → 'completed' (or leaves as 'cancelled')
 *
 * @param job - BullMQ Job containing sessionId and userId
 */
async function processSession(job: Job<SearchSessionJobData>): Promise<void> {
  const { sessionId, userId } = job.data;
  const channel = `session:${sessionId}:events`;

  process.stdout.write(chalk.blue(`[search-session-worker] Starting job ${job.id} for session ${sessionId}\n`));

  // 1. Mark session as running
  await SessionModel.updateOne(
    { _id: sessionId },
    { $set: { status: 'running', startedAt: new Date() } },
  );

  // 2. Generate mock event sequence (Phase 3 stub)
  const events = generateMockSessionEvents(sessionId, userId);

  // 3. Emit each event with a realistic delay
  for (const event of events) {
    // Cancellation check — stop publishing if the user cancelled the session
    const session = await SessionModel.findById(sessionId, { status: 1 }).lean();
    if (session?.status === 'cancelled') {
      process.stdout.write(chalk.yellow(`[search-session-worker] Session ${sessionId} was cancelled — stopping event loop\n`));
      break;
    }

    // Persist to MongoDB: atomically increment counter to get stable event ID
    const updated = await SessionModel.findByIdAndUpdate(
      sessionId,
      { $inc: { nextEventId: 1 } },
      { new: true, projection: { nextEventId: 1 } },
    ).lean();

    const eventId = updated!.nextEventId;

    const storedEvent: StoredSessionEvent = {
      id: eventId,
      type: event.type,
      data: event as unknown as Record<string, unknown>,
      timestamp: event.timestamp,
    };

    // Ring-buffer append: keep only the last 100 events
    await SessionModel.updateOne(
      { _id: sessionId },
      { $push: { events: { $each: [storedEvent], $slice: -100 } } },
    );

    // Publish to Redis Pub/Sub so live SSE consumers receive the event immediately
    await publisher.publish(channel, JSON.stringify(storedEvent));

    // Simulate real search work: 500–1500ms delay between events
    await new Promise<void>((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000),
    );
  }

  // 4. Mark session as completed (unless it was cancelled in the loop above)
  const finalSession = await SessionModel.findById(sessionId, { status: 1 }).lean();
  if (finalSession?.status !== 'cancelled') {
    await SessionModel.updateOne(
      { _id: sessionId },
      { $set: { status: 'completed', completedAt: new Date() } },
    );
    process.stdout.write(chalk.green(`[search-session-worker] Session ${sessionId} completed\n`));
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
  process.stdout.write(chalk.green(`[search-session-worker] Job ${job.id} completed successfully\n`));
});

worker.on('failed', (job: Job<SearchSessionJobData> | undefined, err: Error) => {
  process.stderr.write(chalk.red(`[search-session-worker] Job ${job?.id} failed: ${err.message}\n`));
});

// ---------------------------------------------------------------------------
// Startup: connect to MongoDB then start consuming
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    SessionModel = mongoose.model<SessionDocumentRaw>('Session', sessionSchema);
    process.stdout.write(chalk.blue(`[search-session-worker] Connected to MongoDB at ${MONGO_URI}\n`));
    process.stdout.write(chalk.blue('[search-session-worker] Worker listening on queue: search-session\n'));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(chalk.red(`[search-session-worker] Startup failed: ${message}\n`));
    process.exit(1);
  }
}

void start();

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on('SIGTERM', () => {
  void (async () => {
    process.stdout.write(chalk.yellow('[search-session-worker] SIGTERM received — shutting down gracefully\n'));
    try {
      await worker.close();
      await publisher.quit();
      await mongoose.disconnect();
      process.stdout.write(chalk.green('[search-session-worker] Shutdown complete\n'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(chalk.red(`[search-session-worker] Shutdown error: ${message}\n`));
    } finally {
      process.exit(0);
    }
  })();
});
