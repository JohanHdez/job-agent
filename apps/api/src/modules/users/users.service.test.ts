import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException, RequestTimeoutException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { User } from './schemas/user.schema.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@job-agent/cv-parser', () => ({
  runCvParser: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../common/crypto/token-cipher.js', () => ({
  encryptToken: jest.fn().mockReturnValue('encrypted-token'),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runCvParser } = require('@job-agent/cv-parser') as { runCvParser: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fsMock = require('fs/promises') as { writeFile: jest.Mock; unlink: jest.Mock };

const stubProfile = {
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  headline: 'Senior Developer',
  summary: 'Experienced dev',
  seniority: 'Senior' as const,
  yearsOfExperience: 7,
  skills: ['TypeScript', 'Node.js'],
  techStack: ['NestJS'],
  languages: [{ name: 'English', level: 'Native' as const }],
  experience: [
    {
      company: 'ACME',
      title: 'Lead Dev',
      startDate: '2020-01',
      endDate: 'Present',
      description: ['Built systems'],
      technologies: ['TypeScript'],
    },
  ],
  education: [],
};

const makeExec = (returnValue: unknown) =>
  jest.fn().mockResolvedValue(returnValue);

function buildModelMock(overrides: Record<string, jest.Mock> = {}): Record<string, jest.Mock> {
  const base = {
    findById: jest.fn().mockReturnValue({ exec: makeExec(null) }),
    findOne: jest.fn().mockReturnValue({ exec: makeExec(null) }),
    findOneAndUpdate: jest.fn().mockReturnValue({ exec: makeExec(null) }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  };
  return { ...base, ...overrides };
}

const userA = {
  _id: 'user-a-id',
  email: 'a@example.com',
  name: 'User A',
  photo: 'https://example.com/a.jpg',
  headline: 'Dev A',
  searchPresets: [],
  activePresetId: null,
  profile: null,
};

const userB = {
  _id: 'user-b-id',
  email: 'b@example.com',
  name: 'User B',
  searchPresets: [],
  profile: null,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;
  let modelMock: ReturnType<typeof buildModelMock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    modelMock = buildModelMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: modelMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the UserDocument for the given userId', async () => {
      modelMock.findById.mockReturnValue({ exec: makeExec(userA) });
      const result = await service.findById('user-a-id');
      expect(modelMock.findById).toHaveBeenCalledWith('user-a-id');
      expect(result).toEqual(userA);
    });

    it('returns null when user is not found', async () => {
      modelMock.findById.mockReturnValue({ exec: makeExec(null) });
      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── updateUser ─────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('updates name in MongoDB and returns updated user', async () => {
      const updated = { ...userA, name: 'New Name' };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updated) });

      const result = await service.updateUser('user-a-id', { name: 'New Name' });

      expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'user-a-id' },
        { $set: { name: 'New Name' } },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updated);
    });

    it('persists language preference', async () => {
      const updated = { ...userA, languagePreference: 'es' };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updated) });

      const result = await service.updateUser('user-a-id', { languagePreference: 'es' });
      expect(result).toHaveProperty('languagePreference', 'es');
    });

    it('throws NotFoundException when user not found', async () => {
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(null) });
      await expect(service.updateUser('bad-id', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── mergeProfile ───────────────────────────────────────────────────────────

  describe('mergeProfile', () => {
    it('fills empty profile fields from incoming data when profile is null', async () => {
      modelMock.findById.mockReturnValue({ exec: makeExec(userA) });
      const updatedUser = { ...userA, profile: stubProfile };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updatedUser) });

      const result = await service.mergeProfile('user-a-id', stubProfile);
      expect(result).toEqual(updatedUser);
    });

    it('preserves existing non-empty skills array and does not overwrite it', async () => {
      const userWithProfile = {
        ...userA,
        profile: { ...stubProfile, skills: ['Go', 'Rust'] },
      };
      modelMock.findById.mockReturnValue({ exec: makeExec(userWithProfile) });

      const capturedSet: Record<string, unknown> = {};
      modelMock.findOneAndUpdate.mockImplementation(
        (_filter: unknown, update: { $set: Record<string, unknown> }) => {
          Object.assign(capturedSet, update.$set);
          return { exec: makeExec({ ...userWithProfile }) };
        }
      );

      await service.mergeProfile('user-a-id', { ...stubProfile, skills: ['Python'] });

      // The existing ['Go', 'Rust'] should NOT be overwritten with ['Python']
      const mergedProfile = capturedSet['profile'] as { skills: string[] };
      expect(mergedProfile.skills).toEqual(['Go', 'Rust']);
    });

    it('preserves existing non-empty scalar profile fields', async () => {
      const userWithProfile = {
        ...userA,
        profile: { ...stubProfile, headline: 'Existing Headline' },
      };
      modelMock.findById.mockReturnValue({ exec: makeExec(userWithProfile) });

      const capturedSet: Record<string, unknown> = {};
      modelMock.findOneAndUpdate.mockImplementation(
        (_filter: unknown, update: { $set: Record<string, unknown> }) => {
          Object.assign(capturedSet, update.$set);
          return { exec: makeExec(userWithProfile) };
        }
      );

      await service.mergeProfile('user-a-id', { ...stubProfile, headline: 'New Headline' });

      const mergedProfile = capturedSet['profile'] as { headline: string };
      expect(mergedProfile.headline).toBe('Existing Headline');
    });
  });

  // ── updateProfile ──────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('overwrites all provided fields (unlike merge)', async () => {
      const updated = { ...userA, profile: { ...stubProfile, headline: 'New Headline' } };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updated) });

      const result = await service.updateProfile('user-a-id', { headline: 'New Headline' });

      expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'user-a-id' },
        { $set: { 'profile.headline': 'New Headline' } },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updated);
    });
  });

  // ── checkProfileCompleteness ───────────────────────────────────────────────

  describe('checkProfileCompleteness', () => {
    it('returns [] when skills, seniority, and experience are all present', () => {
      const user = { ...userA, profile: stubProfile } as unknown as Parameters<
        typeof service.checkProfileCompleteness
      >[0];
      expect(service.checkProfileCompleteness(user)).toEqual([]);
    });

    it("returns ['skills', 'seniority'] when both are empty", () => {
      const user = {
        ...userA,
        profile: { ...stubProfile, skills: [], seniority: undefined },
      } as unknown as Parameters<typeof service.checkProfileCompleteness>[0];
      expect(service.checkProfileCompleteness(user)).toEqual(['skills', 'seniority']);
    });

    it("returns ['experience'] when experience array is empty", () => {
      const user = {
        ...userA,
        profile: { ...stubProfile, experience: [] },
      } as unknown as Parameters<typeof service.checkProfileCompleteness>[0];
      expect(service.checkProfileCompleteness(user)).toEqual(['experience']);
    });

    it("returns all three fields when profile is null", () => {
      const user = { ...userA, profile: null } as unknown as Parameters<
        typeof service.checkProfileCompleteness
      >[0];
      expect(service.checkProfileCompleteness(user)).toEqual(['skills', 'seniority', 'experience']);
    });
  });

  // ── importCvProfile ────────────────────────────────────────────────────────

  describe('importCvProfile', () => {
    it('calls runCvParser with a temp file path and then mergeProfile with result', async () => {
      runCvParser.mockResolvedValue(stubProfile);
      modelMock.findById.mockReturnValue({ exec: makeExec(userA) });
      const updatedUser = { ...userA, profile: stubProfile };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updatedUser) });

      const buffer = Buffer.from('fake pdf content');
      await service.importCvProfile('user-a-id', buffer);

      expect(fsMock.writeFile).toHaveBeenCalled();
      expect(runCvParser).toHaveBeenCalled();
      const cvPath = (runCvParser.mock.calls[0] as string[])[0];
      expect(cvPath).toMatch(/\.pdf$/);
    });

    it(
      'throws RequestTimeoutException when runCvParser exceeds 7 seconds',
      async () => {
        jest.useFakeTimers();

        // runCvParser never resolves during this test — timeout fires first
        runCvParser.mockImplementation(
          () =>
            new Promise<never>(() => {
              /* never resolves */
            })
        );
        modelMock.findById.mockReturnValue({ exec: makeExec(userA) });

        const promise = service.importCvProfile('user-a-id', Buffer.from('pdf'));

        // Flush microtasks then advance timers past the 7-second threshold
        await Promise.resolve();
        jest.advanceTimersByTime(8000);

        await expect(promise).rejects.toThrow(RequestTimeoutException);

        jest.useRealTimers();
      },
      15000 // Extended timeout for this test
    );

    it('cleans up temp file in finally block', async () => {
      runCvParser.mockResolvedValue(stubProfile);
      modelMock.findById.mockReturnValue({ exec: makeExec(userA) });
      const updatedUser = { ...userA, profile: stubProfile };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updatedUser) });

      await service.importCvProfile('user-a-id', Buffer.from('pdf'));
      expect(fsMock.unlink).toHaveBeenCalled();
    });

    it('cleans up temp file even when runCvParser throws', async () => {
      runCvParser.mockRejectedValue(new Error('parse failed'));
      modelMock.findById.mockReturnValue({ exec: makeExec(userA) });

      await expect(service.importCvProfile('user-a-id', Buffer.from('pdf'))).rejects.toThrow();
      expect(fsMock.unlink).toHaveBeenCalled();
    });
  });

  // ── Preset CRUD ────────────────────────────────────────────────────────────

  const stubPresetDto = {
    name: 'Remote TypeScript',
    keywords: ['TypeScript', 'NestJS'],
    location: 'Remote',
    modality: ['Remote'] as ['Remote'],
    platforms: ['linkedin'],
    seniority: ['Senior'],
    languages: ['English'],
    datePosted: 'past_week' as const,
    minScoreToApply: 70,
    maxApplicationsPerSession: 10,
    excludedCompanies: [],
  };

  describe('getPresets', () => {
    it("returns the user's searchPresets array", async () => {
      const presets = [{ ...stubPresetDto, id: 'preset-1' }];
      modelMock.findById.mockReturnValue({ exec: makeExec({ ...userA, searchPresets: presets }) });
      const result = await service.getPresets('user-a-id');
      expect(result).toEqual(presets);
    });
  });

  describe('createPreset', () => {
    it('adds preset to searchPresets array with a generated UUID id', async () => {
      modelMock.findById.mockReturnValue({
        exec: makeExec({ ...userA, searchPresets: [] }),
      });
      modelMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.createPreset('user-a-id', stubPresetDto);
      expect(result).toMatchObject({ name: 'Remote TypeScript' });
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
    });

    it('throws BadRequestException when user already has 5 presets', async () => {
      const fivePresets = Array.from({ length: 5 }, (_, i) => ({
        ...stubPresetDto,
        id: `preset-${i}`,
      }));
      modelMock.findById.mockReturnValue({
        exec: makeExec({ ...userA, searchPresets: fivePresets }),
      });

      await expect(service.createPreset('user-a-id', stubPresetDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('updatePreset', () => {
    it('updates matching preset fields', async () => {
      const updatedUser = { ...userA, searchPresets: [{ ...stubPresetDto, id: 'p1', name: 'Updated' }] };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updatedUser) });

      const result = await service.updatePreset('user-a-id', 'p1', { name: 'Updated' });
      expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'user-a-id', 'searchPresets.id': 'p1' },
        expect.objectContaining({ $set: expect.objectContaining({ 'searchPresets.$.name': 'Updated' }) }),
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updatedUser);
    });

    it('throws NotFoundException when preset not found', async () => {
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(null) });
      await expect(service.updatePreset('user-a-id', 'bad-id', { name: 'x' })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('deletePreset', () => {
    it('removes preset from array', async () => {
      const updatedUser = { ...userA, searchPresets: [] };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updatedUser) });

      const result = await service.deletePreset('user-a-id', 'p1');
      expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'user-a-id' },
        { $pull: { searchPresets: { id: 'p1' } } },
        { new: true }
      );
      expect(result).toEqual(updatedUser);
    });
  });

  describe('setActivePreset', () => {
    it('sets activePresetId on the user document', async () => {
      const updatedUser = { ...userA, activePresetId: 'p1' };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updatedUser) });

      const result = await service.setActivePreset('user-a-id', 'p1');
      expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'user-a-id' },
        { $set: { activePresetId: 'p1' } },
        { new: true }
      );
      expect(result).toEqual(updatedUser);
    });
  });

  // ── PROF-01: upsertFromLinkedIn stores identity fields ─────────────────────

  describe('upsertFromLinkedIn (PROF-01)', () => {
    it('stores name, email, photo, and headline from LinkedIn OAuth identity', async () => {
      const linkedInDto = {
        linkedinId: 'li-123',
        email: 'linkedin@example.com',
        name: 'LinkedIn User',
        photo: 'https://li.com/photo.jpg',
        headline: 'Senior Engineer at ACME',
        accessToken: 'access-token-abc',
      };

      const updatedUser = {
        _id: 'user-a-id',
        linkedinId: linkedInDto.linkedinId,
        email: linkedInDto.email,
        name: linkedInDto.name,
        photo: linkedInDto.photo,
        headline: linkedInDto.headline,
      };
      // upsertFromLinkedIn does not call .exec() — it uses the direct promise return
      modelMock.findOneAndUpdate.mockResolvedValue(updatedUser);

      const result = await service.upsertFromLinkedIn(linkedInDto);

      // Verify the $set call includes all four identity fields
      const callArgs = modelMock.findOneAndUpdate.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
        unknown,
      ];
      const setFields = callArgs[1]['$set'];
      expect(setFields['name']).toBe(linkedInDto.name);
      expect(setFields['email']).toBe(linkedInDto.email);
      expect(setFields['photo']).toBe(linkedInDto.photo);
      expect(setFields['headline']).toBe(linkedInDto.headline);

      // Verify the returned document has all four fields
      expect(result.name).toBe(linkedInDto.name);
      expect(result.email).toBe(linkedInDto.email);
      expect(result.photo).toBe(linkedInDto.photo);
      expect(result.headline).toBe(linkedInDto.headline);
    });
  });

  // ── NF-08: Row-level security ──────────────────────────────────────────────

  describe('NF-08 row-level security', () => {
    it('updateUser uses { _id: userA_id } filter — userB document is never modified', async () => {
      const updatedA = { ...userA, name: 'New Name' };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updatedA) });

      await service.updateUser(userA._id, { name: 'New Name' });

      // Verify the exact filter used — must only touch userA
      const callFilter = (
        modelMock.findOneAndUpdate.mock.calls[0] as [Record<string, unknown>, unknown, unknown]
      )[0];
      expect(callFilter).toEqual({ _id: userA._id });
      expect(callFilter).not.toHaveProperty('_id', userB._id);
    });

    it('getPresets uses findById with userA_id — returns only userA presets', async () => {
      const aPresets = [{ ...stubPresetDto, id: 'a-preset' }];
      modelMock.findById.mockReturnValue({
        exec: makeExec({ ...userA, searchPresets: aPresets }),
      });

      const result = await service.getPresets(userA._id);

      expect(modelMock.findById).toHaveBeenCalledWith(userA._id);
      expect(result).toEqual(aPresets);

      // Confirm userB's id was NOT used
      const calledWith = (modelMock.findById.mock.calls[0] as string[])[0];
      expect(calledWith).not.toBe(userB._id);
    });

    it('all service methods that query MongoDB include _id filter from the parameter', async () => {
      // updateProfile — uses { _id: userId }
      const updated = { ...userA };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updated) });
      await service.updateProfile(userA._id, { headline: 'x' });
      const profileFilter = (
        modelMock.findOneAndUpdate.mock.calls[0] as [Record<string, unknown>, unknown, unknown]
      )[0];
      expect(profileFilter).toEqual({ _id: userA._id });

      modelMock.findOneAndUpdate.mockClear();

      // setActivePreset — uses { _id: userId }
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updated) });
      await service.setActivePreset(userA._id, 'preset-id');
      const activeFilter = (
        modelMock.findOneAndUpdate.mock.calls[0] as [Record<string, unknown>, unknown, unknown]
      )[0];
      expect(activeFilter).toEqual({ _id: userA._id });
    });
  });
});
