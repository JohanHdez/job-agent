/**
 * ApplicationsController — REST endpoints for application lifecycle management.
 *
 * All endpoints are protected by JwtAuthGuard. userId is always extracted from
 * the JWT token (NF-08 — never from request body).
 *
 * Route order matters — specific routes declared before parameterized routes
 * to prevent NestJS shadowing:
 *   GET /applications/export/csv    (before /:id)
 *   GET /applications/pending-count (before /:id)
 *
 * The controller does NOT instantiate ClaudeEmailDraftAdapter directly.
 * The adapter is injected into ApplicationsService via EMAIL_DRAFT_ADAPTER_TOKEN.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { ApplicationsService } from './applications.service.js';
import { UsersService } from '../users/users.service.js';
import { CreateApplicationDto } from './dto/create-application.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { Request } from 'express';
import type { ProfessionalProfile, SmtpConfigType } from '@job-agent/core';

interface AuthenticatedRequest extends Request {
  user: UserDocument;
}

/**
 * Extracts userId string from the JWT-populated req.user.
 * Handles both ObjectId and plain string _id values.
 * NF-08: userId ALWAYS comes from the JWT, never from the request body.
 */
function getUserId(req: AuthenticatedRequest): string {
  const id = req.user._id;
  if (id !== null && typeof id === 'object' && 'toHexString' in (id as object)) {
    return (id as { toHexString(): string }).toHexString();
  }
  return String(id);
}

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * POST /applications — create a draft application with Claude-generated email.
   *
   * Fetches the user's professional profile from UsersService and passes it to
   * ApplicationsService.createDraft. The service internally calls the injected
   * EmailDraftAdapter (not the controller's responsibility).
   *
   * @returns 201 with the created ApplicationDocument in 'draft' status
   */
  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateApplicationDto,
  ) {
    const userId = getUserId(req);
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const profile = user.profile as ProfessionalProfile | null;
    if (!profile) throw new BadRequestException('User profile is required to create an application');

    return this.applicationsService.createDraft(userId, dto, profile);
  }

  /**
   * GET /applications/export/csv — download all filtered applications as CSV.
   * IMPORTANT: declared before GET /applications/:id to prevent route shadowing.
   *
   * @returns CSV file download with Content-Disposition header
   */
  @Get('export/csv')
  async exportCsv(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const userId = getUserId(req);
    const filters: { status?: string; dateFrom?: string; dateTo?: string } = {};
    if (status !== undefined) filters.status = status;
    if (dateFrom !== undefined) filters.dateFrom = dateFrom;
    if (dateTo !== undefined) filters.dateTo = dateTo;
    const csv = await this.applicationsService.exportCsv(userId, filters);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=applications.csv');
    res.send(csv);
  }

  /**
   * GET /applications/pending-count — returns badge count of drafts awaiting review.
   * IMPORTANT: declared before GET /applications/:id to prevent route shadowing.
   *
   * @returns { count: number }
   */
  @Get('pending-count')
  async pendingCount(@Req() req: AuthenticatedRequest) {
    const userId = getUserId(req);
    const count = await this.applicationsService.countPendingReview(userId);
    return { count };
  }

  /**
   * GET /applications — paginated list with optional filters.
   * HIST-01: supports status, platform, dateFrom, dateTo, page filters.
   *
   * @returns Paginated applications result
   */
  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('status') status?: string,
    @Query('company') company?: string,
    @Query('platform') platform?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const userId = getUserId(req);
    const paginationFilters: import('./applications.service.js').PaginatedApplicationFilters = {};
    if (page !== undefined) paginationFilters.page = parseInt(page, 10);
    if (status !== undefined) paginationFilters.status = status;
    if (company !== undefined) paginationFilters.company = company;
    if (platform !== undefined) paginationFilters.platform = platform;
    if (dateFrom !== undefined) paginationFilters.dateFrom = dateFrom;
    if (dateTo !== undefined) paginationFilters.dateTo = dateTo;
    return this.applicationsService.findPaginated(userId, paginationFilters);
  }

  /**
   * GET /applications/:id — full application detail with vacancy populate.
   * HIST-02: returns application + associated vacancy document.
   *
   * @returns { application, vacancy }
   */
  @Get(':id')
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = getUserId(req);
    return this.applicationsService.findById(userId, id);
  }

  /**
   * PATCH /applications/:id/status — manual status update (tracking, interview, offer, rejected).
   * HIST-03: appends status entry to history timeline.
   *
   * @returns Updated ApplicationDocument
   */
  @Patch(':id/status')
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    const userId = getUserId(req);
    return this.applicationsService.updateStatus(userId, id, dto);
  }

  /**
   * PATCH /applications/:id/draft — update email content before sending.
   * Used by the review modal for user edits to subject, body, or recipient.
   *
   * @returns Updated ApplicationDocument
   */
  @Patch(':id/draft')
  async updateDraft(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { emailContent: { subject: string; body: string }; recipientEmail?: string },
  ) {
    const userId = getUserId(req);
    return this.applicationsService.updateDraft(
      userId,
      id,
      body.emailContent,
      body.recipientEmail
    );
  }

  /**
   * POST /applications/:id/send — dispatch email via SMTP.
   * Fetches user's smtpConfig for SMTP credentials. Returns 400 if not configured.
   *
   * @returns Updated ApplicationDocument with 'sent' status
   */
  @Post(':id/send')
  async send(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = getUserId(req);
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const smtpConfig = user.smtpConfig as SmtpConfigType | undefined;
    if (!smtpConfig) {
      throw new BadRequestException(
        'SMTP configuration is required to send applications. Please configure it in settings.'
      );
    }

    return this.applicationsService.sendApplication(userId, id, smtpConfig);
  }

  /**
   * POST /applications/:id/review — mark application as pending_review.
   * Triggered when user opens the draft review modal.
   *
   * @returns Updated ApplicationDocument
   */
  @Post(':id/review')
  async markReview(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = getUserId(req);
    return this.applicationsService.markPendingReview(userId, id);
  }
}
