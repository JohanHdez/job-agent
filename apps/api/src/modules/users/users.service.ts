import { Injectable, BadRequestException, NotFoundException, RequestTimeoutException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { AppConfig, ProfessionalProfile, SearchPresetType, SmtpConfigType } from '@job-agent/core';
import { User, UserDocument } from './schemas/user.schema.js';
import { encryptToken } from '../../common/crypto/token-cipher.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { CreatePresetDto } from './dto/create-preset.dto.js';
import { UpdatePresetDto } from './dto/update-preset.dto.js';
import { UpdateSmtpConfigDto } from './dto/update-smtp-config.dto.js';

export interface UpsertLinkedInUserDto {
  linkedinId: string;
  email: string;
  name: string;
  photo?: string;
  headline?: string;
  accessToken: string;
}

export interface UpsertGoogleUserDto {
  googleId: string;
  email: string;
  name: string;
  photo?: string;
  accessToken?: string;
}

/**
 * Manages all user persistence operations.
 * OAuth tokens are stored AES-256-GCM encrypted at rest.
 */
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  /**
   * Creates or updates a user from a LinkedIn OAuth callback.
   * If a user with the same email already exists, links the LinkedIn identity.
   */
  async upsertFromLinkedIn(dto: UpsertLinkedInUserDto): Promise<UserDocument> {
    const encryptedToken = encryptToken(dto.accessToken);

    const user = await this.userModel.findOneAndUpdate(
      { $or: [{ linkedinId: dto.linkedinId }, { email: dto.email }] },
      {
        $set: {
          linkedinId: dto.linkedinId,
          email: dto.email,
          name: dto.name,
          ...(dto.photo ? { photo: dto.photo } : {}),
          ...(dto.headline ? { headline: dto.headline } : {}),
          linkedinAccessToken: encryptedToken,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return user;
  }

  /**
   * Creates or updates a user from a Google OAuth callback.
   * If a user with the same email already exists, links the Google identity.
   */
  async upsertFromGoogle(dto: UpsertGoogleUserDto): Promise<UserDocument> {
    const encryptedToken = dto.accessToken ? encryptToken(dto.accessToken) : undefined;

    const user = await this.userModel.findOneAndUpdate(
      { $or: [{ googleId: dto.googleId }, { email: dto.email }] },
      {
        $set: {
          googleId: dto.googleId,
          email: dto.email,
          name: dto.name,
          ...(dto.photo ? { photo: dto.photo } : {}),
          ...(encryptedToken ? { googleAccessToken: encryptedToken } : {}),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return user;
  }

  /** Stores a new refresh token for the user. */
  async addRefreshToken(userId: string, token: string, ttlDays = 7): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

    await this.userModel.updateOne(
      { _id: userId },
      { $push: { refreshTokens: { token, issuedAt: now, expiresAt } } }
    );
  }

  /** Removes a specific refresh token (logout or rotation). */
  async removeRefreshToken(userId: string, token: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $pull: { refreshTokens: { token } } }
    );
  }

  /** Removes all expired refresh tokens from all users (maintenance). */
  async pruneExpiredTokens(): Promise<void> {
    await this.userModel.updateMany(
      {},
      { $pull: { refreshTokens: { expiresAt: { $lt: new Date() } } } }
    );
  }

  /** Finds a user by their MongoDB _id. */
  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  /** Finds a user by email (case-insensitive via schema lowercase option). */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /**
   * Validates a refresh token: checks it exists and is not expired.
   * Returns the user if valid, null otherwise.
   */
  async validateRefreshToken(token: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        refreshTokens: {
          $elemMatch: { token, expiresAt: { $gt: new Date() } },
        },
      })
      .exec();
  }

  // ── Phase 2: Profile + User identity management ──────────────────────────

  /**
   * Updates editable user identity fields (name, contactEmail, languagePreference).
   * Uses { _id: userId } filter — NF-08 row-level security.
   */
  async updateUser(userId: string, dto: UpdateUserDto): Promise<UserDocument> {
    const updateFields: Record<string, unknown> = {};
    if (dto.name !== undefined) updateFields['name'] = dto.name;
    if (dto.contactEmail !== undefined) updateFields['contactEmail'] = dto.contactEmail;
    if (dto.languagePreference !== undefined) updateFields['languagePreference'] = dto.languagePreference;

    const user = await this.userModel.findOneAndUpdate(
      { _id: userId },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Merges an incoming profile into the user's existing profile.
   * Fill-empty-only semantics: existing non-empty fields are never overwritten.
   * Used by CV upload pipeline (PROF-02).
   */
  async mergeProfile(userId: string, incoming: Partial<ProfessionalProfile>): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const existing = (user.profile as Partial<ProfessionalProfile> | null) ?? {};
    const merged: Record<string, unknown> = { ...incoming };

    for (const key of Object.keys(incoming) as Array<keyof ProfessionalProfile>) {
      const existingVal = existing[key];
      if (Array.isArray(existingVal) && existingVal.length > 0) {
        merged[key] = existingVal;
      } else if (existingVal !== undefined && existingVal !== null && existingVal !== '') {
        merged[key] = existingVal;
      }
    }

    return (await this.userModel.findOneAndUpdate(
      { _id: userId },
      { $set: { profile: merged } },
      { new: true, runValidators: true }
    ).exec()) as UserDocument;
  }

  /**
   * Directly overwrites the provided profile fields (PROF-03 edit mode).
   * Unlike mergeProfile, this always sets the given fields regardless of existing values.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDocument> {
    const updateFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) updateFields[`profile.${key}`] = value;
    }

    const user = await this.userModel.findOneAndUpdate(
      { _id: userId },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Returns missing profile fields required for job search.
   * Missing = skills is empty, seniority is absent, or experience is empty (PROF-04).
   */
  checkProfileCompleteness(user: UserDocument): string[] {
    const profile = user.profile as Partial<ProfessionalProfile> | null;
    const missing: string[] = [];
    if (!profile) return ['skills', 'seniority', 'experience'];
    if (!profile.skills || profile.skills.length === 0) missing.push('skills');
    if (!profile.seniority) missing.push('seniority');
    if (!profile.experience || profile.experience.length === 0) missing.push('experience');
    return missing;
  }

  /**
   * Accepts a PDF buffer, writes to a temp file, parses with Claude API via cv-parser,
   * then merge-applies the result to the user's profile.
   * Enforces 7-second timeout (NF-03). Always cleans up the temp file.
   */
  async importCvProfile(userId: string, buffer: Buffer): Promise<UserDocument> {
    const CV_PARSE_TIMEOUT_MS = 7000;
    const tmpPath = join(tmpdir(), `cv-${randomUUID()}.pdf`);
    try {
      await writeFile(tmpPath, buffer);

      const { runCvParser } = await import('@job-agent/cv-parser');
      const profile = await Promise.race([
        runCvParser(tmpPath),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new RequestTimeoutException('CV parsing timed out (>7s)')),
            CV_PARSE_TIMEOUT_MS
          )
        ),
      ]);

      // CV upload always replaces the full profile — the user is explicitly refreshing their data.
      const user = await this.userModel.findOneAndUpdate(
        { _id: userId },
        { $set: { profile } },
        { new: true, runValidators: true }
      ).exec();
      if (!user) throw new NotFoundException('User not found');
      return user;
    } finally {
      await unlink(tmpPath).catch(() => { /* best-effort cleanup */ });
    }
  }

  // ── Search Config ─────────────────────────────────────────────────────────

  /** Returns the user's persisted AppConfig, or null if never saved. */
  async getSearchConfig(userId: string): Promise<AppConfig | null> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    return (user.searchConfig as AppConfig | null) ?? null;
  }

  /** Persists the full AppConfig for the user. */
  async saveSearchConfig(userId: string, config: AppConfig): Promise<AppConfig> {
    const user = await this.userModel.findOneAndUpdate(
      { _id: userId },
      { $set: { searchConfig: config } },
      { new: true, runValidators: true }
    ).exec();
    if (!user) throw new NotFoundException('User not found');
    return (user.searchConfig as AppConfig);
  }

  /**
   * Seeds searchConfig.search fields from the parsed CV profile.
   * Only sets keywords (skills + techStack) and seniority — leaves other
   * fields untouched so user-defined values are never overwritten.
   * Called automatically after CV import.
   */
  async seedSearchConfigFromProfile(userId: string, profile: ProfessionalProfile): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) return;

    const existing = (user.searchConfig as AppConfig | null);

    // Build role-based keywords: headline + most recent job titles (3 max).
    // JSearch expects a job role query (e.g. "Senior Full Stack Developer"), not a skill list.
    const roleTitles = (profile.experience ?? [])
      .slice(0, 2)
      .map((exp) => exp.title)
      .filter(Boolean);

    const keywords = Array.from(new Set([
      ...(profile.headline ? [profile.headline] : []),
      ...roleTitles,
    ])).slice(0, 3);

    const seniority = profile.seniority ? [profile.seniority] : ['Mid'];

    const merged: AppConfig = {
      search: {
        keywords,
        location: existing?.search?.location ?? 'Remote',
        modality: existing?.search?.modality ?? ['Remote'],
        languages: existing?.search?.languages ?? ['English'],
        seniority,
        datePosted: existing?.search?.datePosted ?? 'past_month',
        excludedCompanies: existing?.search?.excludedCompanies ?? [],
        platforms: existing?.search?.platforms ?? ['linkedin'],
        maxJobsToFind: existing?.search?.maxJobsToFind ?? 100,
      },
      matching: existing?.matching ?? { minScoreToApply: 70, maxApplicationsPerSession: 10 },
      coverLetter: existing?.coverLetter ?? { language: 'en', tone: 'professional' },
      report: existing?.report ?? { format: 'both' },
    };

    await this.userModel.findOneAndUpdate(
      { _id: userId },
      { $set: { searchConfig: merged } }
    ).exec();
  }

  // ── Phase 2: Search preset CRUD ──────────────────────────────────────────

  /** Returns the user's named search presets (SRCH-01). */
  async getPresets(userId: string): Promise<SearchPresetType[]> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    return (user.searchPresets as SearchPresetType[]) ?? [];
  }

  /**
   * Creates a new named search preset and adds it to the user's presets array.
   * Enforces 5-preset maximum (SRCH-02).
   */
  async createPreset(userId: string, dto: CreatePresetDto): Promise<SearchPresetType> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    if ((user.searchPresets ?? []).length >= 5) {
      throw new BadRequestException('Maximum 5 presets reached. Delete one first.');
    }

    const preset: SearchPresetType = {
      id: randomUUID(),
      name: dto.name,
      keywords: dto.keywords,
      location: dto.location,
      modality: dto.modality as SearchPresetType['modality'],
      platforms: dto.platforms as SearchPresetType['platforms'],
      seniority: dto.seniority,
      languages: dto.languages,
      datePosted: dto.datePosted as SearchPresetType['datePosted'],
      minScoreToApply: dto.minScoreToApply,
      maxApplicationsPerSession: dto.maxApplicationsPerSession,
      excludedCompanies: dto.excludedCompanies ?? [],
    };

    await this.userModel.updateOne(
      { _id: userId },
      { $push: { searchPresets: preset } }
    );

    return preset;
  }

  /** Updates the fields of an existing search preset. Returns the updated user document. */
  async updatePreset(userId: string, presetId: string, dto: UpdatePresetDto): Promise<UserDocument> {
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) setFields[`searchPresets.$.${key}`] = value;
    }

    const user = await this.userModel.findOneAndUpdate(
      { _id: userId, 'searchPresets.id': presetId },
      { $set: setFields },
      { new: true, runValidators: true }
    ).exec();
    if (!user) throw new NotFoundException('Preset not found');
    return user;
  }

  /** Removes a preset from the user's presets array. */
  async deletePreset(userId: string, presetId: string): Promise<UserDocument> {
    const user = await this.userModel.findOneAndUpdate(
      { _id: userId },
      { $pull: { searchPresets: { id: presetId } } },
      { new: true }
    ).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Sets the active preset for job search. */
  async setActivePreset(userId: string, presetId: string): Promise<UserDocument> {
    const user = await this.userModel.findOneAndUpdate(
      { _id: userId },
      { $set: { activePresetId: presetId } },
      { new: true }
    ).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── Phase 5: SMTP Configuration (APPLY-02) ────────────────────────────────

  /**
   * Save SMTP configuration for email applications (APPLY-02).
   * Encrypts the password using AES-256-GCM before storage.
   * If user authenticated via Google and fromEmail is not provided,
   * pre-fills fromEmail with their Google account email.
   */
  async saveSmtpConfig(userId: string, dto: UpdateSmtpConfigDto): Promise<{ saved: true }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    // Google OAuth pre-fill: if user has googleId and no fromEmail provided, use their account email
    const fromEmail = dto.fromEmail || (user.googleId ? user.email : '');
    if (!fromEmail) throw new BadRequestException('fromEmail is required');

    const encrypted = encryptToken(dto.password);

    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          smtpConfig: {
            host: dto.host,
            port: dto.port,
            secure: dto.secure ?? false,
            user: dto.user,
            password: encrypted,
            fromName: dto.fromName,
            fromEmail,
          },
        },
      },
    ).exec();

    return { saved: true };
  }

  /**
   * Get SMTP configuration with masked password.
   * Never returns the actual encrypted password — only '********'.
   * Returns null if the user has no SMTP config configured.
   */
  async getSmtpConfig(userId: string): Promise<{
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromName: string;
    fromEmail: string;
  } | null> {
    const user = await this.userModel.findById(userId).select('smtpConfig').exec();
    if (!user?.smtpConfig) return null;

    return {
      host: user.smtpConfig.host,
      port: user.smtpConfig.port,
      secure: user.smtpConfig.secure,
      user: user.smtpConfig.user,
      password: '********',  // NEVER expose the encrypted value
      fromName: user.smtpConfig.fromName,
      fromEmail: user.smtpConfig.fromEmail,
    };
  }

  /**
   * Get raw SMTP config (with encrypted password) for internal use by EmailSenderService.
   * NOT exposed via any API endpoint — internal use only.
   */
  async getSmtpConfigRaw(userId: string): Promise<SmtpConfigType | null> {
    const user = await this.userModel.findById(userId).select('smtpConfig').exec();
    if (!user?.smtpConfig) return null;
    return user.smtpConfig as SmtpConfigType;
  }
}
