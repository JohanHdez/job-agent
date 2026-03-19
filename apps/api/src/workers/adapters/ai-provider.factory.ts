/**
 * AI Provider Factory
 *
 * Creates the correct AI adapter (Claude or Gemini) based on the AI_PROVIDER
 * environment variable. Used by the BullMQ worker process (scoring) and the
 * NestJS DI container (email drafts).
 *
 * Supported values for AI_PROVIDER:
 *   - "gemini"  → Google Gemini 2.0 Flash (free tier, requires GEMINI_API_KEY)
 *   - "claude"  → Anthropic Claude Sonnet (paid, requires ANTHROPIC_API_KEY)
 *
 * Defaults to "gemini" when AI_PROVIDER is not set.
 */

import type { ScoringAdapter, EmailDraftAdapter } from '@job-agent/core';
import { ClaudeScoringAdapter } from './claude-scoring.adapter.js';
import { GeminiScoringAdapter } from './gemini-scoring.adapter.js';
import { ClaudeEmailDraftAdapter } from './claude-email-draft.adapter.js';
import { GeminiEmailDraftAdapter } from './gemini-email-draft.adapter.js';

export type AiProvider = 'claude' | 'gemini';

/**
 * Resolves the configured AI provider from the environment.
 * Defaults to 'gemini' when AI_PROVIDER is not set.
 */
export function resolveAiProvider(): AiProvider {
  const raw = (process.env['AI_PROVIDER'] ?? 'gemini').toLowerCase().trim();
  return raw === 'claude' ? 'claude' : 'gemini';
}

/**
 * Creates the correct ScoringAdapter based on AI_PROVIDER.
 * Called from the BullMQ worker process where NestJS DI is not available.
 *
 * @throws Error when the required API key for the configured provider is missing
 */
export function createScoringAdapter(): ScoringAdapter {
  const provider = resolveAiProvider();

  if (provider === 'claude') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=claude');
    return new ClaudeScoringAdapter(apiKey);
  }

  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) throw new Error('GEMINI_API_KEY is required when AI_PROVIDER=gemini');
  return new GeminiScoringAdapter(apiKey);
}

/**
 * Creates the correct EmailDraftAdapter based on AI_PROVIDER.
 * Called from NestJS useFactory — receives keys via ConfigService.
 *
 * @param anthropicKey - Value of ANTHROPIC_API_KEY from ConfigService
 * @param geminiKey    - Value of GEMINI_API_KEY from ConfigService
 * @throws Error when the required API key for the configured provider is missing
 */
export function createEmailDraftAdapter(
  anthropicKey: string | undefined,
  geminiKey: string | undefined
): EmailDraftAdapter {
  const provider = resolveAiProvider();

  if (provider === 'claude') {
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=claude');
    return new ClaudeEmailDraftAdapter(anthropicKey);
  }

  if (!geminiKey) throw new Error('GEMINI_API_KEY is required when AI_PROVIDER=gemini');
  return new GeminiEmailDraftAdapter(geminiKey);
}
