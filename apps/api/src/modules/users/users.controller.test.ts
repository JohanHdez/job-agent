// Mock ESM packages before any imports to prevent import errors
jest.mock('@job-agent/cv-parser', () => ({
  runCvParser: jest.fn(),
}));

jest.mock('../../common/crypto/token-cipher.js', () => ({
  encryptToken: jest.fn().mockReturnValue('encrypted-token'),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUserA = {
  _id: { toHexString: () => 'user-a-id' },
  email: 'a@example.com',
  name: 'User A',
  photo: 'https://example.com/a.jpg',
  headline: 'Dev A',
  searchPresets: [],
  activePresetId: null,
  profile: null,
  languagePreference: 'en',
  contactEmail: undefined,
};

const stubProfile = {
  fullName: 'User A',
  email: 'a@example.com',
  headline: 'Dev A',
  summary: 'Summary',
  seniority: 'Senior',
  yearsOfExperience: 5,
  skills: ['TypeScript'],
  techStack: ['NestJS'],
  languages: [{ name: 'English', level: 'Native' }],
  experience: [
    {
      company: 'ACME',
      title: 'Lead Dev',
      startDate: '2020-01',
      endDate: 'Present',
      description: ['Built stuff'],
      technologies: ['TS'],
    },
  ],
  education: [],
};

const mockUsersService = {
  findById: jest.fn(),
  updateUser: jest.fn(),
  mergeProfile: jest.fn(),
  updateProfile: jest.fn(),
  checkProfileCompleteness: jest.fn(),
  importCvProfile: jest.fn(),
  getPresets: jest.fn(),
  createPreset: jest.fn(),
  updatePreset: jest.fn(),
  deletePreset: jest.fn(),
  setActivePreset: jest.fn(),
};

/** Build a mock AuthenticatedRequest with a given userId */
function mockReq(userId: string, bodyUserId?: string) {
  return {
    user: {
      ...mockUserA,
      _id: { toHexString: () => userId },
    },
    body: bodyUserId !== undefined ? { userId: bodyUserId } : {},
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let controller: UsersController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module: TestingModule = await Test.createTestingModule({
    controllers: [UsersController],
    providers: [
      { provide: UsersService, useValue: mockUsersService },
    ],
  })
    // Override JwtAuthGuard to always pass
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  controller = module.get<UsersController>(UsersController);
});

// ── PATCH /users/me ────────────────────────────────────────────────────────────

describe('PATCH /users/me', () => {
  it('updates user identity fields and returns updated user', async () => {
    const updated = { ...mockUserA, name: 'New Name' };
    mockUsersService.updateUser.mockResolvedValue(updated);

    const req = mockReq('user-a-id');
    const result = await controller.updateMe(req as never, { name: 'New Name' });

    expect(mockUsersService.updateUser).toHaveBeenCalledWith('user-a-id', { name: 'New Name' });
    expect(result).toEqual(updated);
  });

  it('uses userId from req.user (JWT), not from body (NF-08)', async () => {
    const updated = { ...mockUserA, name: 'New Name' };
    mockUsersService.updateUser.mockResolvedValue(updated);

    // req.user._id = 'user-a-id', body has userId: 'user-b-id' (should be ignored)
    const req = mockReq('user-a-id', 'user-b-id');
    await controller.updateMe(req as never, { name: 'New Name' });

    // Service must be called with JWT userId, not body userId
    expect(mockUsersService.updateUser).toHaveBeenCalledWith('user-a-id', expect.anything());
    expect(mockUsersService.updateUser).not.toHaveBeenCalledWith('user-b-id', expect.anything());
  });
});

// ── GET /users/profile ─────────────────────────────────────────────────────────

describe('GET /users/profile', () => {
  it('returns user profile with completeness check', async () => {
    const userWithProfile = { ...mockUserA, profile: stubProfile };
    mockUsersService.findById.mockResolvedValue(userWithProfile);
    mockUsersService.checkProfileCompleteness.mockReturnValue([]);

    const req = mockReq('user-a-id');
    const result = await controller.getProfile(req as never);

    expect(mockUsersService.findById).toHaveBeenCalledWith('user-a-id');
    expect(mockUsersService.checkProfileCompleteness).toHaveBeenCalledWith(userWithProfile);
    expect(result).toEqual({
      profile: stubProfile,
      isComplete: true,
      missingFields: [],
    });
  });

  it('returns isComplete: false and missing fields when profile is incomplete', async () => {
    const userWithNoSkills = { ...mockUserA, profile: { ...stubProfile, skills: [] } };
    mockUsersService.findById.mockResolvedValue(userWithNoSkills);
    mockUsersService.checkProfileCompleteness.mockReturnValue(['skills']);

    const req = mockReq('user-a-id');
    const result = await controller.getProfile(req as never);

    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toEqual(['skills']);
  });

  it('throws BadRequestException when user not found', async () => {
    mockUsersService.findById.mockResolvedValue(null);

    const req = mockReq('user-a-id');
    await expect(controller.getProfile(req as never)).rejects.toThrow(BadRequestException);
  });
});

// ── PATCH /users/profile ───────────────────────────────────────────────────────

describe('PATCH /users/profile', () => {
  it('updates profile fields and returns updated user', async () => {
    const updated = { ...mockUserA, profile: { ...stubProfile, headline: 'New Headline' } };
    mockUsersService.updateProfile.mockResolvedValue(updated);

    const req = mockReq('user-a-id');
    const result = await controller.updateProfile(req as never, { headline: 'New Headline' });

    expect(mockUsersService.updateProfile).toHaveBeenCalledWith('user-a-id', { headline: 'New Headline' });
    expect(result).toEqual(updated);
  });
});

// ── POST /users/profile/cv ─────────────────────────────────────────────────────

describe('POST /users/profile/cv', () => {
  it('accepts PDF upload, returns parsed profile', async () => {
    const userWithProfile = { ...mockUserA, profile: stubProfile };
    mockUsersService.importCvProfile.mockResolvedValue(userWithProfile);
    mockUsersService.checkProfileCompleteness.mockReturnValue([]);

    const req = mockReq('user-a-id');
    const file = {
      buffer: Buffer.from('pdf content'),
      mimetype: 'application/pdf',
      originalname: 'cv.pdf',
      size: 1024,
    } as Express.Multer.File;

    const result = await controller.uploadCv(req as never, file);

    expect(mockUsersService.importCvProfile).toHaveBeenCalledWith('user-a-id', file.buffer);
    expect(result).toEqual({
      profile: stubProfile,
      isComplete: true,
      missingFields: [],
    });
  });

  it('returns profile completeness info after CV upload', async () => {
    const userWithProfile = { ...mockUserA, profile: { ...stubProfile, skills: [] } };
    mockUsersService.importCvProfile.mockResolvedValue(userWithProfile);
    mockUsersService.checkProfileCompleteness.mockReturnValue(['skills']);

    const req = mockReq('user-a-id');
    const file = { buffer: Buffer.from('pdf'), mimetype: 'application/pdf' } as Express.Multer.File;

    const result = await controller.uploadCv(req as never, file);
    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toEqual(['skills']);
  });
});

// ── GET /users/presets ─────────────────────────────────────────────────────────

describe('GET /users/presets', () => {
  it("returns user's preset array", async () => {
    const presets = [{ id: 'p1', name: 'Test Preset' }];
    mockUsersService.getPresets.mockResolvedValue(presets);

    const req = mockReq('user-a-id');
    const result = await controller.getPresets(req as never);

    expect(mockUsersService.getPresets).toHaveBeenCalledWith('user-a-id');
    expect(result).toEqual(presets);
  });
});

// ── POST /users/presets ────────────────────────────────────────────────────────

describe('POST /users/presets', () => {
  const presetDto = {
    name: 'Remote TS',
    keywords: ['TypeScript'],
    location: 'Remote',
    modality: ['Remote'] as ['Remote'],
    platforms: ['linkedin'],
    seniority: ['Senior'],
    languages: ['English'],
    datePosted: 'past_week' as const,
    minScoreToApply: 70,
    maxApplicationsPerSession: 10,
  };

  it('creates preset and returns preset with id', async () => {
    const createdPreset = { ...presetDto, id: 'preset-uuid-123', excludedCompanies: [] };
    mockUsersService.createPreset.mockResolvedValue(createdPreset);

    const req = mockReq('user-a-id');
    const result = await controller.createPreset(req as never, presetDto);

    expect(mockUsersService.createPreset).toHaveBeenCalledWith('user-a-id', presetDto);
    expect(result).toEqual(createdPreset);
    expect(result.id).toBeDefined();
  });

  it('returns 400 when 5 presets already exist (service throws)', async () => {
    mockUsersService.createPreset.mockRejectedValue(
      new BadRequestException('Maximum 5 presets reached. Delete one first.')
    );

    const req = mockReq('user-a-id');
    await expect(controller.createPreset(req as never, presetDto)).rejects.toThrow(
      BadRequestException
    );
  });
});

// ── PATCH /users/presets/:id ───────────────────────────────────────────────────

describe('PATCH /users/presets/:id', () => {
  it('updates preset and returns updated user', async () => {
    const updated = { ...mockUserA };
    mockUsersService.updatePreset.mockResolvedValue(updated);

    const req = mockReq('user-a-id');
    const result = await controller.updatePreset(req as never, 'p1', { name: 'Updated' });

    expect(mockUsersService.updatePreset).toHaveBeenCalledWith('user-a-id', 'p1', { name: 'Updated' });
    expect(result).toEqual(updated);
  });

  it('throws NotFoundException when preset not found (service throws)', async () => {
    mockUsersService.updatePreset.mockRejectedValue(new NotFoundException('Preset not found'));

    const req = mockReq('user-a-id');
    await expect(controller.updatePreset(req as never, 'bad-id', { name: 'x' })).rejects.toThrow(
      NotFoundException
    );
  });
});

// ── DELETE /users/presets/:id ──────────────────────────────────────────────────

describe('DELETE /users/presets/:id', () => {
  it('removes preset and returns updated user', async () => {
    const updated = { ...mockUserA, searchPresets: [] };
    mockUsersService.deletePreset.mockResolvedValue(updated);

    const req = mockReq('user-a-id');
    const result = await controller.deletePreset(req as never, 'p1');

    expect(mockUsersService.deletePreset).toHaveBeenCalledWith('user-a-id', 'p1');
    expect(result).toEqual(updated);
  });
});

// ── PATCH /users/presets/active ────────────────────────────────────────────────

describe('PATCH /users/presets/active', () => {
  it('sets activePresetId and returns updated user', async () => {
    const updated = { ...mockUserA, activePresetId: 'p1' };
    mockUsersService.setActivePreset.mockResolvedValue(updated);

    const req = mockReq('user-a-id');
    const result = await controller.setActivePreset(req as never, { presetId: 'p1' });

    expect(mockUsersService.setActivePreset).toHaveBeenCalledWith('user-a-id', 'p1');
    expect(result).toEqual(updated);
  });
});

// ── NF-08: controller uses JWT userId for every endpoint ──────────────────────

describe('NF-08: controller extracts userId from JWT, never from body', () => {
  it('updateMe calls service with JWT userId even when body contains different userId', async () => {
    mockUsersService.updateUser.mockResolvedValue(mockUserA);

    // JWT userId = 'user-a-id', body has userId: 'user-b-id' (injection attempt)
    const req = {
      user: { _id: { toHexString: () => 'user-a-id' } },
      body: { userId: 'user-b-id', name: 'Injected' },
    };

    await controller.updateMe(req as never, { name: 'Injected' });

    expect(mockUsersService.updateUser).toHaveBeenCalledWith('user-a-id', expect.anything());
    expect(mockUsersService.updateUser).not.toHaveBeenCalledWith('user-b-id', expect.anything());
  });

  it('getPresets calls service with JWT userId even when query/params suggest different userId', async () => {
    mockUsersService.getPresets.mockResolvedValue([]);

    const req = { user: { _id: { toHexString: () => 'user-a-id' } } };
    await controller.getPresets(req as never);

    expect(mockUsersService.getPresets).toHaveBeenCalledWith('user-a-id');
  });

  it('createPreset calls service with JWT userId', async () => {
    const preset = { id: 'p1', name: 'x' };
    mockUsersService.createPreset.mockResolvedValue(preset);

    const req = { user: { _id: 'user-a-id' } }; // plain string _id
    const dto = {
      name: 'x',
      keywords: [],
      location: 'Remote',
      modality: ['Remote'] as ['Remote'],
      platforms: [],
      seniority: [],
      languages: [],
      datePosted: 'past_week' as const,
      minScoreToApply: 70,
      maxApplicationsPerSession: 10,
    };

    await controller.createPreset(req as never, dto);
    expect(mockUsersService.createPreset).toHaveBeenCalledWith('user-a-id', expect.anything());
  });
});
