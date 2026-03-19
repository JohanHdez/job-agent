import { createLogger } from '../common/logger/index.js';

/** Structured logger for the API package. Includes correlationId per request. */
export const logger = createLogger('api');
