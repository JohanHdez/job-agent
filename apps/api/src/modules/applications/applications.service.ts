/**
 * ApplicationsService — core service for the application lifecycle.
 *
 * Responsibilities:
 * - createDraft: generate Claude email draft, create Application document in 'draft' status
 * - sendApplication: dispatch email via SMTP, transition to 'sent' status
 * - findPaginated: paginated list with optional status/platform/dateRange filters (HIST-01)
 * - findById: full detail with vacancy populate (HIST-02)
 * - updateStatus: manual status transitions for tracking (HIST-03)
 * - exportCsv: CSV export of filtered applications (HIST-01)
 * - markPendingReview: transition draft -> pending_review when user opens review modal
 * - updateDraft: update email content before dispatch
 * - countPendingReview: badge count for nav (draft + pending_review)
 *
 * EmailDraftAdapter is injected via EMAIL_DRAFT_ADAPTER_TOKEN (NestJS DI),
 * NOT instantiated directly — preserves adapter pattern and testability.
 */

import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { EmailDraftAdapter, ProfessionalProfile } from '@job-agent/core';
import { Application, ApplicationDocument } from './schemas/application.schema.js';
import { Vacancy, VacancyDocument } from '../vacancies/schemas/vacancy.schema.js';
import { EmailSenderService } from './email-sender.service.js';
import { EMAIL_DRAFT_ADAPTER_TOKEN } from './applications.tokens.js';
import type { CreateApplicationDto } from './dto/create-application.dto.js';
import type { UpdateApplicationStatusDto } from './dto/update-application-status.dto.js';

/** Valid manual tracking states — user-controlled, not system-driven */
const VALID_MANUAL_STATES = [
  'tracking_active',
  'interview_scheduled',
  'offer_received',
  'rejected',
] as const;

/** Options for the paginated vacancy list with optional application status join */
export interface PaginatedApplicationFilters {
  page?: number;
  status?: string;
  company?: string;
  platform?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Paginated response for application list */
export interface PaginatedApplicationsResult {
  data: ApplicationDocument[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectModel(Application.name) private readonly applicationModel: Model<ApplicationDocument>,
    @InjectModel(Vacancy.name) private readonly vacancyModel: Model<VacancyDocument>,
    @Inject(EMAIL_DRAFT_ADAPTER_TOKEN) private readonly emailDraftAdapter: EmailDraftAdapter,
    private readonly emailSender: EmailSenderService,
  ) {}

  /**
   * Create a draft application with Claude-generated email content.
   *
   * APPLY-02 + APPLY-03: generates email draft via injected adapter so user can review before sending.
   * Returns 409 if application already exists for this user+vacancy pair.
   * Returns 404 if vacancy not found or not owned by userId.
   * Returns 400 if no recipient email available.
   *
   * @param userId - JWT-extracted user ID (NF-08)
   * @param dto - vacancyId and optional recipient email override
   * @param profile - User's professional profile for email personalization
   * @returns Newly created ApplicationDocument in 'draft' status
   */
  async createDraft(
    userId: string,
    dto: CreateApplicationDto,
    profile: ProfessionalProfile
  ): Promise<ApplicationDocument> {
    const vacancy = await this.vacancyModel.findOne({ _id: dto.vacancyId, userId }).exec();
    if (!vacancy) throw new NotFoundException('Vacancy not found');

    const existing = await this.applicationModel
      .findOne({ userId, vacancyId: dto.vacancyId })
      .exec();
    if (existing) throw new ConflictException('Application already exists for this vacancy');

    const recipientEmail = dto.recipientEmail ?? vacancy.recipientEmail;
    if (!recipientEmail) {
      throw new BadRequestException(
        'No recipient email available - provide one manually'
      );
    }

    const emailDraft = await this.emailDraftAdapter.generateDraft({
      profile,
      jobDescription: vacancy.description,
      jobTitle: vacancy.title,
      company: vacancy.company,
    });

    const now = new Date().toISOString();
    return this.applicationModel.create({
      userId,
      vacancyId: dto.vacancyId,
      status: 'draft',
      emailContent: emailDraft,
      recipientEmail,
      history: [{ status: 'draft', timestamp: now }],
    });
  }

  /**
   * Send the application email via SMTP.
   *
   * Transitions: draft/pending_review -> sent.
   * APPLY-02: dispatches email using user's decrypted SMTP credentials.
   * Also updates the associated vacancy status to 'applied'.
   *
   * @param userId - JWT-extracted user ID
   * @param applicationId - MongoDB ObjectId string of the application
   * @param encryptedGoogleToken - AES-256-GCM encrypted Google OAuth access token
   * @param fromName - Sender display name (user's full name)
   * @param fromEmail - Sender email (user's Google account email)
   * @returns Updated ApplicationDocument with 'sent' status
   */
  async sendApplication(
    userId: string,
    applicationId: string,
    encryptedGoogleToken: string,
    fromName: string,
    fromEmail: string,
  ): Promise<ApplicationDocument> {
    const app = await this.applicationModel.findOne({ _id: applicationId, userId }).exec();
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== 'draft' && app.status !== 'pending_review') {
      throw new BadRequestException(
        'Application must be in draft or pending_review to send'
      );
    }

    await this.emailSender.send({
      to: app.recipientEmail,
      subject: app.emailContent.subject,
      body: app.emailContent.body,
      fromName,
      fromEmail,
      encryptedGoogleToken,
    });

    const now = new Date().toISOString();
    app.status = 'sent';
    app.history.push({ status: 'sent', timestamp: now });
    await app.save();

    await this.vacancyModel
      .updateOne({ _id: app.vacancyId, userId }, { $set: { status: 'applied' } })
      .exec();

    return app;
  }

  /**
   * HIST-01: Get paginated applications with optional filters.
   * Supports: status, platform (via vacancy join), dateRange.
   * Returns 20 items per page sorted by createdAt descending.
   *
   * @param userId - JWT-extracted user ID
   * @param filters - Optional status, platform, dateFrom, dateTo, page
   * @returns Paginated result with data, total, page, pageSize
   */
  async findPaginated(
    userId: string,
    filters: PaginatedApplicationFilters
  ): Promise<PaginatedApplicationsResult> {
    const page = filters.page ?? 1;
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const query: Record<string, unknown> = { userId };
    if (filters.status) query['status'] = filters.status;
    if (filters.dateFrom ?? filters.dateTo) {
      const dateRange: Record<string, unknown> = {};
      if (filters.dateFrom) dateRange['$gte'] = new Date(filters.dateFrom);
      if (filters.dateTo) dateRange['$lte'] = new Date(filters.dateTo);
      query['createdAt'] = dateRange;
    }

    const [data, total] = await Promise.all([
      this.applicationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .exec(),
      this.applicationModel.countDocuments(query).exec(),
    ]);

    return { data, total, page, pageSize };
  }

  /**
   * HIST-02: Get full application detail with vacancy populate.
   *
   * @param userId - JWT-extracted user ID
   * @param applicationId - MongoDB ObjectId string
   * @returns Application document with associated vacancy data
   */
  async findById(
    userId: string,
    applicationId: string
  ): Promise<{ application: ApplicationDocument; vacancy: VacancyDocument | null }> {
    const application = await this.applicationModel
      .findOne({ _id: applicationId, userId })
      .exec();
    if (!application) throw new NotFoundException('Application not found');

    const vacancy = await this.vacancyModel.findById(application.vacancyId).exec();
    return { application, vacancy };
  }

  /**
   * HIST-03: Update application status manually.
   * Only accepts manual tracking states: tracking_active, interview_scheduled, offer_received, rejected.
   * Appends history entry with timestamp and optional note.
   *
   * @param userId - JWT-extracted user ID
   * @param applicationId - MongoDB ObjectId string
   * @param dto - New status and optional note
   * @returns Updated ApplicationDocument
   */
  async updateStatus(
    userId: string,
    applicationId: string,
    dto: UpdateApplicationStatusDto
  ): Promise<ApplicationDocument> {
    if (!VALID_MANUAL_STATES.includes(dto.status as (typeof VALID_MANUAL_STATES)[number])) {
      throw new BadRequestException(
        `Status must be one of: ${VALID_MANUAL_STATES.join(', ')}`
      );
    }

    const app = await this.applicationModel.findOne({ _id: applicationId, userId }).exec();
    if (!app) throw new NotFoundException('Application not found');

    const now = new Date().toISOString();
    app.status = dto.status;
    const historyEntry: { status: string; timestamp: string; note?: string } = {
      status: dto.status,
      timestamp: now,
    };
    if (dto.note !== undefined) historyEntry.note = dto.note;
    app.history.push(historyEntry);
    await app.save();

    return app;
  }

  /**
   * HIST-01: Export applications as CSV file content.
   * Joins vacancy data to include company, title, score, and platform.
   *
   * @param userId - JWT-extracted user ID
   * @param filters - Optional status and date range filters
   * @returns CSV string with header row and one row per application
   */
  async exportCsv(
    userId: string,
    filters: { status?: string; dateFrom?: string; dateTo?: string }
  ): Promise<string> {
    const query: Record<string, unknown> = { userId };
    if (filters.status) query['status'] = filters.status;
    if (filters.dateFrom ?? filters.dateTo) {
      const dateRange: Record<string, unknown> = {};
      if (filters.dateFrom) dateRange['$gte'] = new Date(filters.dateFrom);
      if (filters.dateTo) dateRange['$lte'] = new Date(filters.dateTo);
      query['createdAt'] = dateRange;
    }

    const apps = await this.applicationModel.find(query).sort({ createdAt: -1 }).exec();
    const vacancyIds = apps.map((a) => a.vacancyId);
    const vacancies = await this.vacancyModel.find({ _id: { $in: vacancyIds } }).exec();
    const vacancyMap = new Map(vacancies.map((v) => [v._id.toString(), v]));

    const header = 'Date,Company,Title,Status,Score,Recipient Email,Platform\n';
    const rows = apps.map((a) => {
      const v = vacancyMap.get(a.vacancyId);
      const aWithTimestamps = a as unknown as { createdAt: string | Date };
      const date = new Date(aWithTimestamps.createdAt).toISOString().split('T')[0];
      const company = v?.company?.replace(/,/g, ';') ?? '';
      const title = v?.title?.replace(/,/g, ';') ?? '';
      const score = v?.compatibilityScore ?? '';
      const platform = v?.platform ?? '';
      return `${date},${company},${title},${a.status},${score},${a.recipientEmail},${platform}`;
    });

    return header + rows.join('\n');
  }

  /**
   * Mark application as pending_review when user opens the draft review modal.
   * Only transitions from 'draft' — already past draft applications are returned as-is.
   *
   * @param userId - JWT-extracted user ID
   * @param applicationId - MongoDB ObjectId string
   * @returns Updated ApplicationDocument
   */
  async markPendingReview(
    userId: string,
    applicationId: string
  ): Promise<ApplicationDocument> {
    const app = await this.applicationModel.findOne({ _id: applicationId, userId }).exec();
    if (!app) throw new NotFoundException('Application not found');

    if (app.status !== 'draft') return app;

    const now = new Date().toISOString();
    app.status = 'pending_review';
    app.history.push({ status: 'pending_review', timestamp: now });
    await app.save();

    return app;
  }

  /**
   * Update email content before sending (user edits in review modal).
   * Only editable when in 'draft' or 'pending_review' status.
   *
   * @param userId - JWT-extracted user ID
   * @param applicationId - MongoDB ObjectId string
   * @param emailContent - Updated subject and body
   * @param recipientEmail - Optional updated recipient address
   * @returns Updated ApplicationDocument
   */
  async updateDraft(
    userId: string,
    applicationId: string,
    emailContent: { subject: string; body: string },
    recipientEmail?: string
  ): Promise<ApplicationDocument> {
    const app = await this.applicationModel.findOne({ _id: applicationId, userId }).exec();
    if (!app) throw new NotFoundException('Application not found');

    if (app.status !== 'draft' && app.status !== 'pending_review') {
      throw new BadRequestException(
        'Can only edit drafts or pending review applications'
      );
    }

    app.emailContent = emailContent;
    if (recipientEmail) app.recipientEmail = recipientEmail;
    await app.save();

    return app;
  }

  /**
   * Count applications in draft/pending_review status for the nav badge.
   *
   * @param userId - JWT-extracted user ID
   * @returns Count of applications awaiting review
   */
  async countPendingReview(userId: string): Promise<number> {
    return this.applicationModel
      .countDocuments({
        userId,
        status: { $in: ['draft', 'pending_review'] },
      })
      .exec();
  }
}
