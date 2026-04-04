#!/usr/bin/env node
// Replaces the service worker with a minimal diagnostic version to identify
// exactly what's failing in Safari. Run after build:safari to inject.

import { writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const resourcesDir = resolve(root, 'safari/Price Tracker/Price Tracker Extension/Resources')

const workerBundle = readdirSync(resolve(resourcesDir, 'assets'))
  .find((f) => f.startsWith('worker.ts-') && f.endsWith('.js'))

const workerPath = resolve(resourcesDir, 'assets', workerBundle)

// Wrap the entire worker in a try/catch and log to a retrievable location.
// Also test each import individually to identify the failing line.
const original = readFileSync(workerPath, 'utf8')

const debugWorker = `
// DEBUG WRAPPER
console.log('[price-tracker] worker starting...');
try {
  console.log('[price-tracker] self:', typeof self);
  console.log('[price-tracker] browser:', typeof browser !== 'undefined' ? 'defined' : 'undefined');
  console.log('[price-tracker] chrome:', typeof chrome !== 'undefined' ? 'defined' : 'undefined');
  console.log('[price-tracker] self.browser:', typeof self !== 'undefined' && self.browser ? 'defined' : 'undefined');
  console.log('[price-tracker] self.chrome:', typeof self !== 'undefined' && self.chrome ? 'defined' : 'undefined');
} catch(e) {
  console.error('[price-tracker] global check failed:', e.message);
}

${original}

console.log('[price-tracker] worker loaded successfully');
`

writeFileSync(workerPath, debugWorker)
console.log(`Injected debug wrapper into ${workerBundle}`)
console.log('Now rebuild in Xcode (Clean + Run), enable extension, and check:')
console.log('  Develop → Web Extension Background Pages → Price Tracker')
