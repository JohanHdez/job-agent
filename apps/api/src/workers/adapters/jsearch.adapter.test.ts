/**
 * Unit tests for JSearchAdapter.
 * Mocks global.fetch to avoid real API calls.
 */

import { JSearchAdapter } from './jsearch.adapter.js';
import type { SearchParams } from '@job-agent/core';

const BASE_PARAMS: SearchParams = {
  keywords: ['Software Engineer', 'TypeScript'],
  location: 'Remote',
  modality: ['Remote'],
  datePosted: 'past_week',
  minResults: 2,
  maxPages: 3,
};

/** Helper to build a minimal JSearch API item */
function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    job_id: 'job-123',
    job_title: 'Software Engineer',
    employer_name: 'Acme Corp',
    job_description: 'Write great software.',
    job_apply_link: 'https://example.com/apply',
    job_city: 'San Francisco',
    job_state: 'CA',
    job_country: 'US',
    job_posted_at_datetime_utc: '2026-03-01T10:00:00Z',
    job_publisher: 'LinkedIn',
    ...overrides,
  };
}

/** Helper to build a mock fetch response */
function mockFetchOnce(data: unknown[], status = 200) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => ({ data }),
  } as unknown as Response);
}

beforeEach(() => {
  jest.resetAllMocks();
  // Silence chalk output in tests
  jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

describe('JSearchAdapter', () => {
  describe('Test 1: makes GET request with correct params', () => {
    it('calls jsearch.p.rapidapi.com/search with query params derived from SearchParams', async () => {
      mockFetchOnce([makeItem()]);
      const adapter = new JSearchAdapter('test-api-key');
      await adapter.search({ ...BASE_PARAMS, minResults: 1 });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
      expect(url).toContain('jsearch.p.rapidapi.com/search');
      expect(url).toContain('Software+Engineer');
      expect(url).toContain('Remote');
      expect((options.headers as Record<string, string>)['x-rapidapi-key']).toBe('test-api-key');
      expect((options.headers as Record<string, string>)['x-rapidapi-host']).toBe('jsearch.p.rapidapi.com');
    });
  });

  describe('Test 2: maps JSearch response fields to RawJobResult', () => {
    it('correctly maps job_id, job_title, employer_name, etc. to RawJobResult shape', async () => {
      mockFetchOnce([makeItem()]);
      const adapter = new JSearchAdapter('test-api-key');
      const results = await adapter.search({ ...BASE_PARAMS, minResults: 1 });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        jobId: 'job-123',
        title: 'Software Engineer',
        company: 'Acme Corp',
        description: 'Write great software.',
        url: 'https://example.com/apply',
        location: 'San Francisco, CA, US',
        postedAt: '2026-03-01T10:00:00Z',
      });
    });
  });

  describe('Test 3: maps job_publisher to PlatformId', () => {
    it('maps "LinkedIn" -> "linkedin", "Indeed" -> "indeed", unknown -> "linkedin"', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              makeItem({ job_id: 'a', job_publisher: 'LinkedIn' }),
              makeItem({ job_id: 'b', job_publisher: 'Indeed' }),
              makeItem({ job_id: 'c', job_publisher: 'SomeUnknownBoard' }),
            ],
          }),
        } as unknown as Response);

      const adapter = new JSearchAdapter('test-api-key');
      const results = await adapter.search({ ...BASE_PARAMS, minResults: 3 });

      expect(results[0].platform).toBe('linkedin');
      expect(results[1].platform).toBe('indeed');
      expect(results[2].platform).toBe('linkedin'); // fallback
    });
  });

  describe('Test 4: paginates until minResults collected or maxPages reached', () => {
    it('fetches multiple pages until minResults is satisfied', async () => {
      // Each page returns 1 item; minResults = 2 → expects 2 fetch calls
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [makeItem({ job_id: 'page1-job' })] }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [makeItem({ job_id: 'page2-job' })] }),
        } as unknown as Response);

      const adapter = new JSearchAdapter('test-api-key');
      const results = await adapter.search({ ...BASE_PARAMS, minResults: 2, maxPages: 5 });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
    });

    it('stops at maxPages even if minResults not reached', async () => {
      // Returns 1 item per page; maxPages=2, minResults=10 → stops after 2 pages
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [makeItem({ job_id: 'p1' })] }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [makeItem({ job_id: 'p2' })] }),
        } as unknown as Response);

      const adapter = new JSearchAdapter('test-api-key');
      const results = await adapter.search({ ...BASE_PARAMS, minResults: 10, maxPages: 2 });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
    });
  });

  describe('Test 5: returns partial results gracefully on API error', () => {
    it('returns whatever results were collected before the error response', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [makeItem({ job_id: 'ok-job' })] }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({ data: [] }),
        } as unknown as Response);

      const adapter = new JSearchAdapter('test-api-key');
      const results = await adapter.search({ ...BASE_PARAMS, minResults: 5, maxPages: 3 });

      // Should return 1 result (from page 1) and stop after the error
      expect(results).toHaveLength(1);
      expect(results[0].jobId).toBe('ok-job');
    });

    it('skips items missing required fields (job_id, job_title, employer_name, job_apply_link)', async () => {
      mockFetchOnce([
        makeItem({ job_id: 'valid' }),
        makeItem({ job_id: undefined }), // missing job_id
        makeItem({ job_title: undefined }), // missing title
      ]);

      const adapter = new JSearchAdapter('test-api-key');
      const results = await adapter.search({ ...BASE_PARAMS, minResults: 1 });

      // Only the valid item should be returned
      expect(results).toHaveLength(1);
      expect(results[0].jobId).toBe('valid');
    });
  });
});
