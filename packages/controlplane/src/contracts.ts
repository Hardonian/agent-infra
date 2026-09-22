/**
 * Shared runner contract types.
 *
 * Defines the canonical input/output shapes that every runner must satisfy.
 * These types are enforced at the ControlPlane boundary — both before dispatch
 * and after execution — so that misconfigured runners fail fast with
 * actionable diagnostics rather than producing silent garbage.
 */

// ── Runner Input ───────────────────────────────────────────────────────

export type RunnerInput = {
  requestId: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0;

export type InputValidationResult = {
  valid: boolean;
  errors: string[];
  coerced?: RunnerInput;
};

/**
 * Validate that an unknown value conforms to the RunnerInput contract.
 * Returns the coerced value on success so callers can use it directly.
 */
export const validateRunnerInput = (value: unknown): InputValidationResult => {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { valid: false, errors: ['input must be a JSON object'] };
  }

  if (!isNonEmptyString(value.requestId)) {
    errors.push('input.requestId is required (non-empty string)');
  }

  if (!isNonEmptyString(value.timestamp)) {
    errors.push('input.timestamp is required (non-empty string)');
  } else {
    const ts = Date.parse(value.timestamp as string);
    if (Number.isNaN(ts)) {
      errors.push('input.timestamp must be a valid ISO-8601 date string');
    }
  }

  if (!isRecord(value.payload)) {
    errors.push('input.payload is required (object)');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    coerced: value as RunnerInput,
  };
};

// ── Runner Output (Report) ─────────────────────────────────────────────

export type ReportStatus = 'success' | 'failed' | 'degraded';

export type RunnerReport = {
  runner: { name: string; version: string };
  status: ReportStatus;
  startedAt: string;
  finishedAt: string;
  summary: string;
  metrics?: { durationMs: number };
  artifacts?: Array<{ name: string; path: string; mediaType?: string }>;
  errors?: Array<{ code: string; message: string }>;
  data?: Record<string, unknown>;
};

// ── Evidence Packet ────────────────────────────────────────────────────

export type EvidenceItem = {
  key: string;
  value: unknown;
  source: string;
  redacted?: boolean;
  hashValue?: string;
};

export type EvidenceDecision = {
  outcome: 'pass' | 'fail' | 'uncertain' | 'skip';
  reasons: Array<{ ruleId: string; message: string; evidenceRefs?: string[] }>;
  confidence?: number;
};

export type EvidencePacket = {
  id: string;
  runner: string;
  timestamp: string;
  hash: string;
  contractVersion: string;
  items: EvidenceItem[];
  decision?: EvidenceDecision | null;
  metadata?: {
    durationMs?: number;
    retryCount?: number;
    correlationId?: string;
  };
};

// ── Execution Result ───────────────────────────────────────────────────

export type ExecutionResult = {
  runner: string;
  report: RunnerReport;
  evidence: EvidencePacket | null;
  reportValid: boolean;
  evidenceValid: boolean;
  durationMs: number;
};
