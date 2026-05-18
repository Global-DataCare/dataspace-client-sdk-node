import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CLIENT_TS = resolve('src/client.ts');
const OUT_COMPLETE = resolve('docs/04-reference/catalogs/SDK_API_COMPLETE_REFERENCE.md');
const OUT_TABLE = resolve('docs/04-reference/catalogs/SDK_API_TABLE.md');

const source = readFileSync(CLIENT_TS, 'utf8');

const methodPattern =
  /\/\*\*([\s\S]*?)\*\/\s*\n\s*public\s+(?:async\s+)?([A-Za-z0-9_]+)\s*\(([\s\S]*?)\)\s*:\s*([^\{;]+)\s*\{/g;

function cleanDoc(raw) {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('@'));
}

const methods = [];
for (const match of source.matchAll(methodPattern)) {
  const docLines = cleanDoc(match[1]);
  const name = match[2];
  const params = match[3].replace(/\s+/g, ' ').trim();
  const returns = match[4].replace(/\s+/g, ' ').trim();
  methods.push({
    name,
    summary: docLines[0] || 'No summary in JSDoc.',
    whenWhy: docLines.slice(1, 4).join(' '),
    signature: `${name}(${params}) : ${returns}`,
  });
}

methods.sort((a, b) => a.name.localeCompare(b.name));

const complete = [
  '# SDK API Complete Reference',
  '',
  `Generated from JSDoc in \`src/client.ts\`. Methods: **${methods.length}**.`,
  '',
  '## Method Index',
  '',
  '| Method | What it does |',
  '|---|---|',
  ...methods.map((m) => `| [\`${m.name}\`](#${m.name.toLowerCase()}) | ${m.summary} |`),
  '',
];

for (const m of methods) {
  complete.push(`## \`${m.name}\``);
  complete.push('');
  complete.push(`**What it does:** ${m.summary}`);
  complete.push('');
  if (m.whenWhy) {
    complete.push(`**Why/when:** ${m.whenWhy}`);
    complete.push('');
  }
  complete.push('**Signature**');
  complete.push('');
  complete.push('```ts');
  complete.push(m.signature);
  complete.push('```');
  complete.push('');
}

const table = [
  '# SDK API Table (Complete)',
  '',
  `Generated from JSDoc in \`src/client.ts\`. Methods: **${methods.length}**.`,
  '',
  '| Method | What it does | Signature |',
  '|---|---|---|',
  ...methods.map((m) => `| \`${m.name}\` | ${m.summary} | \`${m.signature}\` |`),
  '',
];

writeFileSync(OUT_COMPLETE, complete.join('\n'));
writeFileSync(OUT_TABLE, table.join('\n'));

console.log(`Generated API docs for ${methods.length} methods.`);

