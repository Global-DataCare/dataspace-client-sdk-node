import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const DOCS_DIR = resolve('docs');
const mdFiles = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (p.endsWith('.md')) mdFiles.push(p);
  }
}

walk(DOCS_DIR);

const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
const errors = [];

for (const file of mdFiles) {
  const body = readFileSync(file, 'utf8');
  for (const match of body.matchAll(linkRe)) {
    const raw = (match[1] || '').trim();
    if (!raw) continue;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('mailto:') || raw.startsWith('#')) continue;
    if (raw.includes('$HOME/')) continue; // shell example path, not repo-relative doc link
    if (raw.startsWith('/')) continue; // absolute local path example
    const clean = raw.split('#')[0].split('?')[0];
    if (!clean) continue;
    const target = resolve(dirname(file), clean);
    if (!existsSync(target)) {
      errors.push(`${file}: missing link target -> ${raw}`);
    }
  }
}

if (errors.length) {
  console.error(`docs link check failed (${errors.length} errors):`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log(`docs link check passed (${mdFiles.length} markdown files).`);
