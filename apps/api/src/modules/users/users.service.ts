import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { User, UserDocument, StoredPreset } from './schemas/user.schema.js';
import { encryptToken } from '../../common/crypto/token-cipher.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CreatePresetDto } from './dto/create-preset.dto.js';
import { UpdatePresetDto } from './dto/update-preset.dto.js';

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
}

/** Maximum number of presets a single user may store. */
const MAX_PRESETS_CONSTANT = 5;

/**
 * Manages all user persistence operations.
 * OAuth tokens are stored AES-256-GCM encrypted at rest.
 * All write operations filter by { _id: userId } to prevent cross-user access (NF-08).
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
    const user = await this.userModel.findOneAndUpdate(
      { $or: [{ googleId: dto.googleId }, { email: dto.email }] },
      {
        $set: {
          googleId: dto.googleId,
          email: dto.email,
          name: dto.name,
          ...(dto.photo ? { photo: dto.photo } : {}),
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

  // ── AUTH-04: Profile management ─────────────────────────────────────────────

  /**
   * Updates the user's own profile (name, email, language preference).
   * Always filters by { _id: userId } — no cross-user access possible (NF-08).
   * @param userId - MongoDB _id of the authenticated user
   * @param dto - Fields to update (all optional)
   * @returns The updated UserDocument
   */
  async updateProfile(userId: string, dto: UpdateUserDto): Promise<UserDocument> {
    const updated = await this.userModel.findOneAndUpdate(
      { _id: userId },
      { $set: dto },
      { new: true, runValidators: true }
    );

    if (!updated) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return updated;
  }

  // ── SRCH-01 / SRCH-02: Search presets ───────────────────────────────────────

  /**
   * Creates a new named search preset for the user.
   * Throws ConflictException if the user already has 5 presets (SRCH-02 limit).
   * @param userId - MongoDB _id of the authenticated user
   * @param dto - Preset name and full AppConfig search+matching configuration
   * @returns The newly created StoredPreset
   */
  async createPreset(userId: string, dto: CreatePresetDto): Promise<StoredPreset> {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.presets.length >= MAX_PRESETS_CONSTANT) {
      throw new ConflictException(
        `Cannot create more than ${MAX_PRESETS_CONSTANT} search presets`
      );
    }

    const newPreset: StoredPreset = {
      id: randomUUID(),
      name: dto.name,
      config: dto.config,
      createdAt: new Date(),
    };

    await this.userModel.updateOne(
      { _id: userId },
      { $push: { presets: newPreset } }
    );

    return newPreset;
  }

  /**
   * Returns all search presets for the authenticated user.
   * @param userId - MongoDB _id of the authenticated user
   * @returns Array of StoredPreset objects
   */
  async getPresets(userId: string): Promise<StoredPreset[]> {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return user.presets;
  }

  /**
   * Updates a single preset by id using the MongoDB positional operator.
   * Throws NotFoundException if the presetId does not exist in the user's presets.
   * @param userId - MongoDB _id of the authenticated user
   * @param presetId - The preset's generated UUID
   * @param dto - Fields to update (name and/or config)
   * @returns The updated StoredPreset
   */
  async updatePreset(
    userId: string,
    presetId: string,
    dto: UpdatePresetDto
  ): Promise<StoredPreset> {
    const setFields: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      setFields['presets.$[elem].name'] = dto.name;
    }
    if (dto.config !== undefined) {
      setFields['presets.$[elem].config'] = dto.config;
    }

    const result = await this.userModel.updateOne(
      { _id: userId },
      { $set: setFields },
      { arrayFilters: [{ 'elem.id': presetId }] }
    );

    if (result.modifiedCount === 0) {
      throw new NotFoundException(
        `Preset ${presetId} not found for user ${userId}`
      );
    }

    const user = await this.userModel.findById(userId).exec();
    const updated = user?.presets.find((p) => p.id === presetId);

    if (!updated) {
      throw new NotFoundException(
        `Preset ${presetId} not found after update`
      );
    }

    return updated;
  }

  /**
   * Deletes a preset from the user's presets array.
   * Throws NotFoundException if the presetId does not exist.
   * @param userId - MongoDB _id of the authenticated user
   * @param presetId - The preset's generated UUID
   */
  async deletePreset(userId: string, presetId: string): Promise<void> {
    const result = await this.userModel.updateOne(
      { _id: userId },
      { $pull: { presets: { id: presetId } } }
    );

    if (result.modifiedCount === 0) {
      throw new NotFoundException(
        `Preset ${presetId} not found for user ${userId}`
      );
    }
  }

  /**
   * Sets the active preset by id.
   * Throws NotFoundException if the presetId is not found in the user's presets.
   * @param userId - MongoDB _id of the authenticated user
   * @param presetId - The preset UUID to activate
   * @returns The updated UserDocument with activePresetId set
   */
  async setActivePreset(userId: string, presetId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const presetExists = user.presets.some((p) => p.id === presetId);

    if (!presetExists) {
      throw new NotFoundException(
        `Preset ${presetId} not found for user ${userId}`
      );
    }

    const updated = await this.userModel.findOneAndUpdate(
      { _id: userId },
      { $set: { activePresetId: presetId } },
      { new: true }
    );

    if (!updated) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return updated;
  }
}
