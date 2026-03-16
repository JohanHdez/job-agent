import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { LOGGER } from '../logger/logger.constants.js';
import type { StoredPreset, UserDocument } from './schemas/user.schema.js';

/**
 * UsersController unit tests — Plan 02-03.
 * Covers all 6 REST routes: PATCH /me, GET/POST/PATCH/DELETE /me/presets,
 * PUT /me/presets/:id/activate.
 */
describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    updateProfile: jest.fn(),
    getPresets: jest.fn(),
    createPreset: jest.fn(),
    updatePreset: jest.fn(),
    deletePreset: jest.fn(),
    setActivePreset: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockReq = { user: { sub: 'user-id-123', email: 'user@example.com' } };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: LOGGER, useValue: mockLogger },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  // ── PATCH /users/me ──────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('calls usersService.updateProfile with userId and dto, returns result', async () => {
      const dto = { name: 'Updated Name', language: 'es' as const };
      const updatedDoc = { _id: 'user-id-123', name: 'Updated Name', language: 'es' } as unknown as UserDocument;

      mockUsersService.updateProfile.mockResolvedValueOnce(updatedDoc);

      const req = mockReq as unknown as Parameters<typeof controller.updateProfile>[0];
      const result = await controller.updateProfile(req, dto);

      expect(result).toEqual(updatedDoc);
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith('user-id-123', dto);
      expect(mockLogger.info).toHaveBeenCalledWith('users.updateProfile', { userId: 'user-id-123' });
    });
  });

  // ── GET /users/me/presets ────────────────────────────────────────────────────

  describe('getPresets', () => {
    it('returns array of presets for the authenticated user', async () => {
      const presets: StoredPreset[] = [
        {
          id: 'preset-1',
          name: 'Remote TS',
          config: {
            keywords: ['TypeScript'],
            location: 'Remote',
            modality: ['Remote'],
            languages: ['English'],
            seniority: ['Senior'],
            datePosted: 'past_week',
            excludedCompanies: [],
            platforms: ['linkedin'],
            maxJobsToFind: 50,
            minScoreToApply: 70,
            maxApplicationsPerSession: 10,
          },
          createdAt: new Date(),
        },
      ];

      mockUsersService.getPresets.mockResolvedValueOnce(presets);

      const req = mockReq as unknown as Parameters<typeof controller.getPresets>[0];
      const result = await controller.getPresets(req);

      expect(result).toEqual(presets);
      expect(mockUsersService.getPresets).toHaveBeenCalledWith('user-id-123');
    });
  });

  // ── POST /users/me/presets ───────────────────────────────────────────────────

  describe('createPreset', () => {
    it('calls usersService.createPreset and returns 201 with new preset', async () => {
      const dto = {
        name: 'New Preset',
        config: {
          keywords: ['Node'],
          location: 'Remote',
          modality: ['Remote'] as ('Remote' | 'Hybrid' | 'On-site')[],
          languages: ['English'],
          seniority: ['Mid'],
          datePosted: 'past_week' as const,
          excludedCompanies: [],
          platforms: ['linkedin'] as ('linkedin' | 'indeed' | 'computrabajo' | 'bumeran' | 'getonboard' | 'infojobs' | 'greenhouse')[],
          maxJobsToFind: 25,
          minScoreToApply: 65,
          maxApplicationsPerSession: 5,
        },
      };

      const createdPreset: StoredPreset = {
        id: 'new-preset-uuid',
        name: dto.name,
        config: dto.config,
        createdAt: new Date(),
      };

      mockUsersService.createPreset.mockResolvedValueOnce(createdPreset);

      const req = mockReq as unknown as Parameters<typeof controller.createPreset>[0];
      const result = await controller.createPreset(req, dto);

      expect(result).toEqual(createdPreset);
      expect(mockUsersService.createPreset).toHaveBeenCalledWith('user-id-123', dto);
    });

    it('propagates ConflictException when user has 5 presets', async () => {
      mockUsersService.createPreset.mockRejectedValueOnce(
        new ConflictException('Cannot create more than 5 search presets')
      );

      const req = mockReq as unknown as Parameters<typeof controller.createPreset>[0];
      await expect(
        controller.createPreset(req, { name: 'Sixth', config: {} as Parameters<typeof controller.createPreset>[1]['config'] })
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── PATCH /users/me/presets/:id ──────────────────────────────────────────────

  describe('updatePreset', () => {
    it('calls usersService.updatePreset with userId, presetId, and dto', async () => {
      const presetId = 'preset-uuid-001';
      const dto = { name: 'Renamed Preset' };
      const updatedPreset: StoredPreset = {
        id: presetId,
        name: 'Renamed Preset',
        config: {
          keywords: [],
          location: 'Remote',
          modality: ['Remote'],
          languages: ['English'],
          seniority: ['Mid'],
          datePosted: 'past_week',
          excludedCompanies: [],
          platforms: ['linkedin'],
          maxJobsToFind: 25,
          minScoreToApply: 65,
          maxApplicationsPerSession: 5,
        },
        createdAt: new Date(),
      };

      mockUsersService.updatePreset.mockResolvedValueOnce(updatedPreset);

      const req = mockReq as unknown as Parameters<typeof controller.updatePreset>[0];
      const result = await controller.updatePreset(req, presetId, dto);

      expect(result).toEqual(updatedPreset);
      expect(mockUsersService.updatePreset).toHaveBeenCalledWith('user-id-123', presetId, dto);
    });

    it('propagates NotFoundException when presetId does not exist', async () => {
      mockUsersService.updatePreset.mockRejectedValueOnce(
        new NotFoundException('Preset nonexistent not found')
      );

      const req = mockReq as unknown as Parameters<typeof controller.updatePreset>[0];
      await expect(controller.updatePreset(req, 'nonexistent', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ── DELETE /users/me/presets/:id ─────────────────────────────────────────────

  describe('deletePreset', () => {
    it('calls usersService.deletePreset with userId and presetId', async () => {
      mockUsersService.deletePreset.mockResolvedValueOnce(undefined);

      const req = mockReq as unknown as Parameters<typeof controller.deletePreset>[0];
      await controller.deletePreset(req, 'preset-uuid-001');

      expect(mockUsersService.deletePreset).toHaveBeenCalledWith('user-id-123', 'preset-uuid-001');
    });

    it('propagates NotFoundException when presetId does not exist', async () => {
      mockUsersService.deletePreset.mockRejectedValueOnce(
        new NotFoundException('Preset nonexistent not found')
      );

      const req = mockReq as unknown as Parameters<typeof controller.deletePreset>[0];
      await expect(controller.deletePreset(req, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── PUT /users/me/presets/:id/activate ───────────────────────────────────────

  describe('setActivePreset', () => {
    it('calls usersService.setActivePreset with userId and presetId, returns updated doc', async () => {
      const presetId = 'preset-uuid-001';
      const updatedDoc = { _id: 'user-id-123', activePresetId: presetId } as unknown as UserDocument;

      mockUsersService.setActivePreset.mockResolvedValueOnce(updatedDoc);

      const req = mockReq as unknown as Parameters<typeof controller.setActivePreset>[0];
      const result = await controller.setActivePreset(req, presetId);

      expect(result).toEqual(updatedDoc);
      expect(mockUsersService.setActivePreset).toHaveBeenCalledWith('user-id-123', presetId);
    });

    it('propagates NotFoundException when presetId does not exist', async () => {
      mockUsersService.setActivePreset.mockRejectedValueOnce(
        new NotFoundException('Preset nonexistent not found')
      );

      const req = mockReq as unknown as Parameters<typeof controller.setActivePreset>[0];
      await expect(controller.setActivePreset(req, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
