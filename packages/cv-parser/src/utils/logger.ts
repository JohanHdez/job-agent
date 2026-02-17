import winston from 'winston';
import chalk from 'chalk';

/**
 * Shared logger for the cv-parser package.
 * Uses chalk for colored console output and winston for file logging.
 */
export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      const ts = String(timestamp);
      switch (level) {
        case 'info':
          return `${chalk.gray(ts)} ${chalk.blue('[INFO]')} ${String(message)}`;
        case 'warn':
          return `${chalk.gray(ts)} ${chalk.yellow('[WARN]')} ${String(message)}`;
        case 'error':
          return `${chalk.gray(ts)} ${chalk.red('[ERROR]')} ${String(message)}`;
        case 'debug':
          return `${chalk.gray(ts)} ${chalk.magenta('[DEBUG]')} ${String(message)}`;
        default:
          return `${chalk.gray(ts)} [${level.toUpperCase()}] ${String(message)}`;
      }
    })
  ),
  transports: [new winston.transports.Console()],
});
