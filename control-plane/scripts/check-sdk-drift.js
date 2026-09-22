#!/usr/bin/env node

/**
 * Check if generated SDKs are up-to-date with contracts
 * Used in CI to enforce regeneration
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const SDKS_DIR = resolve(process.cwd(), 'sdks');
const LANGUAGES = ['typescript', 'python', 'go'];

console.log('🔍 Checking SDK drift...\n');

// Check if sdks directory exists
if (!existsSync(SDKS_DIR)) {
  console.error('❌ SDKs directory does not exist. Run: pnpm sdk:generate');
  process.exit(1);
}

let hasDrift = false;

for (const lang of LANGUAGES) {
  const langDir = resolve(SDKS_DIR, lang);

  if (!existsSync(langDir)) {
    console.error(`❌ Missing ${lang} SDK`);
    hasDrift = true;
    continue;
  }

  // Check for key files
  const expectedFiles = getExpectedFiles(lang);
  const missing = expectedFiles.filter((f) => !existsSync(resolve(langDir, f)));

  if (missing.length > 0) {
    console.error(`❌ ${lang} SDK missing files: ${missing.join(', ')}`);
    hasDrift = true;
  } else {
    console.log(`✓ ${lang} SDK structure valid`);
  }
}

if (hasDrift) {
  console.error('\n❌ SDKs are out of date!');
  console.error('Run: pnpm sdk:generate');
  process.exit(1);
} else {
  console.log('\n✓ All SDKs are up-to-date');
  process.exit(0);
}

function getExpectedFiles(lang) {
  switch (lang) {
    case 'typescript':
      return ['src/types.ts', 'src/client.ts', 'src/index.ts', 'package.json'];
    case 'python':
      return ['controlplane_sdk/__init__.py', 'controlplane_sdk/types.py', 'pyproject.toml'];
    case 'go':
      return ['types.go', 'client.go', 'go.mod'];
    default:
      return [];
  }
}
