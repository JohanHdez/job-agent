jest.mock('@job-agent/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { VacanciesService } from './vacancies.service.js';
import { Vacancy } from './schemas/vacancy.schema.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

const makeExec = (returnValue: unknown) => jest.fn().mockResolvedValue(returnValue);

/** Build a mock Mongoose vacancy with chained query methods */
function buildVacancyModelMock(overrides: Record<string, jest.Mock> = {}): Record<string, jest.Mock> {
  const base = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    insertMany: jest.fn(),
  };
  return { ...base, ...overrides };
}

const stubVacancy = {
  _id: { toHexString: () => 'vacancy-id-1' },
  jobId: 'job-1',
  title: 'TypeScript Developer',
  company: 'Acme Corp',
  url: 'https://example.com/job/1',
  userId: 'user-a-id',
  sessionId: 'session-id-1',
  compatibilityScore: 85,
  status: 'new' as const,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

describe('VacanciesService', () => {
  let service: VacanciesService;
  let modelMock: ReturnType<typeof buildVacancyModelMock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    modelMock = buildVacancyModelMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VacanciesService,
        {
          provide: getModelToken(Vacancy.name),
          useValue: modelMock,
        },
      ],
    }).compile();

    service = module.get<VacanciesService>(VacanciesService);
  });

  // ── findBySession ─────────────────────────────────────────────────────────

  describe('findBySession', () => {
    it('returns vacancies sorted by compatibilityScore descending, filtered by userId', async () => {
      const vacancies = [
        { ...stubVacancy, compatibilityScore: 90 },
        { ...stubVacancy, compatibilityScore: 70, _id: { toHexString: () => 'vacancy-id-2' } },
      ];
      // Chain: find(...).sort(...).exec()
      modelMock.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({ exec: makeExec(vacancies) }),
      });

      const result = await service.findBySession('session-id-1', 'user-a-id');

      expect(modelMock.find).toHaveBeenCalledWith({ sessionId: 'session-id-1', userId: 'user-a-id' });
      expect(result).toEqual(vacancies);
      // Verify sort was called with score descending
      const sortArg = (modelMock.find.mock.results[0].value as { sort: jest.Mock }).sort.mock.calls[0][0];
      expect(sortArg).toEqual({ compatibilityScore: -1 });
    });
  });

  // ── updateStatus ─────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it("sets status to 'dismissed' on a vacancy owned by the user", async () => {
      const updatedVacancy = { ...stubVacancy, status: 'dismissed' as const };
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(updatedVacancy) });

      const result = await service.updateStatus('vacancy-id-1', 'user-a-id', 'dismissed');

      expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'vacancy-id-1', userId: 'user-a-id' },
        { $set: { status: 'dismissed' } },
        { new: true }
      );
      expect(result).toEqual(updatedVacancy);
    });

    it('throws NotFoundException when vacancy not found or not owned by user', async () => {
      modelMock.findOneAndUpdate.mockReturnValue({ exec: makeExec(null) });

      await expect(service.updateStatus('bad-id', 'user-a-id', 'dismissed')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ── checkDuplicate ────────────────────────────────────────────────────────

  describe('checkDuplicate', () => {
    it('returns true when a vacancy with the same url exists for the user', async () => {
      modelMock.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: makeExec(stubVacancy) }),
      });

      const result = await service.checkDuplicate(
        'user-a-id',
        'https://example.com/job/1',
        'Acme Corp',
        'TypeScript Developer'
      );

      expect(result).toBe(true);
    });

    it('returns true when a vacancy with same company+title exists (case-insensitive)', async () => {
      modelMock.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: makeExec(stubVacancy) }),
      });

      const result = await service.checkDuplicate(
        'user-a-id',
        'https://example.com/job/different-url',
        'acme corp',   // different case
        'TYPESCRIPT DEVELOPER' // different case
      );

      expect(result).toBe(true);
    });

    it('returns false when no matching vacancy exists', async () => {
      modelMock.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: makeExec(null) }),
      });

      const result = await service.checkDuplicate(
        'user-a-id',
        'https://example.com/job/new',
        'Other Company',
        'Different Role'
      );

      expect(result).toBe(false);
    });
  });

  // ── insertMany ────────────────────────────────────────────────────────────

  describe('insertMany', () => {
    it('inserts vacancies and returns the inserted documents', async () => {
      const docs = [stubVacancy];
      modelMock.insertMany.mockResolvedValue(docs);

      const result = await service.insertMany([stubVacancy]);

      expect(modelMock.insertMany).toHaveBeenCalledWith([stubVacancy], { ordered: false });
      expect(result).toEqual(docs);
    });

    it('returns partial insertedDocs on duplicate key error (E11000)', async () => {
      const inserted = [stubVacancy];
      const dupError = Object.assign(new Error('E11000 duplicate key'), {
        insertedDocs: inserted,
      });
      modelMock.insertMany.mockRejectedValue(dupError);

      const result = await service.insertMany([stubVacancy]);

      expect(result).toEqual(inserted);
    });
  });
});
