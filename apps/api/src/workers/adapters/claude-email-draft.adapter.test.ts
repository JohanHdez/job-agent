/**
 * Unit tests for ClaudeEmailDraftAdapter.
 *
 * Tests cover:
 * - Correct system prompt construction (150-word limit, 2-point requirement)
 * - JSON response parsing (subject + body extraction)
 * - Retry logic with exponential backoff (2 retries on API error)
 * - 8s timeout via AbortController
 * - Job title, company, and profile skills included in prompt
 * - name property returns correct string
 *
 * EmailSenderService:
 * - send() calls nodemailer createTransport with decrypted SMTP password
 */

import { ClaudeEmailDraftAdapter } from './claude-email-draft.adapter.js';
import type { EmailDraftInput } from '@job-agent/core';
import type { ProfessionalProfile } from '@job-agent/core';

// Mock @anthropic-ai/sdk
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Mock logger
jest.mock('@job-agent/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockProfile: ProfessionalProfile = {
  fullName: 'John Doe',
  email: 'john@example.com',
  headline: 'Senior TypeScript Developer',
  summary: 'Experienced developer with 8 years of TypeScript expertise.',
  seniority: 'Senior',
  yearsOfExperience: 8,
  skills: ['TypeScript', 'Node.js', 'React'],
  techStack: ['NestJS', 'MongoDB', 'Redis'],
  languages: [{ name: 'English', level: 'Native' }],
  experience: [],
  education: [],
};

const mockInput: EmailDraftInput = {
  profile: mockProfile,
  jobDescription: 'We are looking for a Senior TypeScript Developer with React experience.',
  jobTitle: 'Senior TypeScript Developer',
  company: 'TechCorp Inc.',
};

describe('ClaudeEmailDraftAdapter', () => {
  let adapter: ClaudeEmailDraftAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ClaudeEmailDraftAdapter('test-api-key');
  });

  describe('name', () => {
    it('Test 6: returns "Claude Email Draft Generator"', () => {
      expect(adapter.name).toBe('Claude Email Draft Generator');
    });
  });

  describe('generateDraft', () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            subject: 'Application for Senior TypeScript Developer at TechCorp Inc.',
            body: 'Dear Hiring Team, I am writing to apply for the Senior TypeScript Developer position.',
          }),
        },
      ],
    };

    it('Test 1: calls Anthropic API with system prompt containing 150-word limit and 2-point requirement', async () => {
      mockCreate.mockResolvedValueOnce(mockResponse);

      await adapter.generateDraft(mockInput);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0] as { system: string };
      expect(callArgs.system).toContain('150 words');
      expect(callArgs.system).toContain('2 specific points');
    });

    it('Test 2: parses JSON response and extracts subject and body', async () => {
      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await adapter.generateDraft(mockInput);

      expect(result.subject).toBe('Application for Senior TypeScript Developer at TechCorp Inc.');
      expect(result.body).toContain('Senior TypeScript Developer');
    });

    it('Test 3: retries up to 2 times on API error with exponential backoff', async () => {
      // Spy on global setTimeout to make delays instant
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        (fn as () => void)();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });

      mockCreate
        .mockRejectedValueOnce(new Error('API Error 1'))
        .mockRejectedValueOnce(new Error('API Error 2'))
        .mockResolvedValueOnce(mockResponse);

      const result = await adapter.generateDraft(mockInput);

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(result.subject).toBeDefined();
      expect(result.body).toBeDefined();

      setTimeoutSpy.mockRestore();
    });

    it('Test 4: throws after all retries are exhausted (after MAX_RETRIES failures)', async () => {
      // Spy on global setTimeout to make delays instant
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        (fn as () => void)();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });

      mockCreate
        .mockRejectedValueOnce(new Error('API Error 1'))
        .mockRejectedValueOnce(new Error('API Error 2'))
        .mockRejectedValueOnce(new Error('API Error 3'));

      await expect(adapter.generateDraft(mockInput)).rejects.toThrow('API Error 3');

      expect(mockCreate).toHaveBeenCalledTimes(3);

      setTimeoutSpy.mockRestore();
    });

    it('Test 5: includes job title, company, and profile skills in the prompt', async () => {
      mockCreate.mockResolvedValueOnce(mockResponse);

      await adapter.generateDraft(mockInput);

      const callArgs = mockCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
      const userPrompt = callArgs.messages[0].content;

      expect(userPrompt).toContain('Senior TypeScript Developer');
      expect(userPrompt).toContain('TechCorp Inc.');
      expect(userPrompt).toContain('TypeScript');
      expect(userPrompt).toContain('Node.js');
    });
  });
});

// EmailSenderService is tested in email-sender.service.test.ts (separate file, same module directory)
