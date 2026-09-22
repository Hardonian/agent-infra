import { createLogger, LoggerOptions, type Logger } from './logger.js';
import { MetricsCollector, METRIC_NAMES } from './metrics.js';
import { CorrelationManager } from './correlation.js';

export interface ObservabilityOptions {
  service: string;
  version: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  prettyPrint?: boolean;
}

type RequestLike = {
  method: string;
  path: string;
  headers: Record<string, string | string[]>;
  route?: { path?: string };
  correlationId?: string;
  logger?: Logger;
  metrics?: MetricsCollector;
  [key: string]: unknown;
};

type ResponseLike = {
  statusCode: number;
  on: (event: 'finish', listener: () => void) => void;
};

type NextFunctionLike = () => void;

export function observabilityMiddleware(options: ObservabilityOptions) {
  const logger = createLogger({
    service: options.service,
    version: options.version,
    level: options.logLevel,
    prettyPrint: options.prettyPrint,
  });

  const metrics = new MetricsCollector();
  const correlation = new CorrelationManager();

  return (req: RequestLike, res: ResponseLike, next: NextFunctionLike) => {
    // Extract or generate correlation ID
    const headers = req.headers;
    const existingContext = correlation.extractHeaders(headers);

    const runWithCorrelation = existingContext
      ? (fn: () => void) => correlation.runWithContext(existingContext, fn)
      : (fn: () => void) => correlation.runWithNew(fn);

    runWithCorrelation(() => {
      // Attach to request
      req.correlationId = correlation.getId();
      req.logger = logger.child({
        correlationId: correlation.getId(),
      });
      req.metrics = metrics;

      // Log request
      const startTime = Date.now();

      logger.info('Request started', {
        method: req.method,
        path: req.path,
        correlationId: correlation.getId(),
      });

      // Capture response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const status = res.statusCode;

        logger.info('Request completed', {
          method: req.method,
          path: req.path,
          status,
          duration,
          correlationId: correlation.getId(),
        });

        // Track metrics
        metrics.increment('http_requests_total', {
          method: req.method,
          status: status.toString(),
          path: req.route?.path || req.path,
        });

        metrics.observe('http_request_duration_seconds', duration / 1000, {
          method: req.method,
          path: req.route?.path || req.path,
        });
      });

      next();
    });
  };
}

export { createLogger, MetricsCollector, CorrelationManager, METRIC_NAMES };
export type { LoggerOptions };
