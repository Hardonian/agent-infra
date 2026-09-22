/**
 * Typed, actionable errors for ControlPlane CLI.
 * Every error carries a code, a human message, and a "what to do next" hint.
 */

export type ErrorCode =
  | 'RUNNER_NOT_FOUND'
  | 'MANIFEST_INVALID'
  | 'CONTRACT_VERSION_MISMATCH'
  | 'MISSING_DEPENDENCY'
  | 'MISSING_REPO'
  | 'MISSING_ENV'
  | 'INVOCATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'SCHEMA_MISSING'
  | 'BUILD_MISSING'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class ControlPlaneError extends Error {
  readonly code: ErrorCode;
  readonly hint: string;

  constructor(code: ErrorCode, message: string, hint: string) {
    super(message);
    this.name = 'ControlPlaneError';
    this.code = code;
    this.hint = hint;
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      hint: this.hint,
    };
  }
}

export const Errors = {
  runnerNotFound(name: string) {
    return new ControlPlaneError(
      'RUNNER_NOT_FOUND',
      `Runner "${name}" was not found in any manifest directory.`,
      `Ensure a runner.manifest.json for "${name}" exists under runners/ or .cache/repos/.`
    );
  },

  manifestInvalid(path: string, reasons: string[]) {
    return new ControlPlaneError(
      'MANIFEST_INVALID',
      `Invalid runner manifest at ${path}: ${reasons.join(', ')}`,
      'Fix the manifest to include all required fields: name, version, description, entrypoint.command, entrypoint.args.'
    );
  },

  contractVersionMismatch(runner: string, expected: string, actual: string) {
    return new ControlPlaneError(
      'CONTRACT_VERSION_MISMATCH',
      `Runner "${runner}" targets contract version ${actual} but ControlPlane expects ${expected}.`,
      `Update the runner or ControlPlane contracts to a compatible version. See docs/COMPATIBILITY.md.`
    );
  },

  missingDependency(dep: string) {
    return new ControlPlaneError(
      'MISSING_DEPENDENCY',
      `Required dependency "${dep}" is not available.`,
      `Run "pnpm install" or ensure "${dep}" is installed globally.`
    );
  },

  missingRepo(repo: string) {
    return new ControlPlaneError(
      'MISSING_REPO',
      `Sibling repository "${repo}" was not detected.`,
      `Clone "${repo}" as a sibling directory or set CONTROLPLANE_OFFLINE=1 to skip sibling checks.`
    );
  },

  missingEnv(key: string) {
    return new ControlPlaneError(
      'MISSING_ENV',
      `Required environment variable "${key}" is not set.`,
      `Export ${key} in your shell or .env file.`
    );
  },

  invocationFailed(runner: string, exitCode: number, stderr: string) {
    const snippet = stderr.length > 200 ? stderr.slice(0, 200) + '...' : stderr;
    return new ControlPlaneError(
      'INVOCATION_FAILED',
      `Runner "${runner}" exited with code ${exitCode}. ${snippet}`,
      `Check the runner's logs and ensure its dependencies are installed. Run "controlplane doctor" for diagnostics.`
    );
  },

  validationFailed(entity: string, errors: string[]) {
    return new ControlPlaneError(
      'VALIDATION_FAILED',
      `Validation failed for ${entity}: ${errors.join(', ')}`,
      'Check the output against the contract schema. Run "pnpm contract:validate" for details.'
    );
  },

  schemaMissing(schemaFile: string) {
    return new ControlPlaneError(
      'SCHEMA_MISSING',
      `Contract schema file "${schemaFile}" is missing.`,
      'Run "pnpm run build:contracts" or "pnpm run contract:sync:fix" to regenerate schemas.'
    );
  },

  buildMissing(target: string) {
    return new ControlPlaneError(
      'BUILD_MISSING',
      `Build artifact "${target}" is missing.`,
      'Run "pnpm run build" to compile all packages.'
    );
  },

  timeout(runner: string, ms: number) {
    return new ControlPlaneError(
      'TIMEOUT',
      `Runner "${runner}" exceeded the ${ms}ms timeout.`,
      'Increase the timeout or investigate why the runner is slow. Check "controlplane doctor" output.'
    );
  },
} as const;

/**
 * Format a ControlPlaneError (or any error) as structured JSON for CLI output.
 */
export const formatError = (err: unknown): string => {
  if (err instanceof ControlPlaneError) {
    return JSON.stringify(err.toJSON(), null, 2);
  }
  if (err instanceof Error) {
    return JSON.stringify(
      {
        error: 'UNKNOWN',
        message: err.message,
        hint: 'Run "controlplane doctor" for diagnostics.',
      },
      null,
      2
    );
  }
  return JSON.stringify(
    {
      error: 'UNKNOWN',
      message: String(err),
      hint: 'Run "controlplane doctor" for diagnostics.',
    },
    null,
    2
  );
};
