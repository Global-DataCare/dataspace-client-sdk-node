import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const gwPath = path.resolve(ROOT, '..', 'gwtemplate-node-ts', 'artifacts', 'core-flow-examples.json');
const sdkPath = path.resolve(ROOT, 'tests', 'fixtures', 'core-flow-examples.json');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(gwPath)) {
  fail(`Missing GW canonical examples: ${gwPath}. Run 'npm -C ../gwtemplate-node-ts run build:swagger' first.`);
}
if (!fs.existsSync(sdkPath)) {
  fail(`Missing SDK fixture examples: ${sdkPath}`);
}

const gw = JSON.parse(fs.readFileSync(gwPath, 'utf8'));
const sdk = JSON.parse(fs.readFileSync(sdkPath, 'utf8'));

const gwNorm = JSON.stringify(gw);
const sdkNorm = JSON.stringify(sdk);

if (gwNorm !== sdkNorm) {
  fail(
    'GW and SDK core-flow examples are out of sync.\n'
    + `- GW:  ${gwPath}\n`
    + `- SDK: ${sdkPath}\n`
    + "Update SDK fixture from GW artifact.",
  );
}

console.log('✅ GW/SDK core-flow examples are aligned.');
