#!/usr/bin/env node
// Applies Safari-specific fixes after safari-web-extension-converter runs.

import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const resourcesDir = resolve(root, 'safari/Price Tracker/Price Tracker Extension/Resources')
const assetsDir = resolve(resourcesDir, 'assets')

// ── Copy the pre-bundled Safari worker into the Xcode project ─────────────────
// vite.config.safari.ts builds a single self-contained IIFE with no imports.
// We copy it to the extension resources root so Safari can load it directly.

// Overwrite service-worker-loader.js (already registered in Xcode project)
// with the self-contained IIFE build — no new files needed in the project.
const safariWorkerSrc = resolve(root, 'dist-safari-worker/worker.js')
const safariWorkerDest = resolve(resourcesDir, 'service-worker-loader.js')
copyFileSync(safariWorkerSrc, safariWorkerDest)
console.log('fix-safari: overwrote service-worker-loader.js with IIFE worker')

// ── Fix manifest ─────────────────────────────────────────────────────────────

const manifestPath = resolve(resourcesDir, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

// Point at the self-contained IIFE worker — no ES module imports needed
manifest.background.service_worker = 'service-worker-loader.js'
delete manifest.background.type

const assetFiles = readdirSync(assetsDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => `assets/${f}`)

manifest.web_accessible_resources = [
  {
    matches: ['<all_urls>'],
    resources: assetFiles,
    use_dynamic_url: false,
  },
]

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log('fix-safari: manifest updated (classic IIFE worker)')

// ── Fix content script loader (chrome → browser global) ──────────────────────

const loaderFiles = readdirSync(assetsDir)
  .filter((f) => f.includes('loader') && f.endsWith('.js'))

for (const file of loaderFiles) {
  const filePath = resolve(assetsDir, file)
  let src = readFileSync(filePath, 'utf8')
  if (src.includes('chrome.runtime.getURL')) {
    src = src.replaceAll(
      'chrome.runtime.getURL',
      '(typeof browser !== "undefined" ? browser : chrome).runtime.getURL',
    )
    writeFileSync(filePath, src)
    console.log(`fix-safari: patched chrome→browser in ${file}`)
  }
}

// ── Fix bundle identifiers in Xcode project ───────────────────────────────────

const pbxprojPath = resolve(root, 'safari/Price Tracker/Price Tracker.xcodeproj/project.pbxproj')
let pbx = readFileSync(pbxprojPath, 'utf8')

pbx = pbx.replaceAll(
  'PRODUCT_BUNDLE_IDENTIFIER = "com.derekward.Price-Tracker";',
  'PRODUCT_BUNDLE_IDENTIFIER = "com.derekward.price-tracker";',
)
pbx = pbx.replaceAll(
  'PRODUCT_BUNDLE_IDENTIFIER = "com.derekward.price-tracker.Extension";',
  'PRODUCT_BUNDLE_IDENTIFIER = "com.derekward.price-tracker.extension";',
)

writeFileSync(pbxprojPath, pbx)
console.log('fix-safari: normalized bundle identifiers')
console.log('fix-safari: done')
