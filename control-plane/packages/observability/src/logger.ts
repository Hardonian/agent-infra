import pino from 'pino';
import { ErrorEnvelope, ErrorCategory } from '@controlplane/contracts';

export interface LoggerOptions {
  service: string;
  version: string;
  correlationId?: string;
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  prettyPrint?: boolean;
}

export interface LogContext {
  [key: string]: unknown;
}

export interface ErrorLogContext {
  code: string;
  category: ErrorCategory;
  message: string;
  stack?: string;
  details?: Record<string, unknown>;
}

export function createLogger(options: LoggerOptions) {
  const { service, version, correlationId, level = 'info', prettyPrint = false } = options;

  const logger = pino({
    level,
    transport: prettyPrint ? { target: 'pino-pretty' } : undefined,
    base: {
      service,
      version,
      correlationId,
    },
  });

  return {
    debug: (message: string, context?: LogContext) => {
      logger.debug({ ...context }, message);
    },

    info: (message: string, context?: LogContext) => {
      logger.info({ ...context }, message);
    },

    warn: (message: string, context?: LogContext) => {
      logger.warn({ ...context }, message);
    },

    error: (message: string, context?: LogContext) => {
      logger.error({ ...context }, message);
    },

    fatal: (message: string, context?: LogContext) => {
      logger.fatal({ ...context }, message);
    },

    errorContract: (error: typeof ErrorEnvelope._type, context?: LogContext) => {
      logger.error(
        {
          error: {
            code: error.code,
            category: error.category,
            message: error.message,
            details: error.details,
          },
          ...context,
        },
        `Contract error: ${error.code}`
      );
    },

    child: (bindings: LogContext) => {
      return createLogger({
        service,
        version,
        correlationId: correlationId || (bindings.correlationId as string),
        level,
        prettyPrint,
      });
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
