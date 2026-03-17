import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { SessionStatus, StoredSessionEvent } from '@job-agent/core';

/** Mongoose document type for Session — includes Mongoose-injected metadata */
export type SessionDocument = HydratedDocument<Session>;

/**
 * Mongoose schema for the Session entity.
 *
 * A session represents one full automation run: the worker finds jobs,
 * scores them, and applies on the user's behalf. All intermediate events
 * are stored in a ring-buffer `events` array (max 100 entries via
 * `$push` + `$slice` in the worker process).
 */
@Schema({ timestamps: true, collection: 'sessions' })
export class Session {
  /**
   * MongoDB ObjectId string of the user who initiated this session.
   * Indexed for per-user lookups.
   */
  @Prop({ required: true, index: true })
  userId!: string;

  /**
   * Lifecycle status of the session.
   * Transitions: queued → running → completed | cancelled | failed
   */
  @Prop({
    required: true,
    enum: ['queued', 'running', 'completed', 'cancelled', 'failed'],
    default: 'queued',
  })
  status!: SessionStatus;

  /**
   * Snapshot of the AppConfig.search + AppConfig.matching settings at the
   * moment the session was enqueued. Stored as a flexible object so past
   * sessions always reflect the config that was actually used.
   */
  @Prop({ type: Object, required: true })
  config!: Record<string, unknown>;

  /**
   * Ordered list of session events emitted by the worker.
   * Stored as a ring buffer — the worker trims to the last 100 entries
   * via `$push` + `$slice: -100` on every append.
   */
  @Prop({ type: [Object], default: [] })
  events!: StoredSessionEvent[];

  /**
   * Monotonically increasing counter used to assign unique `id` values
   * to each StoredSessionEvent. Starts at 0 and is incremented atomically
   * by the worker before each event append.
   */
  @Prop({ type: Number, default: 0 })
  nextEventId!: number;

  /** Wall-clock time when the worker picked up and began executing this session */
  @Prop()
  startedAt?: Date;

  /** Wall-clock time when the session reached a terminal status (completed | cancelled | failed) */
  @Prop()
  completedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Compound indexes for per-user queries
/** Covers: list sessions by user filtered by status (e.g. running sessions) */
SessionSchema.index({ userId: 1, status: 1 });
/** Covers: list sessions by user sorted newest-first */
SessionSchema.index({ userId: 1, createdAt: -1 });
