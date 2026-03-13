import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import type { Logger } from 'winston';
import { LOGGER } from '../logger/logger.constants.js';
import { UsersService } from '../users/users.service.js';
import { ProfilesService, LinkedInImportResult } from './profiles.service.js';
import { PatchProfileDto } from './dto/patch-profile.dto.js';
import type { UserProfileDocument } from './schemas/user-profile.schema.js';

/** Shape of the authenticated request after JwtAuthGuard sets req.user */
type AuthenticatedRequest = Request & { user: { sub: string } };

/**
 * REST controller for professional profile operations.
 *
 * All routes are protected globally by JwtAuthGuard (APP_GUARD).
 * The userId is always extracted from the verified JWT payload (req.user.sub).
 */
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    @Inject(LOGGER) private readonly logger: Logger,
    private readonly usersService: UsersService
  ) {}

  /**
   * Returns the authenticated user's profile document.
   * Throws 404 if no profile has been created yet.
   */
  @Get('me')
  async getMyProfile(
    @Req() req: AuthenticatedRequest
  ): Promise<UserProfileDocument> {
    const userId = req.user.sub;
    const profile = await this.profilesService.getProfile(userId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    this.logger.info('Profile retrieved', { userId });
    return profile;
  }

  /**
   * Partially updates the authenticated user's profile.
   * Only the provided fields are updated. Returns the updated document.
   */
  @Patch('me')
  @HttpCode(200)
  @UsePipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
  )
  async patchMyProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PatchProfileDto
  ): Promise<UserProfileDocument> {
    const userId = req.user.sub;
    this.logger.info('Patching profile', { userId });
    return this.profilesService.patchProfile(userId, dto);
  }

  /**
   * Uploads a CV PDF and upserts the parsed profile.
   * Accepts multipart/form-data with field name "file". PDF only, max 10 MB.
   * Returns HTTP 201 + the updated profile document.
   */
  @Post('me/cv')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void
      ) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only PDF files accepted'), false);
        }
      },
    })
  )
  async uploadCv(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined
  ): Promise<UserProfileDocument> {
    const userId = req.user.sub;

    if (!file) {
      throw new BadRequestException('No file uploaded or file type not accepted');
    }

    this.logger.info('CV upload received', { userId, size: file.size });
    return this.profilesService.uploadCv(userId, file.buffer);
  }

  /**
   * Imports professional data from LinkedIn using the stored OAuth access token.
   * Returns { profile, imported: string[], missing: string[] }.
   * Missing fields (e.g. headline when v2/me returns 403) are reported — never thrown.
   */
  @Post('me/import-linkedin')
  @HttpCode(200)
  async importFromLinkedin(
    @Req() req: AuthenticatedRequest
  ): Promise<LinkedInImportResult> {
    const userId = req.user.sub;

    const user = await this.usersService.findById(userId);

    if (!user?.linkedinAccessToken) {
      throw new BadRequestException('No LinkedIn account linked');
    }

    this.logger.info('LinkedIn import requested', { userId });
    return this.profilesService.importFromLinkedin(userId, user.linkedinAccessToken);
  }
}
