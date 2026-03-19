/**
 * Unit tests for ApplicationsService.
 *
 * Tests cover:
 * - createDraft returns 409 when application exists
 * - createDraft throws 404 when vacancy not found
 * - createDraft creates with draft status and initial history entry
 * - createDraft calls emailDraftAdapter.generateDraft with correct input
 * - updateStatus only accepts valid manual states
 * - updateStatus appends history entry with timestamp and optional note
 * - findPaginated returns correct page/pageSize structure
 * - exportCsv produces valid CSV header and rows
 * - countPendingReview counts draft + pending_review statuses
 *
 * All Mongoose models are mocked. EmailDraftAdapter injected via DI mock.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApplicationsService } from './applications.service.js';
import { EmailSenderService } from './email-sender.service.js';
import { Application } from './schemas/application.schema.js';
import { Vacancy } from '../vacancies/schemas/vacancy.schema.js';
import { EMAIL_DRAFT_ADAPTER_TOKEN } from './applications.module.js';
import type { ProfessionalProfile } from '@job-agent/core';
import type { CreateApplicationDto } from './dto/create-application.dto.js';

// Mock logger
jest.mock('@job-agent/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock token-cipher (used by EmailSenderService)
jest.mock('../../common/crypto/token-cipher.js', () => ({
  decryptToken: jest.fn().mockReturnValue('decrypted'),
}));

// Mock nodemailer (used by EmailSenderService)
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

const mockProfile: ProfessionalProfile = {
  fullName: 'Jane Smith',
  email: 'jane@example.com',
  headline: 'Full-Stack Developer',
  summary: 'Experienced developer.',
  seniority: 'Mid',
  yearsOfExperience: 5,
  skills: ['TypeScript', 'React'],
  techStack: ['Node.js', 'MongoDB'],
  languages: [{ name: 'English', level: 'Native' }],
  experience: [],
  education: [],
};

const mockVacancy = {
  _id: 'vacancy-id-123',
  title: 'Full Stack Developer',
  company: 'Acme Corp',
  description: 'Build full-stack applications.',
  recipientEmail: 'hr@acme.com',
  userId: 'user-id-abc',
  compatibilityScore: 85,
  platform: 'linkedin',
  status: 'active',
};

const mockApplication = {
  _id: 'app-id-456',
  userId: 'user-id-abc',
  vacancyId: 'vacancy-id-123',
  status: 'draft',
  emailContent: { subject: 'Application for Full Stack Developer', body: 'Dear...' },
  recipientEmail: 'hr@acme.com',
  history: [{ status: 'draft', timestamp: '2026-03-18T00:00:00.000Z' }],
  createdAt: '2026-03-18T00:00:00.000Z',
  save: jest.fn().mockResolvedValue(undefined),
};

describe('ApplicationsService', () => {
  let service: ApplicationsService;

  // Mongoose model mocks
  const mockApplicationModelFindOne = jest.fn();
  const mockApplicationModelCreate = jest.fn();
  const mockApplicationModelFind = jest.fn();
  const mockApplicationModelCountDocuments = jest.fn();

  const mockVacancyModelFindOne = jest.fn();
  const mockVacancyModelFind = jest.fn();
  const mockVacancyModelUpdateOne = jest.fn();

  const mockEmailDraftAdapter = {
    name: 'Mock Email Draft Adapter',
    generateDraft: jest.fn().mockResolvedValue({
      subject: 'Application for Full Stack Developer at Acme Corp',
      body: 'Dear Hiring Team...',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockApplication.save.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        EmailSenderService,
        {
          provide: EMAIL_DRAFT_ADAPTER_TOKEN,
          useValue: mockEmailDraftAdapter,
        },
        {
          provide: getModelToken(Application.name),
          useValue: {
            findOne: mockApplicationModelFindOne,
            create: mockApplicationModelCreate,
            find: mockApplicationModelFind,
            countDocuments: mockApplicationModelCountDocuments,
          },
        },
        {
          provide: getModelToken(Vacancy.name),
          useValue: {
            findOne: mockVacancyModelFindOne,
            findById: jest.fn(),
            find: mockVacancyModelFind,
            updateOne: mockVacancyModelUpdateOne,
          },
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
  });

  // ── createDraft ────────────────────────────────────────────────────────────

  describe('createDraft', () => {
    const dto: CreateApplicationDto = { vacancyId: 'vacancy-id-123' };

    it('throws 404 when vacancy not found', async () => {
      mockVacancyModelFindOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.createDraft('user-id-abc', dto, mockProfile)).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws 409 when application already exists', async () => {
      mockVacancyModelFindOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockVacancy),
      });
      mockApplicationModelFindOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockApplication),
      });

      await expect(service.createDraft('user-id-abc', dto, mockProfile)).rejects.toThrow(
        ConflictException
      );
    });

    it('creates application with draft status and initial history entry', async () => {
      mockVacancyModelFindOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockVacancy),
      });
      mockApplicationModelFindOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockApplicationModelCreate.mockResolvedValue({
        ...mockApplication,
        status: 'draft',
        history: [{ status: 'draft', timestamp: expect.any(String) }],
      });

      const result = await service.createDraft('user-id-abc', dto, mockProfile);

      expect(result.status).toBe('draft');
      expect(mockApplicationModelCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'draft',
          recipientEmail: 'hr@acme.com',
        })
      );
      const createCall = mockApplicationModelCreate.mock.calls[0][0] as Record<string, unknown>;
      const history = createCall['history'] as Array<{ status: string }>;
      expect(history[0].status).toBe('draft');
    });

    it('calls emailDraftAdapter.generateDraft with correct input including profile', async () => {
      mockVacancyModelFindOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockVacancy),
      });
      mockApplicationModelFindOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockApplicationModelCreate.mockResolvedValue(mockApplication);

      await service.createDraft('user-id-abc', dto, mockProfile);

      expect(mockEmailDraftAdapter.generateDraft).toHaveBeenCalledWith({
        profile: mockProfile,
        jobDescription: mockVacancy.description,
        jobTitle: mockVacancy.title,
        company: mockVacancy.company,
      });
    });
  });

  // ── updateStatus ───────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('throws 400 when status is not a valid manual state', async () => {
      await expect(
        service.updateStatus('user-id-abc', 'app-id-456', {
          status: 'draft' as never,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when status is sent (system-managed)', async () => {
      await expect(
        service.updateStatus('user-id-abc', 'app-id-456', {
          status: 'sent' as never,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('appends history entry with timestamp and optional note', async () => {
      const appDoc = {
        ...mockApplication,
        status: 'sent',
        history: [],
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockApplicationModelFindOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(appDoc),
      });

      const result = await service.updateStatus('user-id-abc', 'app-id-456', {
        status: 'interview_scheduled',
        note: 'Interview on Monday',
      });

      expect(appDoc.history).toHaveLength(1);
      expect(appDoc.history[0]).toMatchObject({
        status: 'interview_scheduled',
        note: 'Interview on Monday',
      });
      expect(result.status).toBe('interview_scheduled');
    });

    it('throws 404 when application not found', async () => {
      mockApplicationModelFindOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateStatus('user-id-abc', 'app-id-456', {
          status: 'rejected',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── findPaginated ──────────────────────────────────────────────────────────

  describe('findPaginated', () => {
    it('returns correct page/pageSize structure', async () => {
      const mockApps = [mockApplication];
      mockApplicationModelFind.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockApps),
      });
      mockApplicationModelCountDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findPaginated('user-id-abc', { page: 2 });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('defaults to page 1 when not specified', async () => {
      mockApplicationModelFind.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockApplicationModelCountDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const result = await service.findPaginated('user-id-abc', {});

      expect(result.page).toBe(1);
    });
  });

  // ── exportCsv ─────────────────────────────────────────────────────────────

  describe('exportCsv', () => {
    it('produces valid CSV header and rows', async () => {
      mockApplicationModelFind.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            ...mockApplication,
            vacancyId: 'vacancy-id-123',
            recipientEmail: 'hr@acme.com',
            status: 'sent',
            createdAt: '2026-03-18T00:00:00.000Z',
          },
        ]),
      });
      mockVacancyModelFind.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: { toString: () => 'vacancy-id-123' },
            company: 'Acme Corp',
            title: 'Full Stack Developer',
            compatibilityScore: 85,
            platform: 'linkedin',
          },
        ]),
      });

      const csv = await service.exportCsv('user-id-abc', {});

      expect(csv).toContain('Date,Company,Title,Status,Score,Recipient Email,Platform');
      expect(csv).toContain('Acme Corp');
      expect(csv).toContain('Full Stack Developer');
      expect(csv).toContain('sent');
      expect(csv).toContain('hr@acme.com');
    });
  });

  // ── countPendingReview ─────────────────────────────────────────────────────

  describe('countPendingReview', () => {
    it('counts draft + pending_review statuses', async () => {
      mockApplicationModelCountDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(3),
      });

      const count = await service.countPendingReview('user-id-abc');

      expect(count).toBe(3);
      expect(mockApplicationModelCountDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          status: { $in: ['draft', 'pending_review'] },
        })
      );
    });
  });
});
