export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const hasString = (obj: Record<string, unknown>, key: string) =>
  isString(obj[key]);

const hasArray = (obj: Record<string, unknown>, key: string) =>
  Array.isArray(obj[key]);

const pushError = (errors: string[], message: string) => {
  errors.push(message);
};

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && !Number.isNaN(value);

export const validateEvent = (payload: unknown): ValidationResult => {
  const errors: string[] = [];
  if (!isRecord(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }
  if (!hasString(payload, 'id')) pushError(errors, 'id is required');
  if (!hasString(payload, 'source')) pushError(errors, 'source is required');
  if (!hasString(payload, 'type')) pushError(errors, 'type is required');
  if (!hasString(payload, 'timestamp'))
    pushError(errors, 'timestamp is required');
  if (!hasString(payload, 'version')) pushError(errors, 'version is required');
  if (!isRecord(payload.data)) pushError(errors, 'data must be an object');
  if (hasString(payload, 'version')) {
    const version = payload.version as string;
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      pushError(errors, 'version must be semver');
    }
  }
  return { valid: errors.length === 0, errors };
};

export const validateReport = (payload: unknown): ValidationResult => {
  const errors: string[] = [];
  if (!isRecord(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }
  if (!isRecord(payload.runner)) {
    pushError(errors, 'runner is required');
  } else {
    if (!hasString(payload.runner, 'name')) {
      pushError(errors, 'runner.name is required');
    }
    if (!hasString(payload.runner, 'version')) {
      pushError(errors, 'runner.version is required');
    }
  }
  if (!hasString(payload, 'status')) pushError(errors, 'status is required');
  if (!hasString(payload, 'startedAt'))
    pushError(errors, 'startedAt is required');
  if (!hasString(payload, 'finishedAt'))
    pushError(errors, 'finishedAt is required');
  if (!hasString(payload, 'summary')) pushError(errors, 'summary is required');
  return { valid: errors.length === 0, errors };
};

export const validateRunnerManifest = (payload: unknown): ValidationResult => {
  const errors: string[] = [];
  if (!isRecord(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }
  if (!hasString(payload, 'name')) pushError(errors, 'name is required');
  if (!hasString(payload, 'version')) pushError(errors, 'version is required');
  if (!hasString(payload, 'description'))
    pushError(errors, 'description is required');
  if (!isRecord(payload.entrypoint)) {
    pushError(errors, 'entrypoint is required');
  } else {
    if (!hasString(payload.entrypoint, 'command')) {
      pushError(errors, 'entrypoint.command is required');
    }
    if (!hasArray(payload.entrypoint, 'args')) {
      pushError(errors, 'entrypoint.args must be an array');
    }
  }
  return { valid: errors.length === 0, errors };
};

export const validateCliSurface = (payload: unknown): ValidationResult => {
  const errors: string[] = [];
  if (!isRecord(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }
  if (!hasString(payload, 'name')) pushError(errors, 'name is required');
  if (!hasArray(payload, 'commands')) pushError(errors, 'commands is required');
  if (!isRecord(payload.exitCodes)) pushError(errors, 'exitCodes is required');
  return { valid: errors.length === 0, errors };
};

export const validateEvidencePacket = (payload: unknown): ValidationResult => {
  const errors: string[] = [];
  if (!isRecord(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }
  if (!hasString(payload, 'id')) pushError(errors, 'id is required');
  if (!hasString(payload, 'runner')) pushError(errors, 'runner is required');
  if (!hasString(payload, 'timestamp')) pushError(errors, 'timestamp is required');
  if (!hasString(payload, 'hash')) pushError(errors, 'hash is required');
  if (!hasArray(payload, 'items')) {
    pushError(errors, 'items must be an array');
  } else {
    const items = payload.items as unknown[];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!isRecord(item)) {
        pushError(errors, `items[${i}] must be an object`);
        continue;
      }
      if (!hasString(item, 'key')) pushError(errors, `items[${i}].key is required`);
      if (!hasString(item, 'source')) pushError(errors, `items[${i}].source is required`);
    }
  }
  if (payload.decision !== undefined && payload.decision !== null) {
    if (!isRecord(payload.decision)) {
      pushError(errors, 'decision must be an object');
    } else {
      if (!hasString(payload.decision, 'outcome')) pushError(errors, 'decision.outcome is required');
      if (!hasArray(payload.decision, 'reasons')) pushError(errors, 'decision.reasons must be an array');
      if (payload.decision.confidence !== undefined && !isNumber(payload.decision.confidence)) {
        pushError(errors, 'decision.confidence must be a number');
      }
    }
  }
  return { valid: errors.length === 0, errors };
};

export const validateModuleManifest = (payload: unknown): ValidationResult => {
  const errors: string[] = [];
  if (!isRecord(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }
  if (!hasString(payload, 'name')) pushError(errors, 'name is required');
  if (!hasString(payload, 'version')) pushError(errors, 'version is required');
  if (!hasString(payload, 'type')) pushError(errors, 'type is required');
  if (!hasString(payload, 'contractVersion')) pushError(errors, 'contractVersion is required');
  if (hasString(payload, 'type')) {
    const validTypes = ['runner', 'evaluator', 'connector', 'composite'];
    if (!validTypes.includes(payload.type as string)) {
      pushError(errors, `type must be one of: ${validTypes.join(', ')}`);
    }
  }
  if (hasString(payload, 'contractVersion')) {
    const cv = payload.contractVersion as string;
    if (!/^\d+\.\d+\.\d+$/.test(cv)) {
      pushError(errors, 'contractVersion must be semver');
    }
  }
  return { valid: errors.length === 0, errors };
};

export const validateAuditTrail = (payload: unknown): ValidationResult => {
  const errors: string[] = [];
  if (!isRecord(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }
  if (!hasString(payload, 'id')) pushError(errors, 'id is required');
  if (!hasString(payload, 'runner')) pushError(errors, 'runner is required');
  if (!hasString(payload, 'timestamp')) pushError(errors, 'timestamp is required');
  if (!hasArray(payload, 'entries')) {
    pushError(errors, 'entries must be an array');
  } else {
    const entries = payload.entries as unknown[];
    const validActions = ['create', 'read', 'update', 'delete', 'evaluate', 'approve', 'reject'];
    const validOutcomes = ['success', 'failure', 'denied', 'skipped'];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!isRecord(entry)) {
        pushError(errors, `entries[${i}] must be an object`);
        continue;
      }
      if (!hasString(entry, 'entryId')) pushError(errors, `entries[${i}].entryId is required`);
      if (!hasString(entry, 'action')) {
        pushError(errors, `entries[${i}].action is required`);
      } else if (!validActions.includes(entry.action as string)) {
        pushError(errors, `entries[${i}].action must be one of: ${validActions.join(', ')}`);
      }
      if (!hasString(entry, 'actor')) pushError(errors, `entries[${i}].actor is required`);
      if (!hasString(entry, 'timestamp')) pushError(errors, `entries[${i}].timestamp is required`);
      if (!hasString(entry, 'resource')) pushError(errors, `entries[${i}].resource is required`);
      if (hasString(entry, 'outcome') && !validOutcomes.includes(entry.outcome as string)) {
        pushError(errors, `entries[${i}].outcome must be one of: ${validOutcomes.join(', ')}`);
      }
    }
  }
  if (payload.summary !== undefined) {
    if (!isRecord(payload.summary)) {
      pushError(errors, 'summary must be an object');
    } else {
      if (payload.summary.totalEntries !== undefined && !isNumber(payload.summary.totalEntries)) {
        pushError(errors, 'summary.totalEntries must be a number');
      }
    }
  }
  return { valid: errors.length === 0, errors };
};
