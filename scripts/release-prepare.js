#!/usr/bin/env node
/**
 * Release Preparation Script
 *
 * Prepares the repository for a new release by:
 * - Validating conventional commits
 * - Generating changelog preview
 * - Updating compatibility matrix
 * - Checking for breaking changes
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');

function exec(cmd, options = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: ROOT_DIR, ...options });
}

function getLastTag() {
  try {
    return exec('git describe --tags --abbrev=0').trim();
  } catch {
    return null;
  }
}

function getCommitsSince(tag) {
  const range = tag ? `${tag}..HEAD` : 'HEAD';
  const output = exec(`git log ${range} --pretty=format:"%H %s"`);
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, ...messageParts] = line.split(' ');
      return { hash, message: messageParts.join(' ') };
    });
}

function parseCommitType(message) {
  const match = message.match(
    /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?!?:/
  );
  if (!match) return { type: 'other', scope: null, breaking: false };

  const [, type, scope, breaking] = match;
  return {
    type,
    scope: scope ? scope.slice(1, -1) : null,
    breaking: !!breaking || message.includes('BREAKING CHANGE'),
  };
}

function generateChangelogPreview(commits) {
  const sections = {
    breaking: [],
    feat: [],
    fix: [],
    perf: [],
    docs: [],
    refactor: [],
    other: [],
  };

  for (const commit of commits) {
    const parsed = parseCommitType(commit.message);
    const section = parsed.breaking ? 'breaking' : sections[parsed.type] ? parsed.type : 'other';
    sections[section].push(commit);
  }

  const lines = [];

  if (sections.breaking.length > 0) {
    lines.push('### ⚠️ BREAKING CHANGES');
    for (const commit of sections.breaking) {
      lines.push(`- ${commit.message}`);
    }
    lines.push('');
  }

  if (sections.feat.length > 0) {
    lines.push('### Features');
    for (const commit of sections.feat) {
      lines.push(`- ${commit.message}`);
    }
    lines.push('');
  }

  if (sections.fix.length > 0) {
    lines.push('### Bug Fixes');
    for (const commit of sections.fix) {
      lines.push(`- ${commit.message}`);
    }
    lines.push('');
  }

  if (sections.perf.length > 0) {
    lines.push('### Performance');
    for (const commit of sections.perf) {
      lines.push(`- ${commit.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function getNextVersion(commits, currentVersion) {
  const hasBreaking = commits.some((c) => parseCommitType(c.message).breaking);
  const hasFeature = commits.some((c) => parseCommitType(c.message).type === 'feat');

  const [major, minor, patch] = currentVersion.split('.').map(Number);

  if (hasBreaking) {
    return `${major + 1}.0.0`;
  } else if (hasFeature) {
    return `${major}.${minor + 1}.0`;
  } else {
    return `${major}.${minor}.${patch + 1}`;
  }
}

function getContractVersion() {
  const contractsPackagePath = join(ROOT_DIR, 'packages', 'contracts', 'package.json');
  const contractsPackage = JSON.parse(readFileSync(contractsPackagePath, 'utf8'));
  return contractsPackage.version;
}

function main() {
  console.log('🔍 Analyzing repository for release...\n');

  const contractsVersion = getContractVersion();
  console.log(`📋 Current contract version: ${contractsVersion}`);

  const lastTag = getLastTag();
  console.log(`🏷️  Last release tag: ${lastTag || 'none'}`);

  const commits = getCommitsSince(lastTag);
  console.log(`📝 Commits since last release: ${commits.length}`);

  if (commits.length === 0) {
    console.log('\n⚠️  No new commits since last release');
    process.exit(1);
  }

  const nextVersion = getNextVersion(commits, contractsVersion);
  console.log(`\n📦 Predicted next version: ${nextVersion}`);

  const changelog = generateChangelogPreview(commits);

  console.log('\n=== Changelog Preview ===');
  console.log(changelog);

  console.log('\n=== Pre-Release Checklist ===');
  const hasBreaking = commits.some((c) => parseCommitType(c.message).breaking);
  const checklist = [
    { item: 'All tests pass', command: 'pnpm test', required: true },
    { item: 'Contract tests pass', command: 'pnpm run contract:validate', required: true },
    { item: 'Linting passes', command: 'pnpm run lint', required: true },
    { item: 'TypeScript compiles', command: 'pnpm run typecheck', required: true },
    { item: 'Compatibility matrix updated', command: 'pnpm run compat:generate', required: true },
    { item: 'E2E tests pass', command: 'pnpm run test:e2e', required: true },
    { item: 'Breaking changes documented', command: null, required: hasBreaking },
    {
      item: 'Migration guide written (if major)',
      command: null,
      required: nextVersion.endsWith('.0.0'),
    },
  ];

  for (const check of checklist) {
    const status = check.required ? '☐' : '☐ (optional)';
    console.log(`${status} ${check.item}`);
    if (check.command) {
      console.log(`    Run: ${check.command}`);
    }
  }

  console.log('\n=== Release Commands ===');
  console.log(`1. Update compatibility matrix:`);
  console.log(`   pnpm run compat:generate`);
  console.log(`\n2. Stage and commit changes:`);
  console.log(`   git add docs/COMPATIBILITY.md`);
  console.log(`   git commit -m \"chore: update compatibility matrix for v${nextVersion}\"`);
  console.log(`\n3. Trigger release:`);
  console.log(`   git push origin main`);
  console.log(`   # Release workflow will trigger automatically`);

  if (hasBreaking) {
    console.log('\n⚠️  WARNING: Breaking changes detected!');
    console.log('   - Ensure migration guide is complete');
    console.log('   - Announce deprecation in advance');
    console.log('   - Consider major version bump');
  }

  console.log('\n✅ Release preparation complete');
}

main();
