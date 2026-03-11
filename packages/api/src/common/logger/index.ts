/**
 * Re-exports the shared structured logger from @job-agent/logger.
 *
 * All logger usage within packages/api should import from this module
 * (or directly from @job-agent/logger) to stay DRY.
 */
export { createLogger, requestContext, type RequestContext } from '@job-agent/logger';
