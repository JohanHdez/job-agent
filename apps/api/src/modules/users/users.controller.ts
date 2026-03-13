import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Logger } from 'winston';
import { LOGGER } from '../logger/logger.constants.js';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CreatePresetDto } from './dto/create-preset.dto.js';
import { UpdatePresetDto } from './dto/update-preset.dto.js';
import type { UserDocument, StoredPreset } from './schemas/user.schema.js';

/** Typed request with JWT payload attached by the global JwtAuthGuard. */
type AuthenticatedRequest = Request & { user: { sub: string; email: string } };

/**
 * REST controller for user account management.
 *
 * All routes are protected by the global JwtAuthGuard (APP_GUARD).
 * No @Public() decorator is used here — every route requires a valid JWT.
 *
 * Route prefix: /users
 */
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  /**
   * Update the authenticated user's own profile.
   * PATCH /users/me
   * @param req - Authenticated request with JWT user payload
   * @param dto - Profile fields to update (name, email, language)
   * @returns Updated UserDocument
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateUserDto
  ): Promise<UserDocument> {
    const userId = req.user.sub;
    this.logger.info('users.updateProfile', { userId });
    return this.usersService.updateProfile(userId, dto);
  }

  /**
   * List all search presets for the authenticated user.
   * GET /users/me/presets
   * @param req - Authenticated request with JWT user payload
   * @returns Array of StoredPreset objects
   */
  @Get('me/presets')
  async getPresets(@Req() req: AuthenticatedRequest): Promise<StoredPreset[]> {
    const userId = req.user.sub;
    this.logger.info('users.getPresets', { userId });
    return this.usersService.getPresets(userId);
  }

  /**
   * Create a new named search preset.
   * POST /users/me/presets
   * @param req - Authenticated request with JWT user payload
   * @param dto - Preset name and full AppConfig search+matching configuration
   * @returns Newly created StoredPreset
   */
  @Post('me/presets')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createPreset(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePresetDto
  ): Promise<StoredPreset> {
    const userId = req.user.sub;
    this.logger.info('users.createPreset', { userId, name: dto.name });
    return this.usersService.createPreset(userId, dto);
  }

  /**
   * Update an existing search preset by id.
   * PATCH /users/me/presets/:id
   * @param req - Authenticated request with JWT user payload
   * @param id - Preset UUID
   * @param dto - Fields to update (name and/or config)
   * @returns Updated StoredPreset
   */
  @Patch('me/presets/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updatePreset(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePresetDto
  ): Promise<StoredPreset> {
    const userId = req.user.sub;
    this.logger.info('users.updatePreset', { userId, presetId: id });
    return this.usersService.updatePreset(userId, id, dto);
  }

  /**
   * Delete a search preset by id.
   * DELETE /users/me/presets/:id
   * @param req - Authenticated request with JWT user payload
   * @param id - Preset UUID
   */
  @Delete('me/presets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePreset(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<void> {
    const userId = req.user.sub;
    this.logger.info('users.deletePreset', { userId, presetId: id });
    return this.usersService.deletePreset(userId, id);
  }

  /**
   * Set the active preset by id.
   * PUT /users/me/presets/:id/activate
   * @param req - Authenticated request with JWT user payload
   * @param id - Preset UUID to activate
   * @returns Updated UserDocument with activePresetId set
   */
  @Put('me/presets/:id/activate')
  @HttpCode(HttpStatus.OK)
  async setActivePreset(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<UserDocument> {
    const userId = req.user.sub;
    this.logger.info('users.setActivePreset', { userId, presetId: id });
    return this.usersService.setActivePreset(userId, id);
  }
}
