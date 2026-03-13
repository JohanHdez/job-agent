import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { PlatformId } from '@job-agent/core';

/** Auth providers a user can link to their account */
export type AuthProvider = 'linkedin' | 'google';

export type UserDocument = HydratedDocument<User>;

/** Stored OAuth refresh token with metadata */
interface StoredRefreshToken {
  token: string;
  issuedAt: Date;
  expiresAt: Date;
}

/**
 * Configuration snapshot stored inside a search preset.
 * Mirrors AppConfig.search + AppConfig.matching fields.
 */
export interface SearchPresetConfig {
  keywords: string[];
  location: string;
  modality: ('Remote' | 'Hybrid' | 'On-site')[];
  languages: string[];
  seniority: string[];
  datePosted: 'past_24h' | 'past_week' | 'past_month';
  excludedCompanies: string[];
  platforms: PlatformId[];
  maxJobsToFind: number;
  minScoreToApply: number;
  maxApplicationsPerSession: number;
  greenhouseCompanies?: string[];
}

/**
 * A named search preset embedded in the User document.
 * Users may have at most 5 presets simultaneously.
 */
export interface StoredPreset {
  id: string;
  name: string;
  config: SearchPresetConfig;
  createdAt: Date;
}

/**
 * Mongoose schema for the User entity.
 * A user can link multiple OAuth providers to a single account (via email match).
 */
@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop()
  photo?: string;

  @Prop()
  headline?: string;

  /** Preferred UI/communication language */
  @Prop({ enum: ['en', 'es'] })
  language?: 'en' | 'es';

  // ── LinkedIn ────────────────────────────────────────────────────────────────

  /** LinkedIn profile ID (from OAuth) */
  @Prop({ sparse: true, index: true })
  linkedinId?: string;

  /**
   * LinkedIn OAuth access token — stored AES-256-GCM encrypted.
   * Format: "iv:authTag:ciphertext" (all hex-encoded).
   */
  @Prop()
  linkedinAccessToken?: string;

  // ── Google ──────────────────────────────────────────────────────────────────

  /** Google profile ID (from OAuth) */
  @Prop({ sparse: true, index: true })
  googleId?: string;

  // ── JWT refresh tokens ──────────────────────────────────────────────────────

  /**
   * Active refresh tokens for this user.
   * Stored in MongoDB (Redis-ready: can be migrated to Redis with TTL index).
   */
  @Prop({
    type: [
      {
        token: { type: String, required: true },
        issuedAt: { type: Date, required: true },
        expiresAt: { type: Date, required: true },
      },
    ],
    default: [],
  })
  refreshTokens!: StoredRefreshToken[];

  // ── Search presets ──────────────────────────────────────────────────────────

  /**
   * Named search presets — at most 5 per user.
   * Each preset stores a full AppConfig.search + AppConfig.matching snapshot.
   */
  @Prop({
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        config: { type: Object, required: true },
        createdAt: { type: Date, required: true },
      },
    ],
    default: [],
    validate: {
      validator: (v: unknown[]) => v.length <= 5,
      message: 'A user cannot have more than 5 search presets',
    },
  })
  presets!: StoredPreset[];

  /** The id of the currently active preset (one of the presets[].id values). */
  @Prop()
  activePresetId?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

/** TTL index: automatically remove expired refresh token documents.
 *  Note: This works at the array element level only with MongoDB's
 *  partial filter — in production, switch to Redis with per-token TTL. */
UserSchema.index({ 'refreshTokens.expiresAt': 1 });
