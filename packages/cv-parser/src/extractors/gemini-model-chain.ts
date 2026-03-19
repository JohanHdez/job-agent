/**
 * Gemini model fallback chain for cv-parser.
 * Mirrors apps/api/src/workers/adapters/gemini-model-chain.ts
 */

import { GoogleGenerativeAI, type ModelParams, type RequestOptions } from '@google/generative-ai';
import { logger } from '../utils/logger';

export const GEMINI_MODEL_CHAIN = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const;

function shouldTryNextModel(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  if (msg.includes('404') || msg.includes('is not found') || msg.includes('not supported for generateContent')) {
    return true;
  }
  if (msg.includes('429') && msg.includes('limit: 0')) {
    return true;
  }
  return false;
}

export async function generateWithFallback(
  genAI: GoogleGenerativeAI,
  params: Omit<ModelParams, 'model'>,
  prompt: string,
  requestOptions?: RequestOptions
): Promise<string> {
  let lastError: unknown;

  for (const modelName of GEMINI_MODEL_CHAIN) {
    try {
      const model = genAI.getGenerativeModel({ ...params, model: modelName }, requestOptions);
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      if (modelName !== GEMINI_MODEL_CHAIN[0]) {
        logger.warn(`Gemini used fallback model: ${modelName}`);
      }

      return text;
    } catch (err: unknown) {
      lastError = err;
      if (shouldTryNextModel(err)) {
        logger.warn(`Gemini model ${modelName} not available — trying next in chain`);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
