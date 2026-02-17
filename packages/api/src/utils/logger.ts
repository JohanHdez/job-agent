import winston from 'winston';
import chalk from 'chalk';

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      const ts = String(timestamp);
      switch (level) {
        case 'info': return `${chalk.gray(ts)} ${chalk.blue('[API INFO]')} ${String(message)}`;
        case 'warn': return `${chalk.gray(ts)} ${chalk.yellow('[API WARN]')} ${String(message)}`;
        case 'error': return `${chalk.gray(ts)} ${chalk.red('[API ERROR]')} ${String(message)}`;
        default: return `${chalk.gray(ts)} [${level.toUpperCase()}] ${String(message)}`;
      }
    })
  ),
  transports: [new winston.transports.Console()],
});
