import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRunnerManifest } from '@controlplane/contract-kit';

export type RunnerEntrypoint = {
  command: string;
  args: string[];
};

export type RunnerManifest = {
  name: string;
  version: string;
  description: string;
  entrypoint: RunnerEntrypoint;
  capabilities?: string[];
  requiredEnv?: string[];
  outputs?: string[];
  docs?: string;
};

export type RunnerRecord = RunnerManifest & {
  source: string;
  loadStrategy: 'workspace' | 'installed' | 'fallback';
};

export type ModuleType = 'runner' | 'connector' | 'truth-rule';

export type ModuleRecord = {
  name: string;
  type: ModuleType;
  version: string;
  description: string;
  capabilities?: string[];
  entrypoint?: RunnerEntrypoint;
  requiredEnv?: string[];
  outputs?: string[];
  docs?: string;
  source: string;
  loadStrategy: 'workspace' | 'installed' | 'fallback';
  available: boolean;
  error?: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

const runnerRoots = [path.join(repoRoot, 'runners'), path.join(repoRoot, '.cache', 'repos')];

const readJson = (filePath: string) => {
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as unknown;
};

const isManifestFile = (filePath: string) => filePath.endsWith('runner.manifest.json');

const collectManifestFiles = () => {
  const manifests: string[] = [];
  for (const root of runnerRoots) {
    try {
      const entries = readdirSync(root);
      for (const entry of entries) {
        const fullPath = path.join(root, entry);
        if (statSync(fullPath).isDirectory()) {
          const manifestPath = path.join(fullPath, 'runner.manifest.json');
          if (statSync(manifestPath, { throwIfNoEntry: false })) {
            manifests.push(manifestPath);
          }
        } else if (isManifestFile(fullPath)) {
          manifests.push(fullPath);
        }
      }
    } catch {
      continue;
    }
  }
  return manifests;
};

const parseManifest = (filePath: string): RunnerRecord => {
  const payload = readJson(filePath);
  const result = validateRunnerManifest(payload);
  if (!result.valid) {
    throw new Error(`Invalid runner manifest at ${filePath}: ${result.errors.join(', ')}`);
  }
  return {
    ...(payload as RunnerManifest),
    source: filePath,
    loadStrategy: 'fallback' as const,
  };
};

const tryLoadWorkspaceModule = (name: string): ModuleRecord | null => {
  // Check if it's a workspace package
  const pkgPath = path.join(repoRoot, 'packages', name, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = readJson(pkgPath) as {
        name?: string;
        version?: string;
        description?: string;
        bin?: string;
      };
      const manifestPath = path.join(repoRoot, 'packages', name, 'runner.manifest.json');
      let manifest: RunnerManifest | null = null;
      if (existsSync(manifestPath)) {
        manifest = readJson(manifestPath) as RunnerManifest;
      }

      return {
        name,
        type: 'runner',
        version: pkg.version || '0.0.0',
        description: pkg.description || manifest?.description || `${name} runner`,
        capabilities: manifest?.capabilities || ['adapter'],
        entrypoint: manifest?.entrypoint || {
          command: 'node',
          args: ['dist/index.js'],
        },
        requiredEnv: manifest?.requiredEnv || [],
        outputs: manifest?.outputs || ['report'],
        docs: manifest?.docs,
        source: path.join(repoRoot, 'packages', name),
        loadStrategy: 'workspace',
        available: true,
      };
    } catch (error) {
      return {
        name,
        type: 'runner',
        version: '0.0.0',
        description: `${name} runner (workspace load failed)`,
        source: path.join(repoRoot, 'packages', name),
        loadStrategy: 'workspace',
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  return null;
};

const tryLoadInstalledPackage = (name: string): ModuleRecord | null => {
  // Check if it's an installed package
  const nodeModulesPath = path.join(repoRoot, 'node_modules', name, 'package.json');
  if (existsSync(nodeModulesPath)) {
    try {
      const pkg = readJson(nodeModulesPath) as {
        name?: string;
        version?: string;
        description?: string;
        bin?: string;
      };
      const manifestPath = path.join(repoRoot, 'node_modules', name, 'runner.manifest.json');
      let manifest: RunnerManifest | null = null;
      if (existsSync(manifestPath)) {
        manifest = readJson(manifestPath) as RunnerManifest;
      }

      return {
        name,
        type: 'runner',
        version: pkg.version || '0.0.0',
        description: pkg.description || manifest?.description || `${name} runner`,
        capabilities: manifest?.capabilities || ['adapter'],
        entrypoint: manifest?.entrypoint || {
          command: pkg.bin || 'node',
          args: ['dist/index.js'],
        },
        requiredEnv: manifest?.requiredEnv || [],
        outputs: manifest?.outputs || ['report'],
        docs: manifest?.docs,
        source: path.join(repoRoot, 'node_modules', name),
        loadStrategy: 'installed',
        available: true,
      };
    } catch (error) {
      return {
        name,
        type: 'runner',
        version: '0.0.0',
        description: `${name} runner (installed package load failed)`,
        source: path.join(repoRoot, 'node_modules', name),
        loadStrategy: 'installed',
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  return null;
};

export const listRunners = (): RunnerRecord[] => {
  const manifests = collectManifestFiles();
  return manifests.map(parseManifest);
};

export const listModules = (): ModuleRecord[] => {
  const modules: ModuleRecord[] = [];

  // Add workspace modules
  const workspacePackages = path.join(repoRoot, 'packages');
  if (existsSync(workspacePackages)) {
    try {
      const entries = readdirSync(workspacePackages);
      for (const entry of entries) {
        const pkgPath = path.join(workspacePackages, entry, 'package.json');
        if (existsSync(pkgPath)) {
          const pkg = readJson(pkgPath) as { name?: string };
          if (
            pkg.name?.startsWith('@controlplane/') ||
            pkg.name?.includes('runner') ||
            pkg.name?.includes('connector')
          ) {
            const module = tryLoadWorkspaceModule(entry);
            if (module) modules.push(module);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Add installed packages
  const nodeModules = path.join(repoRoot, 'node_modules');
  if (existsSync(nodeModules)) {
    try {
      const entries = readdirSync(nodeModules);
      for (const entry of entries) {
        if (
          entry.startsWith('@controlplane/') ||
          entry.includes('runner') ||
          entry.includes('connector')
        ) {
          const module = tryLoadInstalledPackage(entry);
          if (module) modules.push(module);
        }
      }
    } catch {
      // ignore
    }
  }

  // Add fallback runners from manifests
  const fallbackRunners = listRunners().map((runner) => ({
    name: runner.name,
    type: 'runner' as ModuleType,
    version: runner.version,
    description: runner.description,
    capabilities: runner.capabilities,
    entrypoint: runner.entrypoint,
    requiredEnv: runner.requiredEnv,
    outputs: runner.outputs,
    docs: runner.docs,
    source: runner.source,
    loadStrategy: 'fallback' as const,
    available: true,
  }));

  // Merge, preferring workspace > installed > fallback
  const merged = new Map<string, ModuleRecord>();

  for (const module of [...modules, ...fallbackRunners]) {
    const existing = merged.get(module.name);
    if (
      !existing ||
      (module.loadStrategy === 'workspace' && existing.loadStrategy !== 'workspace') ||
      (module.loadStrategy === 'installed' && existing.loadStrategy === 'fallback')
    ) {
      merged.set(module.name, module);
    }
  }

  return Array.from(merged.values());
};

export const resolveRunner = (name: string, versionRange?: string): RunnerRecord => {
  const runners = listRunners().filter((runner) => runner.name === name);
  if (runners.length === 0) {
    throw new Error(`Runner not found: ${name}`);
  }
  if (!versionRange) return runners[0];
  const exact = runners.find((runner) => runner.version === versionRange);
  if (!exact) {
    throw new Error(`Runner ${name} does not satisfy ${versionRange}`);
  }
  return exact;
};

export const resolveModule = (name: string, type: ModuleType = 'runner'): ModuleRecord => {
  const modules = listModules().filter((module) => module.name === name && module.type === type);
  if (modules.length === 0) {
    throw new Error(`Module not found: ${name} (${type})`);
  }
  return modules[0];
};
