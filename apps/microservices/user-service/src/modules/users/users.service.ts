import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema.js';
import { encryptToken } from '../../common/crypto/token-cipher.js';

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

/**
 * Manages all user persistence operations.
 * OAuth tokens are stored AES-256-GCM encrypted at rest.
 */
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) { }

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
}
