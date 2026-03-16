import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service.js';
import { User } from './schemas/user.schema.js';

/**
 * UsersService unit tests — Plan 02-03.
 * Covers AUTH-04 (profile update), SRCH-01 (preset creation), SRCH-02 (preset limit + activate).
 */
describe('UsersService', () => {
  let service: UsersService;

  const mockUserModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
  };

  beforeEach(async () => {
    // resetAllMocks clears both mock implementations (mockReturnValueOnce queues) and call history
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  // ── AUTH-04: updateProfile ────────────────────────────────────────────────────

  it('AUTH-04: updateProfile updates name/email/language and returns updated document', async () => {
    const userId = 'user-id-123';
    const dto = { name: 'Jane Doe', email: 'jane@example.com', language: 'es' as const };
    const updatedDoc = {
      _id: userId,
      name: 'Jane Doe',
      email: 'jane@example.com',
      language: 'es',
    };

    mockUserModel.findOneAndUpdate.mockResolvedValueOnce(updatedDoc);

    const result = await service.updateProfile(userId, dto);

    expect(result).toEqual(updatedDoc);
    expect(mockUserModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: userId },
      { $set: dto },
      { new: true, runValidators: true }
    );
  });

  // ── SRCH-01: createPreset ─────────────────────────────────────────────────────

  it('SRCH-01: createPreset stores all AppConfig fields and returns the preset', async () => {
    const userId = 'user-id-123';
    const dto = {
      name: 'Remote TypeScript',
      config: {
        keywords: ['TypeScript', 'NestJS'],
        location: 'Remote',
        modality: ['Remote'] as ('Remote' | 'Hybrid' | 'On-site')[],
        languages: ['English'],
        seniority: ['Mid', 'Senior'],
        datePosted: 'past_week' as const,
        excludedCompanies: [],
        platforms: ['linkedin'] as ('linkedin' | 'indeed' | 'computrabajo' | 'bumeran' | 'getonboard' | 'infojobs' | 'greenhouse')[],
        maxJobsToFind: 50,
        minScoreToApply: 70,
        maxApplicationsPerSession: 10,
      },
    };

    // First findById: fetch user to check preset count (0 presets)
    mockUserModel.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce({ presets: [] }),
    });
    // updateOne: push new preset
    mockUserModel.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    const result = await service.createPreset(userId, dto);

    expect(result).toBeDefined();
    expect(result.name).toBe(dto.name);
    expect(result.config.keywords).toEqual(dto.config.keywords);
    expect(result.config.minScoreToApply).toBe(70);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
    expect(mockUserModel.updateOne).toHaveBeenCalledWith(
      { _id: userId },
      { $push: { presets: expect.objectContaining({ name: dto.name, config: dto.config }) } }
    );
  });

  // ── SRCH-02: preset limit ─────────────────────────────────────────────────────

  it('SRCH-02: createPreset throws ConflictException when user already has 5 presets', async () => {
    const userId = 'user-id-123';
    const dto = {
      name: 'Sixth Preset',
      config: {
        keywords: ['Node'],
        location: 'Remote',
        modality: ['Remote'] as ('Remote' | 'Hybrid' | 'On-site')[],
        languages: ['English'],
        seniority: ['Senior'],
        datePosted: 'past_week' as const,
        excludedCompanies: [],
        platforms: ['linkedin'] as ('linkedin' | 'indeed' | 'computrabajo' | 'bumeran' | 'getonboard' | 'infojobs' | 'greenhouse')[],
        maxJobsToFind: 50,
        minScoreToApply: 70,
        maxApplicationsPerSession: 10,
      },
    };

    const existingUser = {
      presets: [
        { id: '1', name: 'P1', config: {}, createdAt: new Date() },
        { id: '2', name: 'P2', config: {}, createdAt: new Date() },
        { id: '3', name: 'P3', config: {}, createdAt: new Date() },
        { id: '4', name: 'P4', config: {}, createdAt: new Date() },
        { id: '5', name: 'P5', config: {}, createdAt: new Date() },
      ],
    };

    mockUserModel.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(existingUser),
    });

    await expect(service.createPreset(userId, dto)).rejects.toThrow(ConflictException);
  });

  // ── SRCH-02: setActivePreset ──────────────────────────────────────────────────

  it('SRCH-02: setActivePreset updates activePresetId on User document', async () => {
    const userId = 'user-id-123';
    const presetId = 'preset-uuid-001';

    const existingUser = {
      presets: [{ id: presetId, name: 'My Preset', config: {}, createdAt: new Date() }],
    };

    // findById: verify preset exists
    mockUserModel.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(existingUser),
    });

    const updatedDoc = { _id: userId, activePresetId: presetId };
    mockUserModel.findOneAndUpdate.mockResolvedValueOnce(updatedDoc);

    const result = await service.setActivePreset(userId, presetId);

    expect(result).toEqual(updatedDoc);
    expect(mockUserModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: userId },
      { $set: { activePresetId: presetId } },
      { new: true }
    );
  });

  it('SRCH-02: setActivePreset throws NotFoundException when presetId not found', async () => {
    const userId = 'user-id-123';
    const presetId = 'nonexistent-preset';

    const existingUser = {
      presets: [{ id: 'other-id', name: 'Other Preset', config: {}, createdAt: new Date() }],
    };

    mockUserModel.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(existingUser),
    });

    await expect(service.setActivePreset(userId, presetId)).rejects.toThrow(NotFoundException);
  });

  // ── getPresets ────────────────────────────────────────────────────────────────

  it('getPresets returns presets array from User document', async () => {
    const userId = 'user-id-123';
    const presets = [
      { id: 'p1', name: 'Preset 1', config: {}, createdAt: new Date() },
    ];

    mockUserModel.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce({ presets }),
    });

    const result = await service.getPresets(userId);

    expect(result).toEqual(presets);
    expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
  });

  it('getPresets throws NotFoundException when user not found', async () => {
    const userId = 'missing-user';

    mockUserModel.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(null),
    });

    await expect(service.getPresets(userId)).rejects.toThrow(NotFoundException);
  });

  // ── updatePreset ──────────────────────────────────────────────────────────────

  it('updatePreset updates a preset name and returns the updated preset', async () => {
    const userId = 'user-id-123';
    const presetId = 'preset-uuid-001';
    const dto = { name: 'Renamed Preset' };

    const updatedPreset = { id: presetId, name: 'Renamed Preset', config: {}, createdAt: new Date() };

    mockUserModel.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    mockUserModel.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce({ presets: [updatedPreset] }),
    });

    const result = await service.updatePreset(userId, presetId, dto);

    expect(result).toEqual(updatedPreset);
    expect(mockUserModel.updateOne).toHaveBeenCalledWith(
      { _id: userId },
      { $set: { 'presets.$[elem].name': 'Renamed Preset' } },
      { arrayFilters: [{ 'elem.id': presetId }] }
    );
  });

  it('updatePreset throws NotFoundException when presetId not found', async () => {
    const userId = 'user-id-123';
    const presetId = 'nonexistent';

    mockUserModel.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });

    await expect(service.updatePreset(userId, presetId, { name: 'X' })).rejects.toThrow(NotFoundException);
  });

  // ── deletePreset ──────────────────────────────────────────────────────────────

  it('deletePreset removes the preset from user document', async () => {
    const userId = 'user-id-123';
    const presetId = 'preset-uuid-001';

    mockUserModel.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await expect(service.deletePreset(userId, presetId)).resolves.toBeUndefined();
    expect(mockUserModel.updateOne).toHaveBeenCalledWith(
      { _id: userId },
      { $pull: { presets: { id: presetId } } }
    );
  });

  it('deletePreset throws NotFoundException when presetId not found', async () => {
    const userId = 'user-id-123';
    const presetId = 'nonexistent';

    mockUserModel.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });

    await expect(service.deletePreset(userId, presetId)).rejects.toThrow(NotFoundException);
  });

  // ── updateProfile NotFoundException branch ────────────────────────────────────

  it('updateProfile throws NotFoundException when user not found', async () => {
    const userId = 'missing-user';

    mockUserModel.findOneAndUpdate.mockResolvedValueOnce(null);

    await expect(service.updateProfile(userId, { name: 'X' })).rejects.toThrow(NotFoundException);
  });

  // ── createPreset NotFoundException branch ─────────────────────────────────────

  it('createPreset throws NotFoundException when user not found', async () => {
    const userId = 'missing-user';

    mockUserModel.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(null),
    });

    const dto = {
      name: 'Test',
      config: {
        keywords: [],
        location: 'Remote',
        modality: ['Remote'] as ('Remote' | 'Hybrid' | 'On-site')[],
        languages: [],
        seniority: [],
        datePosted: 'past_week' as const,
        excludedCompanies: [],
        platforms: [] as ('linkedin' | 'indeed' | 'computrabajo' | 'bumeran' | 'getonboard' | 'infojobs' | 'greenhouse')[],
        maxJobsToFind: 10,
        minScoreToApply: 70,
        maxApplicationsPerSession: 5,
      },
    };

    await expect(service.createPreset(userId, dto)).rejects.toThrow(NotFoundException);
  });
});
