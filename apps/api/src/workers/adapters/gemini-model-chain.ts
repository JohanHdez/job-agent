/**
 * Gemini model fallback chain.
 *
 * Tries models from newest to oldest. If a model returns 404 (not found /
 * not supported for this API version), automatically retries with the next
 * one. Non-404 errors (auth, rate limit, network) are re-thrown immediately
 * without cycling through remaining models.
 *
 * Usage:
 *   const text = await generateWithFallback(genAI, { systemInstruction }, prompt);
 */

import { GoogleGenerativeAI, type ModelParams, type RequestOptions } from '@google/generative-ai';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import chalk = require('chalk');

/**
 * Ordered list of models to try — newest first, most compatible last.
 * gemini-2.0-flash is attempted first but has limit=0 on many free-tier keys;
 * the fallback chain handles this automatically.
 */
export const GEMINI_MODEL_CHAIN = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const;

/**
 * Returns true when the error should trigger a model fallback:
 * - 404: model not found / not supported for this API version
 * - 429 with limit=0: model not available on this free-tier key at all
 *   (distinct from a temporary rate limit — limit:0 means permanent no access)
 */
function shouldTryNextModel(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  if (msg.includes('404') || msg.includes('is not found') || msg.includes('not supported for generateContent')) {
    return true;
  }
  // 429 with "limit: 0" means the model is permanently unavailable on this key
  if (msg.includes('429') && msg.includes('limit: 0')) {
    return true;
  }
  return false;
}

/**
 * Calls Gemini generateContent, automatically falling back through
 * GEMINI_MODEL_CHAIN on 404 or quota=0 errors until a model succeeds or all fail.
 *
 * @param genAI      - GoogleGenerativeAI instance (already holds the API key)
 * @param params     - Extra model params (e.g. systemInstruction) — model is injected per attempt
 * @param prompt     - User prompt string
 * @returns Response text from the first model that succeeds
 * @throws Last error if all models fail
 */
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

      // Log which model was actually used (only when not the first choice)
      if (modelName !== GEMINI_MODEL_CHAIN[0]) {
        process.stdout.write(chalk.yellow(`[gemini] Used fallback model: ${modelName}\n`));
      }

      return text;
    } catch (err: unknown) {
      lastError = err;
      if (shouldTryNextModel(err)) {
        process.stderr.write(
          chalk.yellow(`[gemini] Model ${modelName} not available — trying next in chain\n`)
        );
        continue;
      }
      // Other errors (auth, network, temporary 429): surface immediately
      throw err;
    }
  }

  throw lastError;
}
