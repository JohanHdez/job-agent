import winston from 'winston';
import chalk from 'chalk';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp }) => {
      const ts  = chalk.gray(`[${String(timestamp)}]`);
      const msg = String(message);
      switch (level) {
        case 'error': return `${ts} ${chalk.red(msg)}`;
        case 'warn':  return `${ts} ${chalk.yellow(msg)}`;
        default:      return `${ts} ${chalk.blue(msg)}`;
      }
    }),
  ),
  transports: [new winston.transports.Console()],
});
