/**
 * Search pipeline orchestrator.
 *
 * Runs inside the BullMQ worker process. Coordinates the full search workflow:
 *   1. Emit session_started event
 *   2. Iterate config.platforms — call adapter.search() once per platform (20 results each)
 *   3. Local filter: excluded companies, missing required fields (reason: 'missing_fields')
 *   4. Dedup check against vacancies collection history
 *   5. Batch remaining jobs (5 per batch) for LLM scoring
 *   6. For each scored job: persist to vacancies, emit job_found or job_skipped
 *   7. Stop after totals.found >= maxApplicationsPerSession (APPLY-04)
 *   8. Emit session_complete with accurate totals
 *
 * @module pipeline
 */

import mongoose, { Schema } from 'mongoose';
import type Redis from 'ioredis';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import chalk = require('chalk');
import type {
  SearchConfigSnapshotType,
  JobSearchAdapter,
  ScoringAdapter,
  RawJobResult,
  ScoringInput,
  ProfessionalProfile,
  StoredSessionEvent,
  JobFoundEvent,
  JobSkippedEvent,
  SessionCompleteEvent,
  SessionStartedEvent,
  PlatformId,
} from '@job-agent/core';

// ---------------------------------------------------------------------------
// Minimal vacancy schema for the worker process (plain Mongoose, no @nestjs/mongoose)
// Mirrors apps/api/src/modules/vacancies/schemas/vacancy.schema.ts
// ---------------------------------------------------------------------------

const vacancySchema = new Schema(
  {
    jobId: { type: String, required: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    description: { type: String, required: true },
    url: { type: String, required: true },
    location: { type: String, required: true },
    platform: { type: String, required: true },
    postedAt: { type: String },
    compatibilityScore: { type: Number, required: true },
    scoreReason: { type: String, default: '' },
    status: { type: String, enum: ['new', 'applied', 'dismissed', 'failed'], default: 'new' },
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    discoveredAt: { type: String, required: true },
    filterReason: { type: String },
  },
  { strict: false, collection: 'vacancies' },
);

vacancySchema.index({ userId: 1, url: 1 }, { unique: true });
vacancySchema.index(
  { userId: 1, company: 1, title: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

// ---------------------------------------------------------------------------
// Pipeline context and types
// ---------------------------------------------------------------------------

/**
 * Structural duck-type for any Mongoose model passed into the pipeline.
 * Using this instead of Model<T> avoids Mongoose generic type incompatibilities
 * caused by exactOptionalPropertyTypes + Schema strict mode differences.
 */
export interface AnyModel {
  findById(id: unknown, projection?: unknown): { lean(): Promise<unknown> };
  findByIdAndUpdate(id: unknown, update: unknown, options?: unknown): Promise<unknown>;
  updateOne(filter: unknown, update: unknown): Promise<unknown>;
}

/** All dependencies injected into the pipeline — makes testing easy */
export interface PipelineContext {
  sessionId: string;
  userId: string;
  config: SearchConfigSnapshotType;
  profile: ProfessionalProfile;
  adapter: JobSearchAdapter;
  scorer: ScoringAdapter;
  publisher: Redis;
  /** Session model (for status checks and event persistence) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SessionModel: AnyModel;
}

/** Aggregate counters returned by the pipeline */
export interface PipelineTotals {
  found: number;
  applied: number;
  skipped: number;
  failed: number;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Runs the full search-score-persist pipeline inside the BullMQ worker process.
 *
 * Steps:
 * 1. Emit session_started event
 * 2. Iterate config.platforms, calling adapter.search() per platform (20 results min)
 * 3. Local filter: excluded companies, missing required fields (reason: 'missing_fields')
 * 4. Dedup check against vacancies collection history
 * 5. Batch remaining jobs (BATCH_SIZE=5) for LLM scoring
 * 6. For each scored job: persist, emit job_found or job_skipped
 * 7. Stop after totals.found >= maxApplicationsPerSession (APPLY-04)
 * 8. Emit session_complete with accurate totals
 *
 * @param ctx - Pipeline execution context (deps injected for testability)
 * @returns PipelineTotals — aggregate counters from the session
 */
export async function runSearchPipeline(ctx: PipelineContext): Promise<PipelineTotals> {
  const { sessionId, userId, config, profile, adapter, scorer, publisher, SessionModel } = ctx;
  const channel = `session:${sessionId}:events`;
  const startTime = Date.now();
  const totals: PipelineTotals = { found: 0, applied: 0, skipped: 0, failed: 0 };

  // Get or create the Vacancy model (worker may call this multiple times)
  // Duck-typed to avoid Mongoose generic type incompatibilities with exactOptionalPropertyTypes
  interface VacancyModelType {
    findOne(filter: unknown): { lean(): { exec(): Promise<unknown> } };
    create(doc: unknown): Promise<unknown>;
  }
  let VacancyModel: VacancyModelType;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    VacancyModel = mongoose.model<any>('Vacancy') as unknown as VacancyModelType;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    VacancyModel = mongoose.model<any>('Vacancy', vacancySchema) as unknown as VacancyModelType;
  }

  // -------------------------------------------------------------------------
  // Helper: emit event (persist to session ring buffer + publish to Redis)
  // -------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function emitEvent(event: any): Promise<void> {
    const typedEvent = event as { type: string; timestamp: string; [key: string]: unknown };
    const updated = (await SessionModel.findByIdAndUpdate(
      sessionId,
      { $inc: { nextEventId: 1 } },
      { new: true, projection: { nextEventId: 1 } },
    )) as { nextEventId: number } | null;

    const eventId = updated?.nextEventId ?? 0;
    const storedEvent: StoredSessionEvent = {
      id: eventId,
      type: typedEvent.type as StoredSessionEvent['type'],
      data: typedEvent as Record<string, unknown>,
      timestamp: typedEvent.timestamp ?? new Date().toISOString(),
    };

    await SessionModel.updateOne(
      { _id: sessionId },
      { $push: { events: { $each: [storedEvent], $slice: -100 } } },
    );

    await publisher.publish(channel, JSON.stringify(storedEvent));
  }

  // -------------------------------------------------------------------------
  // Helper: check if session was cancelled
  // -------------------------------------------------------------------------
  async function isCancelled(): Promise<boolean> {
    const session = (await SessionModel.findById(sessionId, { status: 1 }).lean()) as {
      status: string;
    } | null;
    return session?.status === 'cancelled';
  }

  // -------------------------------------------------------------------------
  // Step 1: Emit session_started
  // -------------------------------------------------------------------------
  const sessionStarted: SessionStartedEvent = {
    type: 'session_started',
    sessionId,
    userId,
    config: config as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
  };
  await emitEvent(sessionStarted);

  // -------------------------------------------------------------------------
  // Step 2: Search — iterate config.platforms, one search per platform (SRCH-03, AUTO-01)
  // Each platform gets 20 results minimum for adequate per-platform coverage.
  // -------------------------------------------------------------------------
  const allRawJobs: RawJobResult[] = [];
  const platformsToSearch: PlatformId[] =
    config.platforms.length > 0 ? config.platforms : ['linkedin'];

  for (const platform of platformsToSearch) {
    process.stdout.write(
      chalk.blue(
        `[pipeline] Searching platform '${platform}' — keywords: ${config.keywords.join(', ')} in ${config.location}\n`,
      ),
    );

    const platformJobs = await adapter.search({
      keywords: config.keywords,
      location: config.location,
      modality: config.modality,
      datePosted: config.datePosted,
      minResults: 20,
      maxPages: 5,
    });

    allRawJobs.push(...platformJobs);
    process.stdout.write(
      chalk.blue(`[pipeline] Platform '${platform}' returned ${platformJobs.length} results\n`),
    );
  }

  process.stdout.write(
    chalk.blue(
      `[pipeline] Total: ${allRawJobs.length} raw results across ${platformsToSearch.length} platform(s)\n`,
    ),
  );

  // -------------------------------------------------------------------------
  // Step 3: Local filtering
  // -------------------------------------------------------------------------
  const excludedSet = new Set(config.excludedCompanies.map((c) => c.toLowerCase().trim()));
  const filtered: RawJobResult[] = [];

  for (const job of allRawJobs) {
    // Missing required fields — emit 'missing_fields' reason (NOT 'excluded_company')
    if (!job.title || !job.company || !job.description || !job.url) {
      totals.skipped++;
      await emitEvent({
        type: 'job_skipped',
        jobId: job.jobId,
        reason: 'missing_fields',
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    // Excluded company (case-insensitive)
    if (excludedSet.has(job.company.toLowerCase().trim())) {
      totals.skipped++;
      await emitEvent({
        type: 'job_skipped',
        jobId: job.jobId,
        reason: 'excluded_company',
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    // Dedup check against vacancy history (per-user scope, NF-08)
    const isDuplicate = await VacancyModel.findOne({
      userId,
      $or: [
        { url: job.url },
        {
          company: { $regex: new RegExp(`^${escapeRegex(job.company.trim())}$`, 'i') },
          title: { $regex: new RegExp(`^${escapeRegex(job.title.trim())}$`, 'i') },
        },
      ],
    })
      .lean()
      .exec();

    if (isDuplicate) {
      totals.skipped++;
      await emitEvent({
        type: 'job_skipped',
        jobId: job.jobId,
        reason: 'already_applied',
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    filtered.push(job);
  }

  process.stdout.write(
    chalk.blue(
      `[pipeline] ${filtered.length} jobs after filtering (${allRawJobs.length - filtered.length} filtered out)\n`,
    ),
  );

  // -------------------------------------------------------------------------
  // Steps 4-6: Batch scoring, persistence, and event emission
  // -------------------------------------------------------------------------
  const BATCH_SIZE = 5;
  let limitReached = false;

  for (let i = 0; i < filtered.length && !limitReached; i += BATCH_SIZE) {
    // Cancellation check before each batch
    if (await isCancelled()) {
      process.stdout.write(
        chalk.yellow(`[pipeline] Session ${sessionId} cancelled — stopping pipeline\n`),
      );
      break;
    }

    const batch = filtered.slice(i, i + BATCH_SIZE);
    const scoringInputs: ScoringInput[] = batch.map((job, idx) => ({
      index: idx,
      title: job.title,
      company: job.company,
      description: job.description,
      location: job.location,
    }));

    const scores = await scorer.scoreBatch(scoringInputs, profile);

    // Process each scored job in the batch
    for (let j = 0; j < batch.length; j++) {
      const job = batch[j];
      const scoreResult = scores.find((s) => s.index === j);
      const score = scoreResult?.score ?? 0;
      const reason = scoreResult?.reason ?? 'no_score';
      const now = new Date().toISOString();

      // Persist vacancy to MongoDB
      try {
        await VacancyModel.create({
          jobId: job.jobId,
          title: job.title,
          company: job.company,
          description: job.description,
          url: job.url,
          location: job.location,
          platform: job.platform,
          postedAt: job.postedAt,
          compatibilityScore: score,
          scoreReason: reason,
          status: 'new',
          userId,
          sessionId,
          discoveredAt: now,
          filterReason: score < config.minScoreToApply ? 'score_below_threshold' : undefined,
        });
      } catch (err: unknown) {
        // Duplicate key error (E11000) — skip silently
        if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
          totals.skipped++;
          continue;
        }
        throw err;
      }

      if (score >= config.minScoreToApply) {
        totals.found++;
        const jobFoundEvent: JobFoundEvent = {
          type: 'job_found',
          jobId: job.jobId,
          title: job.title,
          company: job.company,
          location: job.location,
          platform: job.platform,
          compatibilityScore: score,
          url: job.url,
          timestamp: now,
        };
        await emitEvent(jobFoundEvent);

        // APPLY-04: Stop after maxApplicationsPerSession found vacancies
        if (totals.found >= config.maxApplicationsPerSession) {
          process.stdout.write(
            chalk.yellow(
              `[pipeline] Reached maxApplicationsPerSession limit (${config.maxApplicationsPerSession}) — stopping\n`,
            ),
          );
          limitReached = true;
          break;
        }
      } else {
        totals.skipped++;
        const jobSkippedEvent: JobSkippedEvent = {
          type: 'job_skipped',
          jobId: job.jobId,
          reason: 'score_too_low',
          timestamp: now,
        };
        await emitEvent(jobSkippedEvent);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 7: Emit session_complete
  // -------------------------------------------------------------------------
  const sessionComplete: SessionCompleteEvent = {
    type: 'session_complete',
    sessionId,
    totals,
    durationMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
  await emitEvent(sessionComplete);

  process.stdout.write(
    chalk.green(
      `[pipeline] Complete: found=${totals.found}, skipped=${totals.skipped}, duration=${Date.now() - startTime}ms\n`,
    ),
  );

  return totals;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escapes special regex characters in a string for use in RegExp constructor */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
