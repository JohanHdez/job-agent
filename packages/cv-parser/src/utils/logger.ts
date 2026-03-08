import winston from 'winston';
import chalk from 'chalk';

const LEVEL_COLORS: Record<string, (s: string) => string> = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.blue,
  debug: chalk.magenta,
};

const SERVICE = 'cv-parser';

/** Structured logger for the cv-parser package. */
export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.printf(({ level, message, timestamp }) => {
      const ts  = chalk.gray(String(timestamp));
      const svc = chalk.cyan(`[${SERVICE}]`);
      const lvl = (LEVEL_COLORS[level] ?? chalk.white)(level.toUpperCase());
      return `${ts} ${svc} ${lvl} ${String(message)}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});
