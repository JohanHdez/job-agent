import winston from 'winston';
import chalk from 'chalk';

/**
 * Shared logger for the linkedin-mcp package.
 */
export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      const ts = String(timestamp);
      switch (level) {
        case 'info':
          return `${chalk.gray(ts)} ${chalk.blue('[MCP INFO]')} ${String(message)}`;
        case 'warn':
          return `${chalk.gray(ts)} ${chalk.yellow('[MCP WARN]')} ${String(message)}`;
        case 'error':
          return `${chalk.gray(ts)} ${chalk.red('[MCP ERROR]')} ${String(message)}`;
        case 'debug':
          return `${chalk.gray(ts)} ${chalk.magenta('[MCP DEBUG]')} ${String(message)}`;
        default:
          return `${chalk.gray(ts)} [${level.toUpperCase()}] ${String(message)}`;
      }
    })
  ),
  transports: [new winston.transports.Console()],
});
