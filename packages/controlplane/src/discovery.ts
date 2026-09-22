/**
 * Sibling repository discovery.
 *
 * Detects the presence of truthcore / JobForge / *-autopilot repos either as:
 *   1. Sibling directories (../<name>)
 *   2. Cached clones (.cache/repos/<name>)
 *   3. Runner adapters within this repo (runners/<name>)
 *
 * Reads a standardised manifest from each if available.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);

export type SiblingManifest = {
  name: string;
  version: string;
  type?: string;
  contractVersion?: string;
  entrypoint?: { command: string; args: string[] };
  capabilities?: string[];
  [key: string]: unknown;
};

export type SiblingRepo = {
  name: string;
  /** Where we found it: 'sibling' | 'cache' | 'runner-adapter' */
  source: 'sibling' | 'cache' | 'runner-adapter';
  path: string;
  manifest: SiblingManifest | null;
  hasDoctorCommand: boolean;
  hasPackageJson: boolean;
};

const KNOWN_SIBLINGS = [
  'truthcore',
  'jobforge',
  'autopilot-suite',
  'finops-autopilot',
  'ops-autopilot',
  'growth-autopilot',
  'support-autopilot',
  'aias',
];

/** Manifest file names we search for, in priority order. */
const MANIFEST_NAMES = [
  'module.manifest.json',
  'runner.manifest.json',
  'manifest.json',
];

const tryReadJson = (filePath: string): unknown | null => {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
};

const readManifest = (dir: string): SiblingManifest | null => {
  for (const name of MANIFEST_NAMES) {
    const data = tryReadJson(path.join(dir, name));
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const rec = data as Record<string, unknown>;
      if (typeof rec.name === 'string' && typeof rec.version === 'string') {
        return data as SiblingManifest;
      }
    }
  }
  return null;
};

const hasDoctorScript = (dir: string): boolean => {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = tryReadJson(pkgPath) as Record<string, unknown> | null;
  if (!pkg) return false;
  const scripts = pkg.scripts as Record<string, unknown> | undefined;
  return !!scripts && typeof scripts.doctor === 'string';
};

const hasPackageJson = (dir: string): boolean => {
  return existsSync(path.join(dir, 'package.json'));
};

/**
 * Discover all known sibling repos in three locations.
 */
export const discoverSiblings = (): SiblingRepo[] => {
  const found: SiblingRepo[] = [];
  const seen = new Set<string>();

  // 1. True sibling directories (../<name>)
  const parentDir = path.dirname(repoRoot);
  for (const name of KNOWN_SIBLINGS) {
    const siblingPath = path.join(parentDir, name);
    if (existsSync(siblingPath)) {
      seen.add(name);
      found.push({
        name,
        source: 'sibling',
        path: siblingPath,
        manifest: readManifest(siblingPath),
        hasDoctorCommand: hasDoctorScript(siblingPath),
        hasPackageJson: hasPackageJson(siblingPath),
      });
    }
  }

  // 2. Cached clones (.cache/repos/<name>)
  const cachePath = path.join(repoRoot, '.cache', 'repos');
  if (existsSync(cachePath)) {
    try {
      for (const entry of readdirSync(cachePath)) {
        if (seen.has(entry)) continue;
        const entryPath = path.join(cachePath, entry);
        if (existsSync(entryPath)) {
          seen.add(entry);
          found.push({
            name: entry,
            source: 'cache',
            path: entryPath,
            manifest: readManifest(entryPath),
            hasDoctorCommand: hasDoctorScript(entryPath),
            hasPackageJson: hasPackageJson(entryPath),
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Runner adapter manifests (runners/<name>)
  const runnersDir = path.join(repoRoot, 'runners');
  if (existsSync(runnersDir)) {
    try {
      for (const entry of readdirSync(runnersDir)) {
        if (seen.has(entry)) continue;
        const runnerPath = path.join(runnersDir, entry);
        const manifest = readManifest(runnerPath);
        if (manifest) {
          seen.add(entry);
          found.push({
            name: entry,
            source: 'runner-adapter',
            path: runnerPath,
            manifest,
            hasDoctorCommand: false,
            hasPackageJson: false,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return found;
};

/**
 * Return the list of known siblings that were NOT found anywhere.
 */
export const findMissingSiblings = (): string[] => {
  const found = new Set(discoverSiblings().map((s) => s.name));
  return KNOWN_SIBLINGS.filter((name) => !found.has(name));
};
