#!/usr/bin/env node
/**
 * Lightweight secret scan for committed files.
 *
 * Goal: catch obvious secret leaks before they hit the repo history.
 * - Scans only tracked files (`git ls-files`)
 * - Avoids printing matched secret values
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function listTrackedFiles() {
  const out = execSync('git ls-files -z', { stdio: ['ignore', 'pipe', 'ignore'] });
  return out
    .toString('utf8')
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isBinary(buf) {
  // If it contains a NUL byte, treat as binary.
  return buf.includes(0);
}

function countNewlines(str, endIndex) {
  let count = 0;
  for (let i = 0; i < endIndex; i += 1) {
    if (str.charCodeAt(i) === 10) count += 1;
  }
  return count;
}

const patterns = [
  { name: 'Private key', re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
  { name: 'GitHub token', re: /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { name: 'OpenAI-style key', re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'Postgres URL with credentials', re: /\bpostgres(?:ql)?:\/\/[^/\s]+:[^@\s]+@/gi },
  { name: 'MySQL URL with credentials', re: /\bmysql:\/\/[^/\s]+:[^@\s]+@/gi },
  { name: 'MongoDB URL with credentials', re: /\bmongodb(?:\+srv)?:\/\/[^/\s]+:[^@\s]+@/gi },
];

function isForbiddenEnvFile(path) {
  const normalized = path.replace(/\\/g, '/');
  if (!/(^|\/)\.env(\.|$)/.test(normalized)) return false;
  return !normalized.endsWith('.example');
}

function shouldSkipPath(path) {
  const normalized = path.replace(/\\/g, '/');
  return (
    normalized.startsWith('node_modules/') ||
    normalized.startsWith('.next/') ||
    normalized.startsWith('.git/')
  );
}

function main() {
  const files = listTrackedFiles().filter((f) => !shouldSkipPath(f));

  const findings = [];

  for (const file of files) {
    if (isForbiddenEnvFile(file)) {
      findings.push({ file, line: 1, reason: 'Tracked .env file (should not be committed)' });
      continue;
    }

    let buf;
    try {
      buf = readFileSync(file);
    } catch {
      continue;
    }

    if (buf.length > 2_000_000) continue;
    if (isBinary(buf)) continue;

    const text = buf.toString('utf8');

    for (const { name, re } of patterns) {
      re.lastIndex = 0;
      const match = re.exec(text);
      if (!match) continue;

      const idx = match.index ?? 0;
      const line = countNewlines(text, idx) + 1;
      findings.push({ file, line, reason: `Possible secret pattern: ${name}` });
    }
  }

  if (findings.length > 0) {
    // Do not print matched values; only locations and pattern names.
    // eslint-disable-next-line no-console
    console.error('Secret scan failed. Review and remove/rotate secrets:\n');
    for (const f of findings) {
      // eslint-disable-next-line no-console
      console.error(`- ${f.file}:${f.line} — ${f.reason}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('Secret scan passed.');
}

main();

