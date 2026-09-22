#!/usr/bin/env node
import { rmSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = path.join(repoRoot, 'demo');
const templatePath = path.join(demoDir, 'demo-input.json');
const inputPath = path.join(demoDir, 'input.json');

if (!existsSync(templatePath)) {
  console.error(`Missing demo template: ${templatePath}`);
  process.exit(1);
}

rmSync(path.join(demoDir, 'outputs'), { recursive: true, force: true });
rmSync(path.join(demoDir, 'report.json'), { force: true });
rmSync(path.join(demoDir, 'evidence.json'), { force: true });
rmSync(path.join(demoDir, 'manifest.json'), { force: true });

mkdirSync(demoDir, { recursive: true });
copyFileSync(templatePath, inputPath);

console.log(`✅ Demo reset complete. Input ready at ${inputPath}`);
