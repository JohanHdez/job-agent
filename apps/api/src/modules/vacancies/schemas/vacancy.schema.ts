import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { VacancyStatus } from '@job-agent/core';

/** Mongoose document type for Vacancy — includes Mongoose-injected metadata */
export type VacancyDocument = HydratedDocument<Vacancy>;

/**
 * Mongoose schema for the Vacancy entity.
 *
 * A vacancy represents a job posting discovered during a search session.
 * It is scored, deduplicated per user, and stored in the `vacancies` collection.
 *
 * Deduplication strategy (per-user scope, NF-08 row-level security):
 * - userId + url (unique)               — prevents same URL appearing twice for the same user
 * - userId + company + title (unique)   — catches duplicate postings across platforms
 */
@Schema({ timestamps: true, collection: 'vacancies' })
export class Vacancy {
  /**
   * Platform-specific unique job identifier.
   * Used for deduplication within the originating platform.
   */
  @Prop({ required: true, index: true })
  jobId!: string;

  /** Job title as shown on the platform */
  @Prop({ required: true })
  title!: string;

  /** Company posting the role */
  @Prop({ required: true })
  company!: string;

  /** Full job description text */
  @Prop({ required: true })
  description!: string;

  /** Direct URL to the job listing */
  @Prop({ required: true })
  url!: string;

  /** Location string (e.g. "Remote", "Buenos Aires, AR") */
  @Prop({ required: true })
  location!: string;

  /** Source platform identifier */
  @Prop({ required: true })
  platform!: string;

  /** ISO 8601 date string when the job was originally posted */
  @Prop()
  postedAt?: string;

  /** 0–100 compatibility score assigned by the scoring engine */
  @Prop({ required: true, min: 0, max: 100 })
  compatibilityScore!: number;

  /** Brief explanation of the score from the LLM scorer (max 15 words) */
  @Prop({ default: '' })
  scoreReason!: string;

  /** Current status in the user's vacancy history */
  @Prop({ required: true, enum: ['new', 'applied', 'dismissed', 'failed'], default: 'new' })
  status!: VacancyStatus;

  /**
   * MongoDB ObjectId string of the user who owns this record.
   * All queries MUST filter by userId (NF-08 row-level security).
   */
  @Prop({ required: true, index: true })
  userId!: string;

  /** MongoDB ObjectId string of the session that discovered this vacancy */
  @Prop({ required: true, index: true })
  sessionId!: string;

  /** ISO 8601 timestamp when this vacancy was first persisted */
  @Prop({ required: true })
  discoveredAt!: string;

  /**
   * Reason this vacancy was filtered out before scoring or persistence.
   * Only populated when the vacancy was not processed to completion.
   */
  @Prop()
  filterReason?: string;
}

export const VacancySchema = SchemaFactory.createForClass(Vacancy);

// --- Deduplication indexes (per-user scope) ---

/** Unique URL per user — prevents same job URL appearing twice for the same user */
VacancySchema.index({ userId: 1, url: 1 }, { unique: true });

/** Company+title compound per user — catches duplicate postings across platforms */
VacancySchema.index(
  { userId: 1, company: 1, title: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

/** Session lookup — list all vacancies for a session sorted by score descending */
VacancySchema.index({ sessionId: 1, compatibilityScore: -1 });

/** User history — list all vacancies for a user sorted by discovery time descending */
VacancySchema.index({ userId: 1, discoveredAt: -1 });
