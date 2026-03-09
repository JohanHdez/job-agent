import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { encrypt } from '../../../common/crypto.util.js';

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
}

export const UserSchema = SchemaFactory.createForClass(User);

/**
 * Pre-save hook: encrypts `linkedinAccessToken` before persisting to MongoDB.
 *
 * Only re-encrypts when the field has been modified to avoid double-encryption
 * on subsequent saves that do not touch the token.
 *
 * The stored value follows the format produced by {@link encrypt}:
 * `iv:authTag:ciphertext` (all hex-encoded, AES-256-GCM).
 */
UserSchema.pre('save', function (next): void {
  if (this.isModified('linkedinAccessToken') && this.linkedinAccessToken) {
    try {
      this.linkedinAccessToken = encrypt(this.linkedinAccessToken);
    } catch (err: unknown) {
      return next(err instanceof Error ? err : new Error(String(err)));
    }
  }
  next();
});

/** TTL index: automatically remove expired refresh token documents.
 *  Note: This works at the array element level only with MongoDB's
 *  partial filter — in production, switch to Redis with per-token TTL. */
UserSchema.index({ 'refreshTokens.expiresAt': 1 });
