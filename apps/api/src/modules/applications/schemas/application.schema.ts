import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { ApplicationStatus } from '@job-agent/core';

/** Mongoose document type for Application — includes Mongoose-injected metadata */
export type ApplicationDocument = HydratedDocument<Application>;

/**
 * Mongoose schema for the Application entity.
 *
 * An application represents a user's email-based job application created
 * from a vacancy discovered during a search session (Phase 5).
 *
 * Unique constraint: one application per (userId, vacancyId) pair.
 * Indexes support:
 *   - HIST-01: filter by userId + status
 *   - HIST-02: list by userId sorted by createdAt descending
 */
@Schema({ timestamps: true, collection: 'applications' })
export class Application {
  /**
   * MongoDB ObjectId string of the user who owns this application.
   * All queries MUST filter by userId (NF-08 row-level security).
   */
  @Prop({ required: true, index: true })
  userId!: string;

  /** MongoDB ObjectId string of the vacancy being applied to */
  @Prop({ required: true, index: true })
  vacancyId!: string;

  /** Current status in the application lifecycle */
  @Prop({
    required: true,
    enum: [
      'draft',
      'pending_review',
      'sent',
      'tracking_active',
      'interview_scheduled',
      'offer_received',
      'rejected',
    ],
    default: 'draft',
  })
  status!: ApplicationStatus;

  /**
   * Generated email content (subject + body) ready for user review and dispatch.
   * Produced by the EmailDraftAdapter at application creation time.
   */
  @Prop({
    type: {
      subject: { type: String, required: true },
      body: { type: String, required: true },
    },
    required: true,
  })
  emailContent!: { subject: string; body: string };

  /** Recipient email address for the application */
  @Prop({ required: true })
  recipientEmail!: string;

  /**
   * Ordered audit trail of status transitions.
   * Each entry records the status set, when, and an optional note.
   */
  @Prop({
    type: [
      {
        status: { type: String, required: true },
        timestamp: { type: String, required: true },
        note: { type: String },
      },
    ],
    default: [],
  })
  history!: Array<{ status: string; timestamp: string; note?: string }>;
}

export const ApplicationSchema = SchemaFactory.createForClass(Application);

// --- Constraint index ---

/** Unique constraint: one application per vacancy per user (APPLY-02) */
ApplicationSchema.index({ userId: 1, vacancyId: 1 }, { unique: true });

// --- Query support indexes ---

/** HIST-02: list user's applications sorted by creation date descending */
ApplicationSchema.index({ userId: 1, createdAt: -1 });

/** HIST-01: filter user's applications by status */
ApplicationSchema.index({ userId: 1, status: 1 });
