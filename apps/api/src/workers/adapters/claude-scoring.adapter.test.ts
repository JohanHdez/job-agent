/**
 * Unit tests for ClaudeScoringAdapter.
 * Mocks the Anthropic SDK to avoid real API calls.
 */

import type { ScoringInput } from '@job-agent/core';
import type { ProfessionalProfile } from '@job-agent/core';

// Mock the Anthropic SDK before importing the adapter
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

// Import after mock is set up
import { ClaudeScoringAdapter } from './claude-scoring.adapter.js';

const MOCK_PROFILE: ProfessionalProfile = {
  fullName: 'John Doe',
  email: 'john@example.com',
  headline: 'Senior TypeScript Developer',
  summary: 'Experienced developer with focus on Node.js and React.',
  seniority: 'Senior',
  yearsOfExperience: 7,
  skills: ['TypeScript', 'Node.js', 'React', 'MongoDB'],
  techStack: ['NestJS', 'Redis', 'Docker'],
  languages: [{ name: 'English', level: 'Native' }, { name: 'Spanish', level: 'Advanced' }],
  experience: [],
  education: [],
};

const MOCK_INPUTS: ScoringInput[] = [
  { index: 0, title: 'Senior TypeScript Dev', company: 'Tech Corp', description: 'Build APIs with TypeScript and NestJS', location: 'Remote' },
  { index: 1, title: 'React Developer', company: 'Startup Inc', description: 'Build frontend apps with React', location: 'Remote' },
];

function makeTextResponse(json: string) {
  return {
    content: [{ type: 'text', text: json }],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

describe('ClaudeScoringAdapter', () => {
  describe('Test 6: calls Claude API with structured prompt', () => {
    it('calls messages.create with the correct model and profile-job prompt', async () => {
      mockCreate.mockResolvedValueOnce(
        makeTextResponse('[{"index":0,"score":85,"reason":"Strong TypeScript match"},{"index":1,"score":70,"reason":"React skills present"}]')
      );

      const adapter = new ClaudeScoringAdapter('test-anthropic-key');
      await adapter.scoreBatch(MOCK_INPUTS, MOCK_PROFILE);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const call = mockCreate.mock.calls[0][0] as { model: string; max_tokens: number; messages: Array<{ role: string; content: string }> };
      expect(call.model).toBe('claude-sonnet-4-6-20250514');
      expect(call.max_tokens).toBe(1024);
      expect(call.messages[0].role).toBe('user');
      // Prompt should contain profile info
      expect(call.messages[0].content).toContain('Senior TypeScript Developer');
      // Prompt should contain job titles
      expect(call.messages[0].content).toContain('Senior TypeScript Dev');
    });
  });

  describe('Test 7: parses JSON response into ScoredJob[]', () => {
    it('returns correctly parsed ScoredJob array from Claude response', async () => {
      mockCreate.mockResolvedValueOnce(
        makeTextResponse('[{"index":0,"score":85,"reason":"Strong TypeScript match"},{"index":1,"score":70,"reason":"React skills present"}]')
      );

      const adapter = new ClaudeScoringAdapter('test-anthropic-key');
      const results = await adapter.scoreBatch(MOCK_INPUTS, MOCK_PROFILE);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ index: 0, score: 85, reason: 'Strong TypeScript match' });
      expect(results[1]).toMatchObject({ index: 1, score: 70, reason: 'React skills present' });
    });

    it('clamps scores to 0-100 range', async () => {
      mockCreate.mockResolvedValueOnce(
        makeTextResponse('[{"index":0,"score":150,"reason":"Overflow score"},{"index":1,"score":-10,"reason":"Negative score"}]')
      );

      const adapter = new ClaudeScoringAdapter('test-anthropic-key');
      const results = await adapter.scoreBatch(MOCK_INPUTS, MOCK_PROFILE);

      expect(results[0].score).toBe(100);
      expect(results[1].score).toBe(0);
    });

    it('handles JSON wrapped in markdown code blocks', async () => {
      mockCreate.mockResolvedValueOnce(
        makeTextResponse('```json\n[{"index":0,"score":75,"reason":"Good match"}]\n```')
      );

      const adapter = new ClaudeScoringAdapter('test-anthropic-key');
      const results = await adapter.scoreBatch([MOCK_INPUTS[0]], MOCK_PROFILE);

      expect(results[0].score).toBe(75);
    });
  });

  describe('Test 8: graceful degradation on API error', () => {
    it('returns score=0 for all jobs when the API throws an error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      const adapter = new ClaudeScoringAdapter('test-anthropic-key');
      const results = await adapter.scoreBatch(MOCK_INPUTS, MOCK_PROFILE);

      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(0);
      expect(results[1].score).toBe(0);
      results.forEach((r) => expect(r.reason).toContain('scoring_api_error'));
    });

    it('returns empty array for empty input', async () => {
      const adapter = new ClaudeScoringAdapter('test-anthropic-key');
      const results = await adapter.scoreBatch([], MOCK_PROFILE);

      expect(results).toHaveLength(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
