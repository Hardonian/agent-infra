import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const README_PATH = path.join(ROOT, 'README.md');
const CONTRIBUTING_PATH = path.join(ROOT, 'CONTRIBUTING.md');

function fail(message) {
  console.error(`docs verification failed: ${message}`);
  process.exit(1);
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`missing file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function ensureNoTodo(content, label) {
  if (/\bTODO\b/i.test(content)) {
    fail(`found TODO marker in ${label}`);
  }
}

function extractSection(content, heading) {
  const lines = content.split('\n');
  const headingIndex = lines.findIndex(
    (line) => line.trim().toLowerCase() === heading.toLowerCase()
  );
  if (headingIndex === -1) {
    fail(`missing section ${heading} in README.md`);
  }
  const sectionLines = [];
  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) {
      break;
    }
    sectionLines.push(lines[i]);
  }
  return sectionLines.join('\n');
}

function extractCodeBlocks(section) {
  const blocks = [];
  const fence = '```';
  let inBlock = false;
  let current = [];
  let isExecutableBlock = false;
  for (const line of section.split('\n')) {
    if (line.trim().startsWith(fence)) {
      if (inBlock) {
        // End of block - only add if it's an executable block
        if (isExecutableBlock) {
          blocks.push(current.join('\n'));
        }
        current = [];
        inBlock = false;
        isExecutableBlock = false;
      } else {
        // Start of block - check if it's bash/shell/sh
        inBlock = true;
        const lang = line.trim().slice(fence.length).trim().toLowerCase();
        // Only process blocks explicitly marked as bash/sh/shell
        isExecutableBlock = ['bash', 'sh', 'shell'].includes(lang);
      }
      continue;
    }
    if (inBlock && isExecutableBlock) {
      current.push(line);
    }
  }
  return blocks;
}

function loadScripts() {
  const pkg = JSON.parse(readFile(path.join(ROOT, 'package.json')));
  return new Set(Object.keys(pkg.scripts || {}));
}

function verifyCommands(blocks, scripts) {
  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    for (const line of lines) {
      if (line.startsWith('pnpm run ')) {
        const script = line.replace('pnpm run ', '').split(' ')[0];
        if (!scripts.has(script)) {
          fail(`README command references missing script: ${script}`);
        }
        continue;
      }

      if (line.startsWith('pnpm ')) {
        const command = line.split(' ')[1];
        const allowed = new Set(['install', 'exec', 'controlplane']);
        if (!allowed.has(command)) {
          fail(`README command uses unsupported pnpm command: ${line}`);
        }
        continue;
      }

      if (line.startsWith('node ')) {
        const file = line.replace('node ', '').split(' ')[0];
        const fullPath = path.join(ROOT, file);
        if (!fs.existsSync(fullPath)) {
          fail(`README command references missing file: ${file}`);
        }
        continue;
      }

      fail(`README command is not recognized by verification: ${line}`);
    }
  }
}

function verifyLinks(content) {
  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  const matches = content.matchAll(linkRegex);
  for (const match of matches) {
    const raw = match[1];
    if (
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('#') ||
      raw.startsWith('mailto:')
    ) {
      continue;
    }

    const cleaned = raw.split('#')[0];
    if (!cleaned) {
      continue;
    }
    const normalized = cleaned.startsWith('./') ? cleaned.slice(2) : cleaned;
    const target = path.join(ROOT, normalized);

    if (!fs.existsSync(target)) {
      fail(`README link target missing: ${cleaned}`);
    }
  }
}

function main() {
  const readme = readFile(README_PATH);
  const contributing = readFile(CONTRIBUTING_PATH);

  ensureNoTodo(readme, 'README.md');
  ensureNoTodo(contributing, 'CONTRIBUTING.md');

  verifyLinks(readme);

  const section = extractSection(readme, '## Quick Start');
  const blocks = extractCodeBlocks(section);

  if (blocks.length === 0) {
    fail('Quick Start section has no code blocks');
  }

  const scripts = loadScripts();
  verifyCommands(blocks, scripts);

  console.log('✅ Documentation verification passed.');
}

main();
