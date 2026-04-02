#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const distDir = join(root, 'dist');
const manifestPath = join(distDir, 'manifest.json');

if (!existsSync(distDir) || !existsSync(manifestPath)) {
  console.error('ERROR: dist/ not found. Run `pnpm build` first.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version;
const outFile = join(root, `price-tracker-v${version}.zip`);

console.log(`Packaging dist/ → ${outFile}`);
execSync(`cd "${distDir}" && zip -r "${outFile}" .`, { stdio: 'inherit' });
console.log(`Done. Upload ${outFile} to the Chrome Web Store.`);
