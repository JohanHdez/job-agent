import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { CreatePresetDto } from './dto/create-preset.dto.js';
import { UpdatePresetDto } from './dto/update-preset.dto.js';
import { UpdateSmtpConfigDto } from './dto/update-smtp-config.dto.js';
import type { AppConfig } from '@job-agent/core';
import type { UserDocument } from './schemas/user.schema.js';
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

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** PATCH /users/me — update user identity fields (AUTH-04) */
  @Patch('me')
  async updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateUserDto
  ) {
    return this.usersService.updateUser(getUserId(req), dto);
  }

  /** GET /users/profile — get profile with completeness info (PROF-03, PROF-04) */
  @Get('profile')
  async getProfile(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findById(getUserId(req));
    if (!user) throw new BadRequestException('User not found');
    const missingFields = this.usersService.checkProfileCompleteness(user);
    return {
      profile: user.profile ?? null,
      isComplete: missingFields.length === 0,
      missingFields,
    };
  }

  /** PATCH /users/profile — update profile fields directly (PROF-03 edit mode) */
  @Patch('profile')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto
  ) {
    return this.usersService.updateProfile(getUserId(req), dto);
  }

  /**
   * POST /users/profile/cv — upload PDF, parse with Claude API, merge into profile (PROF-02).
   * Uses memoryStorage so the file buffer is available in memory for processing.
   * Only application/pdf files are accepted.
   */
  @Post('profile/cv')
  @UseInterceptors(
    FileInterceptor('cv', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (
        _req: unknown,
        file: Express.Multer.File,
        cb: (err: Error | null, accept: boolean) => void
      ) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only PDF files are accepted'), false);
        }
      },
    })
  )
  async uploadCv(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }
    const userId = getUserId(req);
    const user = await this.usersService.importCvProfile(userId, file.buffer);
    const missingFields = this.usersService.checkProfileCompleteness(user);

    // Auto-populate search config from parsed profile (fire-and-forget — non-blocking)
    if (user.profile) {
      void this.usersService.seedSearchConfigFromProfile(userId, user.profile);
    }

    return {
      profile: user.profile,
      isComplete: missingFields.length === 0,
      missingFields,
    };
  }

  /** GET /users/config — load persisted AppConfig (pre-populated from CV) */
  @Get('config')
  async getConfig(@Req() req: AuthenticatedRequest) {
    const config = await this.usersService.getSearchConfig(getUserId(req));
    return { config };
  }

  /** POST /users/config — save AppConfig */
  @Post('config')
  async saveConfig(
    @Req() req: AuthenticatedRequest,
    @Body() body: AppConfig,
  ) {
    const saved = await this.usersService.saveSearchConfig(getUserId(req), body);
    return { config: saved };
  }

  /** PUT /users/smtp-config — save SMTP configuration (APPLY-02) */
  @Put('smtp-config')
  async saveSmtpConfig(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateSmtpConfigDto
  ) {
    return this.usersService.saveSmtpConfig(getUserId(req), dto);
  }

  /** GET /users/smtp-config — get SMTP config with masked password */
  @Get('smtp-config')
  async getSmtpConfig(@Req() req: AuthenticatedRequest) {
    return this.usersService.getSmtpConfig(getUserId(req));
  }

  /** GET /users/presets — list all search presets (SRCH-01) */
  @Get('presets')
  async getPresets(@Req() req: AuthenticatedRequest) {
    return this.usersService.getPresets(getUserId(req));
  }

  /** POST /users/presets — create a named preset (SRCH-01, max 5 per SRCH-02) */
  @Post('presets')
  async createPreset(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePresetDto
  ) {
    return this.usersService.createPreset(getUserId(req), dto);
  }

  /**
   * PATCH /users/presets/active — set the active preset (SRCH-02).
   * IMPORTANT: This route MUST be declared before PATCH /users/presets/:id
   * to prevent NestJS from matching "active" as an :id parameter.
   */
  @Patch('presets/active')
  async setActivePreset(
    @Req() req: AuthenticatedRequest,
    @Body() body: { presetId: string }
  ) {
    return this.usersService.setActivePreset(getUserId(req), body.presetId);
  }

  /** PATCH /users/presets/:id — update a specific preset (SRCH-01) */
  @Patch('presets/:id')
  async updatePreset(
    @Req() req: AuthenticatedRequest,
    @Param('id') presetId: string,
    @Body() dto: UpdatePresetDto
  ) {
    return this.usersService.updatePreset(getUserId(req), presetId, dto);
  }

  /** DELETE /users/presets/:id — delete a preset (SRCH-02) */
  @Delete('presets/:id')
  async deletePreset(
    @Req() req: AuthenticatedRequest,
    @Param('id') presetId: string
  ) {
    return this.usersService.deletePreset(getUserId(req), presetId);
  }
}
