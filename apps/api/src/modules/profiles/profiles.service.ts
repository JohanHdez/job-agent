import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { Logger } from 'winston';
import { runCvParser } from '@job-agent/cv-parser';
import type { ProfessionalProfile } from '@job-agent/core';
import { LOGGER } from '../logger/logger.constants.js';
import { decryptToken } from '../../common/crypto/token-cipher.js';
import { UserProfile, UserProfileDocument } from './schemas/user-profile.schema.js';
import type { PatchProfileDto } from './dto/patch-profile.dto.js';

/** Result shape returned by importFromLinkedin */
export interface LinkedInImportResult {
  profile: UserProfileDocument;
  imported: string[];
  missing: string[];
}

const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/oidc/userinfo';
const LINKEDIN_V2_ME_URL =
  'https://api.linkedin.com/v2/me?projection=(localizedHeadline)';

/**
 * Handles all professional profile operations:
 * CV upload, LinkedIn import, profile retrieval, partial update,
 * and completeness checking.
 */
@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(UserProfile.name)
    private readonly profileModel: Model<UserProfileDocument>,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  // ── Public methods ────────────────────────────────────────────────────────

  /**
   * Imports professional data from LinkedIn using the stored OAuth access token.
   *
   * Fetches OIDC userinfo (name + email) and optionally v2/me (headline).
   * If v2/me returns a non-2xx status, the field is added to `missing[]` instead of throwing.
   * Never throws on a LinkedIn 403 — always returns a partial result.
   *
   * @param userId - MongoDB User._id (string)
   * @param encryptedToken - AES-256-GCM encrypted LinkedIn access token
   * @returns { profile, imported: string[], missing: string[] }
   */
  async importFromLinkedin(
    userId: string,
    encryptedToken: string
  ): Promise<LinkedInImportResult> {
    const imported: string[] = [];
    const missing: string[] = [];

    const decryptedToken = decryptToken(encryptedToken);
    const authHeader = `Bearer ${decryptedToken}`;

    // ── Step 1: OIDC userinfo (name + email) ────────────────────────────────
    const partial: Partial<ProfessionalProfile> = {
      skills: [],
      techStack: [],
      languages: [],
      experience: [],
      education: [],
    };

    const userinfoRes = await fetch(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: authHeader },
    });

    if (userinfoRes.ok) {
      const userinfo = await userinfoRes.json() as Record<string, unknown>;

      if (typeof userinfo['name'] === 'string') {
        partial.fullName = userinfo['name'];
        imported.push('name');
      }
      if (typeof userinfo['email'] === 'string') {
        partial.email = userinfo['email'];
        imported.push('email');
      }
    } else {
      this.logger.warn('LinkedIn OIDC userinfo failed', {
        userId,
        status: userinfoRes.status,
      });
      missing.push('name', 'email');
    }

    // ── Step 2: v2/me — headline (optional, 403 is common for non-partner apps) ──
    try {
      const meRes = await fetch(LINKEDIN_V2_ME_URL, {
        headers: { Authorization: authHeader },
      });

      if (meRes.ok) {
        const me = await meRes.json() as Record<string, unknown>;
        if (typeof me['localizedHeadline'] === 'string') {
          partial.headline = me['localizedHeadline'];
          imported.push('headline');
        }
      } else {
        this.logger.warn('LinkedIn v2/me returned non-2xx', {
          userId,
          status: meRes.status,
        });
        missing.push('headline');
      }
    } catch (err) {
      this.logger.warn('LinkedIn v2/me request failed', { userId, err });
      missing.push('headline');
    }

    // Ensure required fields have fallback values so the schema validates
    if (!partial.fullName) partial.fullName = '';
    if (!partial.email) partial.email = '';
    if (!partial.headline) partial.headline = '';
    if (!partial.summary) partial.summary = '';
    if (!partial.seniority) partial.seniority = 'Mid';
    if (partial.yearsOfExperience === undefined) partial.yearsOfExperience = 0;

    const profile = await this.upsertProfile(userId, partial);

    this.logger.info('LinkedIn import complete', { userId, imported, missing });

    return { profile, imported, missing };
  }

  /**
   * Parses a CV PDF buffer and upserts the resulting profile.
   * Writes a temp file, calls runCvParser, then cleans up in a finally block.
   *
   * @param userId - MongoDB User._id (string)
   * @param buffer - Raw PDF bytes from the multipart upload
   * @returns The upserted UserProfileDocument
   */
  async uploadCv(userId: string, buffer: Buffer): Promise<UserProfileDocument> {
    const tmpPath = `${tmpdir()}/cv-${userId}-${Date.now()}.pdf`;

    try {
      await writeFile(tmpPath, buffer);

      this.logger.info('Running CV parser', { userId, tmpPath });
      const parsed = await runCvParser(tmpPath);

      const profile = await this.upsertProfile(userId, parsed);
      this.logger.info('CV parsed and profile upserted', { userId });
      return profile;
    } finally {
      await unlink(tmpPath).catch((err: unknown) => {
        this.logger.warn('Failed to delete tmp CV file', { tmpPath, err });
      });
    }
  }

  /**
   * Applies partial field updates to the user's profile.
   * Throws NotFoundException if the profile does not exist.
   *
   * @param userId - MongoDB User._id (string)
   * @param dto - Fields to update
   * @returns The updated UserProfileDocument
   */
  async patchProfile(
    userId: string,
    dto: PatchProfileDto
  ): Promise<UserProfileDocument> {
    const updated = await this.profileModel.findOneAndUpdate(
      { userId },
      { $set: dto },
      { upsert: false, new: true }
    );

    if (!updated) {
      throw new NotFoundException('Profile not found');
    }

    this.logger.info('Profile patched', { userId });
    return updated;
  }

  /**
   * Returns the user's profile document, or null if none exists.
   *
   * @param userId - MongoDB User._id (string)
   */
  async getProfile(userId: string): Promise<UserProfileDocument | null> {
    return this.profileModel.findOne({ userId }).exec();
  }

  /**
   * Checks which critical profile fields are missing.
   *
   * @param profile - The UserProfileDocument (or null if none exists)
   * @returns Array of missing field name strings; empty array when profile is complete.
   */
  checkCompleteness(profile: UserProfileDocument | null): string[] {
    if (!profile) return ['skills', 'work experience', 'years of experience'];

    const missing: string[] = [];

    if (!profile.skills || profile.skills.length === 0) {
      missing.push('skills');
    }
    if (!profile.experience || profile.experience.length === 0) {
      missing.push('work experience');
    }
    if (profile.yearsOfExperience === 0 || profile.yearsOfExperience === undefined) {
      missing.push('years of experience');
    }

    return missing;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Upserts a profile document keyed by userId.
   * Uses upsert: true so both first-time import and subsequent updates work.
   *
   * @param userId - MongoDB User._id (string)
   * @param partial - Fields to set on the document
   */
  private async upsertProfile(
    userId: string,
    partial: Partial<ProfessionalProfile>
  ): Promise<UserProfileDocument> {
    const doc = await this.profileModel.findOneAndUpdate(
      { userId },
      { $set: partial },
      { upsert: true, new: true }
    );

    // findOneAndUpdate with upsert:true always returns a document
    return doc as UserProfileDocument;
  }
}
