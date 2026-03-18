import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createLogger } from '@job-agent/logger';
import type { VacancyStatus } from '@job-agent/core';
import { Vacancy, VacancyDocument } from './schemas/vacancy.schema.js';
import { detectRecipientEmail } from './email-detection.util.js';

const logger = createLogger('VacanciesService');

/**
 * Service for reading and updating vacancy documents.
 *
 * All queries enforce userId ownership per NF-08 row-level security.
 * Provides findBySession, updateStatus (dismiss), checkDuplicate, and insertMany.
 */
@Injectable()
export class VacanciesService {
  constructor(
    @InjectModel(Vacancy.name) private readonly vacancyModel: Model<VacancyDocument>,
  ) {}

  /**
   * Find all vacancies for a session, sorted by score descending.
   * Enforces userId ownership (NF-08).
   *
   * @param sessionId - MongoDB ObjectId string of the session
   * @param userId - MongoDB ObjectId string of the requesting user
   * @returns Array of VacancyDocument sorted by compatibilityScore descending
   */
  async findBySession(sessionId: string, userId: string): Promise<VacancyDocument[]> {
    return this.vacancyModel
      .find({ sessionId, userId })
      .sort({ compatibilityScore: -1 })
      .exec();
  }

  /**
   * Update vacancy status (e.g. dismiss to 'dismissed').
   * Enforces userId ownership — only the owning user can change a vacancy's status.
   *
   * @param vacancyId - MongoDB ObjectId string of the vacancy
   * @param userId - MongoDB ObjectId string of the requesting user
   * @param status - New status value to set
   * @returns Updated VacancyDocument
   * @throws NotFoundException when vacancy is not found or not owned by userId
   */
  async updateStatus(
    vacancyId: string,
    userId: string,
    status: VacancyStatus
  ): Promise<VacancyDocument> {
    const vacancy = await this.vacancyModel
      .findOneAndUpdate(
        { _id: vacancyId, userId },
        { $set: { status } },
        { new: true }
      )
      .exec();

    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }

    logger.info('Vacancy status updated', { vacancyId, userId, status });
    return vacancy;
  }

  /**
   * Check if a vacancy is a duplicate for this user.
   * Matches by url OR (company + title) case-insensitive.
   * Returns true if a duplicate exists (dismissed vacancies are still duplicates).
   *
   * @param userId - MongoDB ObjectId string of the user
   * @param url - Direct URL to the job listing
   * @param company - Company name for semantic dedup
   * @param title - Job title for semantic dedup
   * @returns true when a duplicate exists, false otherwise
   */
  async checkDuplicate(
    userId: string,
    url: string,
    company: string,
    title: string
  ): Promise<boolean> {
    const existing = await this.vacancyModel
      .findOne({
        userId,
        $or: [
          { url },
          {
            company: { $regex: new RegExp(`^${escapeRegex(company.trim())}$`, 'i') },
            title: { $regex: new RegExp(`^${escapeRegex(title.trim())}$`, 'i') },
          },
        ],
      })
      .lean()
      .exec();

    return existing !== null;
  }

  /**
   * Bulk insert vacancies, ignoring duplicates (MongoDB E11000 on unique index).
   * Runs email detection on each vacancy before persistence per Phase 5 CONTEXT.md decision.
   * Uses ordered: false so MongoDB continues past duplicate key errors.
   *
   * @param vacancies - Array of partial Vacancy objects to insert
   * @returns Array of successfully inserted VacancyDocument instances
   */
  async insertMany(vacancies: Partial<Vacancy>[]): Promise<VacancyDocument[]> {
    // Run email detection on each vacancy before persistence (Phase 5 CONTEXT.md requirement).
    // Only runs when recipientEmail is not already set (idempotent for re-insertion attempts).
    const enriched = vacancies.map(v => {
      if (v.recipientEmail === undefined && v.description) {
        const result = detectRecipientEmail(
          (v as Record<string, unknown>).apply_options as
            | Array<{ publisher?: string; apply_link?: string; is_direct?: boolean }>
            | undefined,
          v.description
        );
        return {
          ...v,
          recipientEmail: result.email ?? undefined,
          emailDetectionMethod: result.method,
        };
      }
      return v;
    });

    try {
      return await this.vacancyModel.insertMany(enriched, { ordered: false }) as VacancyDocument[];
    } catch (err: unknown) {
      // With ordered: false, MongoDB continues past duplicate key errors.
      // The successfully inserted docs are in err.insertedDocs (Mongoose 7+).
      if (err !== null && typeof err === 'object' && 'insertedDocs' in err) {
        const inserted = (err as { insertedDocs: VacancyDocument[] }).insertedDocs;
        logger.warn('Some vacancies were duplicates — inserted partial batch', { count: inserted.length });
        return inserted;
      }
      throw err;
    }
  }
}

/** Escape special regex characters in a string to prevent injection in dynamic patterns */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
