import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/client.ts'), 'utf8');

const publicMethodPattern = /\n\s*public\s+(?:async\s+)?([A-Za-z0-9_]+)\s*\(/g;
const withJSDocPattern =
  /\/\*\*[\s\S]*?\*\/\s*\n\s*public\s+(?:async\s+)?([A-Za-z0-9_]+)\s*\(/g;

const all = new Set();
const documented = new Set();

for (const m of source.matchAll(publicMethodPattern)) all.add(m[1]);
for (const m of source.matchAll(withJSDocPattern)) documented.add(m[1]);

const missing = [...all].filter((name) => !documented.has(name)).sort();

if (missing.length) {
  console.error(`JSDoc coverage failed: ${missing.length} public methods without JSDoc.`);
  for (const name of missing) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`JSDoc coverage passed. Public methods documented: ${documented.size}/${all.size}.`);

