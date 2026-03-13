import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  Language,
  WorkExperience,
  Education,
} from '@job-agent/core';

export type UserProfileDocument = HydratedDocument<UserProfile>;

/**
 * Mongoose schema for the UserProfile entity.
 * Mirrors ProfessionalProfile from @job-agent/core, keyed by userId (MongoDB _id of the User).
 *
 * userId has a unique index to prevent duplicate profiles on concurrent upserts.
 */
@Schema({ timestamps: true, collection: 'profiles' })
export class UserProfile {
  /** MongoDB _id of the owning User (foreign key). Unique index enforced via UserProfileSchema.index below. */
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  fullName!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop()
  phone?: string;

  @Prop()
  location?: string;

  @Prop()
  linkedinUrl?: string;

  @Prop({ required: true })
  headline!: string;

  @Prop({ required: true })
  summary!: string;

  @Prop({
    required: true,
    enum: ['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Executive'],
  })
  seniority!: 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Principal' | 'Executive';

  @Prop({ required: true, type: Number })
  yearsOfExperience!: number;

  @Prop({ type: [String], default: [] })
  skills!: string[];

  @Prop({ type: [String], default: [] })
  techStack!: string[];

  /** Language[] stored as subdocuments */
  @Prop({ type: [Object], default: [] })
  languages!: Language[];

  /** WorkExperience[] stored as subdocuments */
  @Prop({ type: [Object], default: [] })
  experience!: WorkExperience[];

  /** Education[] stored as subdocuments */
  @Prop({ type: [Object], default: [] })
  education!: Education[];
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);

// Enforce uniqueness at the DB level — prevents duplicate profiles on concurrent upserts
UserProfileSchema.index({ userId: 1 }, { unique: true });
