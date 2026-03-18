import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { ProfessionalProfile, SearchPresetType, SmtpConfigType } from '@job-agent/core';

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

  // ── Phase 2: Profile + Search Presets ───────────────────────────────────────

  /**
   * Parsed CV / professional profile stored as a flexible subdocument.
   * Shape mirrors ProfessionalProfile from @job-agent/core.
   */
  @Prop({ type: Object, default: null })
  profile!: ProfessionalProfile | null;

  /**
   * Named search configuration presets saved by the user.
   * Each element mirrors SearchPresetType from @job-agent/core.
   */
  @Prop({ type: [Object], default: [] })
  searchPresets!: SearchPresetType[];

  /** ID of the currently active search preset (null = none selected). */
  @Prop({ type: String, default: null })
  activePresetId!: string | null;

  /** User's preferred platform language: 'en' | 'es' (AUTH-04). */
  @Prop({ type: String, default: 'en' })
  languagePreference!: string;

  /**
   * Contact email — separate from the OAuth provider email.
   * Editable by the user (AUTH-04).
   */
  @Prop({ type: String })
  contactEmail?: string;

  // ── Phase 5: SMTP Configuration ─────────────────────────────────────────────

  /**
   * SMTP configuration for sending email applications.
   * Password is stored AES-256-GCM encrypted (same pattern as OAuth tokens).
   * Never exposed in API responses — only used server-side for sending.
   */
  @Prop({
    type: {
      host: { type: String, required: true },
      port: { type: Number, required: true },
      secure: { type: Boolean, default: false },
      user: { type: String, required: true },
      password: { type: String, required: true },  // AES-256-GCM encrypted
      fromName: { type: String, required: true },
      fromEmail: { type: String, required: true },
    },
    default: null,
  })
  smtpConfig!: SmtpConfigType | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

/** TTL index: automatically remove expired refresh token documents.
 *  Note: This works at the array element level only with MongoDB's
 *  partial filter — in production, switch to Redis with per-token TTL. */
UserSchema.index({ 'refreshTokens.expiresAt': 1 });
