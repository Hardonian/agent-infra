import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type InvocationOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  redactEnvKeys?: string[];
};

export type InvocationResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
};

const redact = (text: string, env: NodeJS.ProcessEnv, keys: string[]) => {
  let redacted = text;
  for (const key of keys) {
    const value = env[key];
    if (!value) continue;
    redacted = redacted.split(value).join('***');
  }
  return redacted;
};

export const runEntrypoint = async (
  command: string,
  args: string[],
  options: InvocationOptions = {}
): Promise<InvocationResult> => {
  const env = { ...process.env, ...options.env };
  const redactKeys = options.redactEnvKeys ?? [];
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env,
      shell: false
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    let timeoutId: NodeJS.Timeout | undefined;
    if (options.timeoutMs) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
      }, options.timeoutMs);
    }

    child.on('error', (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(error);
    });

    child.on('close', (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      const durationMs = Date.now() - start;
      resolve({
        stdout: redact(stdout, env, redactKeys),
        stderr: redact(stderr, env, redactKeys),
        exitCode: code ?? 1,
        durationMs
      });
    });
  });
};

export const readJsonFile = (filePath: string) => {
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as unknown;
};

export const ensureAbsolutePath = (value: string, cwd: string) =>
  path.isAbsolute(value) ? value : path.join(cwd, value);
