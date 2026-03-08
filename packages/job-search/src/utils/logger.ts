import winston from 'winston';
import chalk from 'chalk';

/**
 * Shared logger for the job-search package.
 */
export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      const ts = String(timestamp);
      switch (level) {
        case 'info':
          return `${chalk.gray(ts)} ${chalk.blue('[SEARCH INFO]')} ${String(message)}`;
        case 'warn':
          return `${chalk.gray(ts)} ${chalk.yellow('[SEARCH WARN]')} ${String(message)}`;
        case 'error':
          return `${chalk.gray(ts)} ${chalk.red('[SEARCH ERROR]')} ${String(message)}`;
        case 'debug':
          return `${chalk.gray(ts)} ${chalk.magenta('[SEARCH DEBUG]')} ${String(message)}`;
        default:
          return `${chalk.gray(ts)} [${level.toUpperCase()}] ${String(message)}`;
      }
    })
  ),
  transports: [new winston.transports.Console()],
});
