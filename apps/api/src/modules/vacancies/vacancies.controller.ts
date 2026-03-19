import { Controller, Get, Patch, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { VacanciesService } from './vacancies.service.js';
import { UpdateVacancyStatusDto } from './dto/update-vacancy-status.dto.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { Request } from 'express';

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

/**
 * VacanciesController — REST interface for vacancy history and status management.
 *
 * Endpoints:
 * - GET   /vacancies/session/:sessionId — list vacancies for a session sorted by score
 * - PATCH /vacancies/:id/status         — update vacancy status (dismiss, applied, failed)
 */
@Controller('vacancies')
@UseGuards(JwtAuthGuard)
export class VacanciesController {
  constructor(private readonly vacanciesService: VacanciesService) {}

  /**
   * GET /vacancies — list all vacancies for the authenticated user across all sessions.
   *
   * Returns up to 100 most recent vacancies sorted by createdAt descending.
   * When ?includeApplication=true, each vacancy includes applicationStatus.
   *
   * IMPORTANT: This route MUST be declared before GET /vacancies/session/:sessionId
   * to avoid NestJS routing conflicts.
   *
   * @returns Array of vacancy documents sorted by createdAt descending
   */
  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('includeApplication') includeApplication?: string,
  ) {
    const userId = getUserId(req);
    const items = await this.vacanciesService.findAll(userId, {
      includeApplication: includeApplication === 'true',
    });
    return { data: items, total: items.length, page: 1, pageSize: items.length };
  }

  /**
   * GET /vacancies/session/:sessionId — list all vacancies for a session.
   *
   * Returns vacancies sorted by compatibilityScore descending.
   * Enforces userId ownership (NF-08) — only the owning user can list their vacancies.
   *
   * When ?includeApplication=true, each vacancy is augmented with applicationStatus
   * from the applications collection (used by DashboardPage vacancy cards).
   *
   * @returns Array of vacancy documents sorted by score descending
   */
  @Get('session/:sessionId')
  async findBySession(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
    @Query('includeApplication') includeApplication?: string,
  ) {
    const userId = getUserId(req);
    return this.vacanciesService.findBySession(
      sessionId,
      userId,
      { includeApplication: includeApplication === 'true' }
    );
  }

  /**
   * PATCH /vacancies/:id/status — update the status of a single vacancy.
   *
   * Common use case: marking as 'dismissed' (not interested).
   * Dismissed vacancies are excluded from future session scoring.
   *
   * @returns Updated vacancy document
   * @throws NotFoundException (404) when vacancy not found or not owned by user
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateVacancyStatusDto,
    @Req() req: AuthenticatedRequest
  ) {
    const userId = getUserId(req);
    return this.vacanciesService.updateStatus(id, userId, dto.status);
  }
}
