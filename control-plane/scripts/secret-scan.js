import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const patterns = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA|DSA|EC|OPENSSH|PRIVATE) KEY-----/ },
  { name: 'Generic Secret', regex: /(?:secret|api[_-]?key|password)\s*[:=]\s*['"][^'"\s]{8,}/i },
];

const allowedExtensions = new Set(['.js', '.ts', '.tsx', '.json', '.yml', '.yaml', '.md']);

function listFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8' });
  return output.split('\n').filter(Boolean);
}

function shouldScan(filePath) {
  if (filePath.includes('node_modules/')) {
    return false;
  }
  const ext = path.extname(filePath);
  return allowedExtensions.has(ext);
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const findings = [];

  for (const pattern of patterns) {
    if (pattern.regex.test(content)) {
      findings.push(pattern.name);
    }
  }

  return findings;
}

function main() {
  const files = listFiles().filter(shouldScan);
  const issues = [];

  for (const file of files) {
    const findings = scanFile(path.join(ROOT, file));
    if (findings.length > 0) {
      issues.push({ file, findings });
    }
  }

  if (issues.length > 0) {
    console.error('Potential secrets detected:');
    for (const issue of issues) {
      console.error(`- ${issue.file}: ${issue.findings.join(', ')}`);
    }
    process.exit(1);
  }

  console.log('✅ Secret scan passed.');
}

main();
