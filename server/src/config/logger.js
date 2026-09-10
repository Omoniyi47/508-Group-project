import winston from 'winston';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

const logsDir = path.resolve('logs');
if (!env.isTest && !fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) => `${ts} [${level}]: ${stack || message}`)
);

const transports = [];

if (!env.isTest) {
  transports.push(new winston.transports.Console({ format: consoleFormat }));
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: combine(timestamp(), errors({ stack: true }), json()),
    })
  );
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: combine(timestamp(), errors({ stack: true }), json()),
    })
  );
} else {
  transports.push(new winston.transports.Console({ silent: true }));
}

export const logger = winston.createLogger({
  level: env.logLevel,
  transports,
});

export const httpLogStream = {
  write: (message) => logger.info(message.trim()),
};
