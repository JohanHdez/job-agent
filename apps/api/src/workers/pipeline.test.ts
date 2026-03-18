/**
 * Unit tests for runSearchPipeline.
 *
 * All external dependencies (adapters, SessionModel, VacancyModel, Redis publisher)
 * are mocked. Tests verify the pipeline's orchestration logic:
 * - Platform iteration
 * - Filtering (excluded companies, missing fields, dedup)
 * - Batch scoring
 * - Event emission
 * - maxApplicationsPerSession enforcement (APPLY-04)
 * - Cancellation handling
 */

import mongoose from 'mongoose';
import type { SearchConfigSnapshotType, ProfessionalProfile, JobSearchAdapter, ScoringAdapter, RawJobResult, ScoredJob } from '@job-agent/core';

// ------------------------------------------------------------------
// Mock mongoose before importing pipeline (pipeline does mongoose.model())
// ------------------------------------------------------------------
const mockVacancyFindOne = jest.fn();
const mockVacancyCreate = jest.fn();

jest.mock('mongoose', () => {
  const original = jest.requireActual<typeof mongoose>('mongoose');
  const mockModel = {
    findOne: (...args: unknown[]) => ({
      lean: () => ({
        exec: () => mockVacancyFindOne(...args),
      }),
    }),
    create: (...args: unknown[]) => mockVacancyCreate(...args),
  };

  return {
    ...original,
    model: jest.fn((name: string, _schema?: unknown) => {
      if (name === 'Vacancy') return mockModel;
      // Let the real model function handle others
      return mockModel;
    }),
  };
});

import { runSearchPipeline } from './pipeline.js';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeRawJob(overrides: Partial<RawJobResult> = {}): RawJobResult {
  return {
    jobId: `job-${Math.random().toString(36).slice(2)}`,
    title: 'Software Engineer',
    company: 'Acme Corp',
    description: 'Build great software with TypeScript',
    url: `https://example.com/job/${Math.random()}`,
    location: 'Remote',
    platform: 'linkedin',
    postedAt: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

const MOCK_PROFILE: ProfessionalProfile = {
  fullName: 'Test User',
  email: 'test@example.com',
  headline: 'Senior Developer',
  summary: 'Experienced developer',
  seniority: 'Senior',
  yearsOfExperience: 5,
  skills: ['TypeScript', 'Node.js'],
  techStack: ['NestJS'],
  languages: [{ name: 'English', level: 'Native' }],
  experience: [],
  education: [],
};

const BASE_CONFIG: SearchConfigSnapshotType = {
  keywords: ['TypeScript Developer'],
  location: 'Remote',
  modality: ['Remote'],
  platforms: ['linkedin'],
  seniority: ['Senior'],
  languages: ['English'],
  datePosted: 'past_week',
  minScoreToApply: 70,
  maxApplicationsPerSession: 10,
  excludedCompanies: [],
};

function makeSessionModel(status = 'running') {
  const mockFindById = jest.fn().mockImplementation((_id: string, projection?: unknown) => {
    if (projection) {
      return { lean: () => Promise.resolve({ status }) };
    }
    return { lean: () => Promise.resolve({ status }) };
  });

  const mockFindByIdAndUpdate = jest.fn().mockResolvedValue({ nextEventId: 1 });
  const mockUpdateOne = jest.fn().mockResolvedValue({});

  return {
    findById: mockFindById,
    findByIdAndUpdate: mockFindByIdAndUpdate,
    updateOne: mockUpdateOne,
  };
}

function makeAdapter(jobs: RawJobResult[]): JobSearchAdapter {
  return {
    name: 'MockAdapter',
    platform: 'linkedin',
    search: jest.fn().mockResolvedValue(jobs),
  };
}

function makeScorer(scoreMap: Record<number, number> = {}): ScoringAdapter {
  return {
    name: 'MockScorer',
    scoreBatch: jest.fn().mockImplementation((inputs: { index: number }[]) => {
      const results: ScoredJob[] = inputs.map((input) => ({
        index: input.index,
        score: scoreMap[input.index] ?? 85, // Default: above threshold
        reason: 'test score',
      }));
      return Promise.resolve(results);
    }),
  };
}

function makePublisher() {
  return { publish: jest.fn().mockResolvedValue(1) };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  // Default: no duplicate vacancies
  mockVacancyFindOne.mockResolvedValue(null);
  mockVacancyCreate.mockResolvedValue({});
});

describe('runSearchPipeline', () => {
  describe('Test 1: platform iteration', () => {
    it('calls adapter.search() once per platform in config.platforms', async () => {
      const config = { ...BASE_CONFIG, platforms: ['linkedin', 'indeed'] as SearchConfigSnapshotType['platforms'] };
      const adapter = makeAdapter([makeRawJob()]);
      const scorer = makeScorer();
      const SessionModel = makeSessionModel();
      const publisher = makePublisher();

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config,
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer: scorer as unknown as ScoringAdapter,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      // adapter.search called twice — once per platform
      expect(adapter.search).toHaveBeenCalledTimes(2);
    });

    it('calls adapter.search with minResults: 20 per platform', async () => {
      const adapter = makeAdapter([makeRawJob()]);
      const scorer = makeScorer();
      const SessionModel = makeSessionModel();
      const publisher = makePublisher();

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config: BASE_CONFIG,
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer: scorer as unknown as ScoringAdapter,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      expect(adapter.search).toHaveBeenCalledWith(
        expect.objectContaining({ minResults: 20 }),
      );
    });
  });

  describe('Test 2: excluded companies filter', () => {
    it('emits job_skipped with reason "excluded_company" for excluded companies', async () => {
      const config = {
        ...BASE_CONFIG,
        excludedCompanies: ['BadCorp'],
      };
      const jobs = [
        makeRawJob({ company: 'BadCorp', jobId: 'bad-job' }),
        makeRawJob({ company: 'GoodCorp', jobId: 'good-job' }),
      ];
      const adapter = makeAdapter(jobs);
      const scorer = makeScorer();
      const SessionModel = makeSessionModel();
      const publisher = makePublisher();

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config,
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer: scorer as unknown as ScoringAdapter,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      // Find all published events
      const publishedEvents = publisher.publish.mock.calls.map(
        (call: [string, string]) => JSON.parse(call[1]) as { data: { type: string; reason?: string; jobId?: string } }
      );
      const skippedEvents = publishedEvents.filter((e) => e.data.type === 'job_skipped');
      const excludedSkip = skippedEvents.find((e) => e.data.jobId === 'bad-job');

      expect(excludedSkip).toBeDefined();
      expect(excludedSkip?.data.reason).toBe('excluded_company');
    });

    it('filters excluded companies case-insensitively', async () => {
      const config = {
        ...BASE_CONFIG,
        excludedCompanies: ['badcorp'],
      };
      const adapter = makeAdapter([makeRawJob({ company: 'BadCorp', jobId: 'bad-job' })]);
      const scorer = makeScorer();
      const SessionModel = makeSessionModel();
      const publisher = makePublisher();

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config,
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer: scorer as unknown as ScoringAdapter,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      const publishedEvents = publisher.publish.mock.calls.map(
        (call: [string, string]) => JSON.parse(call[1]) as { data: { type: string; reason?: string } }
      );
      const skippedEvents = publishedEvents.filter((e) => e.data.type === 'job_skipped');
      expect(skippedEvents[0]?.data.reason).toBe('excluded_company');
    });
  });

  describe('Test 3: missing fields filter', () => {
    it('emits job_skipped with reason "missing_fields" for jobs missing title, company, description, or url', async () => {
      const jobs = [
        makeRawJob({ title: '', jobId: 'missing-title' }), // missing title
        makeRawJob({ description: '', jobId: 'missing-desc' }), // missing description
        makeRawJob({ url: '', jobId: 'missing-url' }), // missing url
        makeRawJob({ jobId: 'valid-job' }), // valid
      ];
      const adapter = makeAdapter(jobs);
      const scorer = makeScorer();
      const SessionModel = makeSessionModel();
      const publisher = makePublisher();

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config: BASE_CONFIG,
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer: scorer as unknown as ScoringAdapter,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      const publishedEvents = publisher.publish.mock.calls.map(
        (call: [string, string]) => JSON.parse(call[1]) as { data: { type: string; reason?: string } }
      );
      const skippedEvents = publishedEvents.filter(
        (e) => e.data.type === 'job_skipped' && e.data.reason === 'missing_fields',
      );

      expect(skippedEvents).toHaveLength(3);
    });
  });

  describe('Test 4: deduplication filter', () => {
    it('emits job_skipped with reason "already_applied" for duplicate vacancies', async () => {
      const dupJob = makeRawJob({ jobId: 'dup-job' });
      const adapter = makeAdapter([dupJob]);
      const scorer = makeScorer();
      const SessionModel = makeSessionModel();
      const publisher = makePublisher();

      // Simulate: this job is already in history
      mockVacancyFindOne.mockResolvedValue({ _id: 'existing-id' });

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config: BASE_CONFIG,
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer: scorer as unknown as ScoringAdapter,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      const publishedEvents = publisher.publish.mock.calls.map(
        (call: [string, string]) => JSON.parse(call[1]) as { data: { type: string; reason?: string } }
      );
      const skippedEvents = publishedEvents.filter((e) => e.data.type === 'job_skipped');
      expect(skippedEvents[0]?.data.reason).toBe('already_applied');
    });
  });

  describe('Test 5: batch scoring', () => {
    it('batches jobs in groups of 5 for scoring', async () => {
      // 7 jobs → 2 batches (5 + 2)
      const jobs = Array.from({ length: 7 }, (_, i) => makeRawJob({ jobId: `job-${i}` }));
      const adapter = makeAdapter(jobs);
      const scorer = makeScorer();
      const SessionModel = makeSessionModel();
      const publisher = makePublisher();

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config: { ...BASE_CONFIG, maxApplicationsPerSession: 20 },
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer: scorer as unknown as ScoringAdapter,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      expect(scorer.scoreBatch).toHaveBeenCalledTimes(2);
      const firstBatch = (scorer.scoreBatch as jest.Mock).mock.calls[0][0] as unknown[];
      const secondBatch = (scorer.scoreBatch as jest.Mock).mock.calls[1][0] as unknown[];
      expect(firstBatch).toHaveLength(5);
      expect(secondBatch).toHaveLength(2);
    });
  });

  describe('Test 6: job_found events for passing score', () => {
    it('emits job_found event for each job scoring >= minScoreToApply', async () => {
      const jobs = [makeRawJob({ jobId: 'high-score' }), makeRawJob({ jobId: 'low-score' })];
      const adapter = makeAdapter(jobs);
      const scorer: ScoringAdapter = {
        name: 'MockScorer',
        scoreBatch: jest.fn().mockResolvedValue([
          { index: 0, score: 85, reason: 'above threshold' },
          { index: 1, score: 30, reason: 'below threshold' },
        ]),
      };
      const SessionModel = makeSessionModel();
      const publisher = makePublisher();

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config: { ...BASE_CONFIG, minScoreToApply: 70 },
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      const publishedEvents = publisher.publish.mock.calls.map(
        (call: [string, string]) => JSON.parse(call[1]) as { data: { type: string; jobId?: string } }
      );
      const foundEvents = publishedEvents.filter((e) => e.data.type === 'job_found');
      expect(foundEvents).toHaveLength(1);
      expect(foundEvents[0].data.jobId).toBe('high-score');
    });
  });

  describe('Test 7: job_skipped for low score', () => {
    it('emits job_skipped with reason "score_too_low" for jobs below minScoreToApply', async () => {
      const adapter = makeAdapter([makeRawJob({ jobId: 'low-job' })]);
      const scorer: ScoringAdapter = {
        name: 'MockScorer',
        scoreBatch: jest.fn().mockResolvedValue([{ index: 0, score: 40, reason: 'weak match' }]),
      };
      const SessionModel = makeSessionModel();
      const publisher = makePublisher();

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config: { ...BASE_CONFIG, minScoreToApply: 70 },
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      const publishedEvents = publisher.publish.mock.calls.map(
        (call: [string, string]) => JSON.parse(call[1]) as { data: { type: string; reason?: string } }
      );
      const skippedEvents = publishedEvents.filter((e) => e.data.type === 'job_skipped');
      expect(skippedEvents[0]?.data.reason).toBe('score_too_low');
    });
  });

  describe('Test 8: session_complete event with accurate totals', () => {
    it('emits session_complete as the last event with accurate found/skipped totals', async () => {
      const jobs = [
        makeRawJob({ jobId: 'found-1' }),
        makeRawJob({ jobId: 'low-score-1' }),
        makeRawJob({ company: 'ExcludedCo', jobId: 'excluded-1' }),
      ];
      const adapter = makeAdapter(jobs);
      const scorer: ScoringAdapter = {
        name: 'MockScorer',
        scoreBatch: jest.fn().mockResolvedValue([
          { index: 0, score: 90, reason: 'great match' },
          { index: 1, score: 20, reason: 'poor match' },
        ]),
      };
      const SessionModel = makeSessionModel();
      const publisher = makePublisher();

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config: { ...BASE_CONFIG, excludedCompanies: ['ExcludedCo'], maxApplicationsPerSession: 10 },
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      const publishedEvents = publisher.publish.mock.calls.map(
        (call: [string, string]) => JSON.parse(call[1]) as { data: { type: string; totals?: { found: number; skipped: number } } }
      );
      const completeEvent = publishedEvents.find((e) => e.data.type === 'session_complete');

      expect(completeEvent).toBeDefined();
      expect(completeEvent?.data.totals?.found).toBe(1);
      expect(completeEvent?.data.totals?.skipped).toBe(2); // 1 excluded + 1 low score
      // session_complete should be the last published event
      const lastEvent = publishedEvents[publishedEvents.length - 1];
      expect(lastEvent.data.type).toBe('session_complete');
    });
  });

  describe('Test 9: maxApplicationsPerSession enforcement (APPLY-04)', () => {
    it('stops after totals.found >= maxApplicationsPerSession and emits session_complete', async () => {
      const config = { ...BASE_CONFIG, maxApplicationsPerSession: 2 };
      // 10 jobs all scoring above threshold
      const jobs = Array.from({ length: 10 }, (_, i) => makeRawJob({ jobId: `job-${i}` }));
      const adapter = makeAdapter(jobs);
      const scorer = makeScorer(); // Default score: 85 (above 70 threshold)
      const SessionModel = makeSessionModel();
      const publisher = makePublisher();

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config,
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer: scorer as unknown as ScoringAdapter,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      const publishedEvents = publisher.publish.mock.calls.map(
        (call: [string, string]) => JSON.parse(call[1]) as { data: { type: string } }
      );
      const foundEvents = publishedEvents.filter((e) => e.data.type === 'job_found');
      const completeEvent = publishedEvents.find((e) => e.data.type === 'session_complete');

      expect(foundEvents).toHaveLength(2); // Exactly maxApplicationsPerSession
      expect(completeEvent).toBeDefined();
    });
  });

  describe('Test 10: cancellation check', () => {
    it('stops processing after session is cancelled', async () => {
      const config = { ...BASE_CONFIG, maxApplicationsPerSession: 20 };
      // 10 jobs
      const jobs = Array.from({ length: 10 }, (_, i) => makeRawJob({ jobId: `job-${i}` }));
      const adapter = makeAdapter(jobs);
      const scorer = makeScorer();
      const publisher = makePublisher();

      let callCount = 0;
      const SessionModel = {
        findById: jest.fn().mockImplementation(() => {
          callCount++;
          // Return cancelled status after the first isCancelled() check
          const status = callCount > 1 ? 'cancelled' : 'running';
          return { lean: () => Promise.resolve({ status }) };
        }),
        findByIdAndUpdate: jest.fn().mockResolvedValue({ nextEventId: 1 }),
        updateOne: jest.fn().mockResolvedValue({}),
      };

      await runSearchPipeline({
        sessionId: 'sess-1',
        userId: 'user-1',
        config,
        profile: MOCK_PROFILE,
        adapter: adapter as unknown as JobSearchAdapter,
        scorer: scorer as unknown as ScoringAdapter,
        publisher: publisher as never,
        SessionModel: SessionModel as never,
      });

      // Because session is cancelled before second batch, scorer should only be called once
      expect(scorer.scoreBatch).toHaveBeenCalledTimes(1);
    });
  });
});
