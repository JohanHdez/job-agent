/**
 * ProfilesService unit tests — Phase 2, Plan 04.
 * Covers PROF-01 through PROF-04, NF-03, NF-08.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { ProfilesService } from './profiles.service.js';
import { UserProfile } from './schemas/user-profile.schema.js';
import type { UserProfileDocument } from './schemas/user-profile.schema.js';
import { LOGGER } from '../logger/logger.constants.js';

// ── Module-level mocks ────────────────────────────────────────────────────────

jest.mock('@job-agent/cv-parser', () => ({
  runCvParser: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../common/crypto/token-cipher.js', () => ({
  decryptToken: jest.fn().mockReturnValue('fake-access-token'),
  encryptToken: jest.fn().mockReturnValue('iv:tag:cipher'),
}));

// ── Typed references to mocked modules ───────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runCvParser } = require('@job-agent/cv-parser') as {
  runCvParser: jest.Mock;
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_USER_ID = 'user-123';
const MOCK_ENCRYPTED_TOKEN = 'aabbcc:ddeeff:001122';

const MOCK_FULL_PROFILE = {
  userId: MOCK_USER_ID,
  fullName: 'Jane Doe',
  email: 'j@example.com',
  headline: 'Software Engineer',
  summary: 'Experienced engineer',
  seniority: 'Senior' as const,
  yearsOfExperience: 8,
  skills: ['TypeScript', 'Node.js'],
  techStack: ['NestJS'],
  languages: [{ name: 'English', level: 'Native' as const }],
  experience: [
    {
      company: 'ACME',
      title: 'Engineer',
      startDate: '2020-01-01',
      endDate: 'Present',
      description: [],
      technologies: [],
    },
  ],
  education: [],
};

// ── Mock factories ────────────────────────────────────────────────────────────

function buildModelMock(defaultReturn: unknown = MOCK_FULL_PROFILE) {
  return {
    findOneAndUpdate: jest.fn().mockResolvedValue(defaultReturn),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(defaultReturn),
    }),
  };
}

function buildLoggerMock() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ProfilesService', () => {
  let service: ProfilesService;
  let profileModelMock: ReturnType<typeof buildModelMock>;

  beforeEach(async () => {
    profileModelMock = buildModelMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: getModelToken(UserProfile.name),
          useValue: profileModelMock,
        },
        {
          provide: LOGGER,
          useValue: buildLoggerMock(),
        },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── PROF-01: LinkedIn import — partial success ────────────────────────────

  it('PROF-01: importFromLinkedin returns partial summary with name+email when OIDC userinfo succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Jane', email: 'j@example.com' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ localizedHeadline: 'Engineer' }),
      } as unknown as Response);

    const result = await service.importFromLinkedin(
      MOCK_USER_ID,
      MOCK_ENCRYPTED_TOKEN
    );

    expect(result.imported).toContain('name');
    expect(result.imported).toContain('email');
    expect(result.imported).toContain('headline');
    expect(result.missing).toHaveLength(0);
    expect(result.profile).toBeDefined();
  });

  // ── PROF-01: LinkedIn import — 403 fallback ───────────────────────────────

  it('PROF-01: importFromLinkedin returns partial summary with missing list when LinkedIn API returns 403', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Jane', email: 'j@example.com' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({}),
      } as unknown as Response);

    const result = await service.importFromLinkedin(
      MOCK_USER_ID,
      MOCK_ENCRYPTED_TOKEN
    );

    expect(result.missing).toContain('headline');
    expect(result.imported).toContain('name');
    expect(result.imported).toContain('email');
    expect(result.profile).toBeDefined();
  });

  // ── PROF-02: uploadCv ─────────────────────────────────────────────────────

  it('PROF-02: uploadCv calls runCvParser with buffer and upserts the profile', async () => {
    runCvParser.mockResolvedValue(MOCK_FULL_PROFILE);

    const fakeBuffer = Buffer.from('fake-pdf-content');
    const profile = await service.uploadCv(MOCK_USER_ID, fakeBuffer);

    expect(runCvParser).toHaveBeenCalledTimes(1);

    // findOneAndUpdate must use { userId } as first argument
    expect(profileModelMock.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: MOCK_USER_ID },
      expect.anything(),
      expect.anything()
    );

    expect(profile).toBeDefined();
  });

  // ── PROF-03: patchProfile ─────────────────────────────────────────────────

  it('PROF-03: patchProfile applies partial update and always includes userId in the filter', async () => {
    const dto = { fullName: 'Jane Updated', skills: ['TypeScript'] };
    const updatedDoc = { ...MOCK_FULL_PROFILE, ...dto };
    profileModelMock.findOneAndUpdate.mockResolvedValueOnce(updatedDoc);

    await service.patchProfile(MOCK_USER_ID, dto);

    const calls = profileModelMock.findOneAndUpdate.mock.calls;
    expect(calls).toHaveLength(1);

    const [firstArg, secondArg] = calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];

    // { userId } must be first filter argument
    expect(firstArg).toEqual({ userId: MOCK_USER_ID });
    // $set must contain the dto fields
    expect(secondArg).toEqual({ $set: dto });
  });

  it('PROF-03: patchProfile throws NotFoundException when profile does not exist', async () => {
    profileModelMock.findOneAndUpdate.mockResolvedValueOnce(null);

    await expect(
      service.patchProfile(MOCK_USER_ID, { fullName: 'Ghost' })
    ).rejects.toThrow(NotFoundException);
  });

  // ── PROF-04: checkCompleteness ────────────────────────────────────────────

  it('PROF-04: checkCompleteness returns missing field names when skills and experience are empty', () => {
    const incompleteProfile = {
      ...MOCK_FULL_PROFILE,
      skills: [],
      experience: [],
      yearsOfExperience: 0,
    } as unknown as UserProfileDocument;

    const result = service.checkCompleteness(incompleteProfile);

    expect(result).toContain('skills');
    expect(result).toContain('work experience');
  });

  it('PROF-04: checkCompleteness returns [] when all critical fields are present', () => {
    const completeProfile = MOCK_FULL_PROFILE as unknown as UserProfileDocument;

    const result = service.checkCompleteness(completeProfile);

    expect(result).toEqual([]);
  });

  // ── NF-03: timing ─────────────────────────────────────────────────────────

  it('NF-03: importFromLinkedin resolves in under 8000ms with mocked HTTP', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Jane', email: 'j@example.com' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ localizedHeadline: 'Engineer' }),
      } as unknown as Response);

    const start = Date.now();
    await service.importFromLinkedin(MOCK_USER_ID, MOCK_ENCRYPTED_TOKEN);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(8000);
  });

  // ── NF-08: userId filter in all DB methods ────────────────────────────────

  it('NF-08: every query method includes userId filter — no cross-user data access', async () => {
    // Test getProfile — uses findOne
    await service.getProfile(MOCK_USER_ID);
    const [getArg] = profileModelMock.findOne.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(getArg).toEqual({ userId: MOCK_USER_ID });

    // Test patchProfile — uses findOneAndUpdate
    profileModelMock.findOneAndUpdate.mockResolvedValueOnce(MOCK_FULL_PROFILE);
    await service.patchProfile(MOCK_USER_ID, { fullName: 'Test' });
    const [patchArg] = profileModelMock.findOneAndUpdate.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(patchArg).toEqual({ userId: MOCK_USER_ID });
  });
});
