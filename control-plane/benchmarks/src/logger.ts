import pino from 'pino';
import { config } from './config.js';

/**
 * Pino logger instance for benchmarks.
 * Consistent logging format across all benchmark runs.
 */
export const logger = pino({
  level: config.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
    },
  },
  base: {
    benchmark: true,
  },
});

/**
 * Create a child logger for a specific scenario.
 */
export function createScenarioLogger(scenarioId: string, iteration: number) {
  return logger.child({
    scenario: scenarioId,
    iteration,
  });
}
