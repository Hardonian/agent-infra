import { AsyncLocalStorage } from 'async_hooks';

export interface CorrelationContext {
  correlationId: string;
  causationId?: string;
  traceId?: string;
  spanId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

export function generateId(): string {
  return crypto.randomUUID();
}

export class CorrelationManager {
  getContext(): CorrelationContext | undefined {
    return asyncLocalStorage.getStore();
  }

  getId(): string | undefined {
    return this.getContext()?.correlationId;
  }

  getTraceId(): string | undefined {
    return this.getContext()?.traceId;
  }

  getSpanId(): string | undefined {
    return this.getContext()?.spanId;
  }

  runWithNew<T>(fn: () => T): T {
    const context: CorrelationContext = {
      correlationId: generateId(),
      traceId: generateId(),
      spanId: generateId(),
    };

    return asyncLocalStorage.run(context, fn);
  }

  runWithId<T>(correlationId: string, fn: () => T): T {
    const context: CorrelationContext = {
      correlationId,
      traceId: this.getTraceId() || generateId(),
      spanId: generateId(),
    };

    return asyncLocalStorage.run(context, fn);
  }

  runWithContext<T>(context: CorrelationContext, fn: () => T): T {
    return asyncLocalStorage.run(context, fn);
  }

  propagateHeaders(): Record<string, string> {
    const context = this.getContext();
    if (!context) {
      return {};
    }

    const headers: Record<string, string> = {
      'X-Correlation-Id': context.correlationId,
    };

    if (context.causationId) {
      headers['X-Causation-Id'] = context.causationId;
    }

    if (context.traceId) {
      headers['X-Trace-Id'] = context.traceId;
    }

    if (context.spanId) {
      headers['X-Span-Id'] = context.spanId;
    }

    return headers;
  }

  extractHeaders(headers: Record<string, string | string[]>): CorrelationContext | undefined {
    const getHeader = (name: string): string | undefined => {
      const value = headers[name.toLowerCase()] || headers[name];
      return Array.isArray(value) ? value[0] : value;
    };

    const correlationId = getHeader('X-Correlation-Id') || getHeader('x-correlation-id');

    if (!correlationId) {
      return undefined;
    }

    return {
      correlationId,
      causationId: getHeader('X-Causation-Id') || getHeader('x-causation-id'),
      traceId: getHeader('X-Trace-Id') || getHeader('x-trace-id'),
      spanId: getHeader('X-Span-Id') || getHeader('x-span-id'),
    };
  }
}

// Singleton instance for convenience
export const correlation = new CorrelationManager();
