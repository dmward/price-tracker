# Price Tracker

A browser extension that tracks product prices across e-commerce sites and notifies you when they drop. Works on Chrome and Safari.

![Price Tracker popup](public/icons/icon128.png)

## Features

- **Track any product** — visit a product page and click "Track price" to start monitoring
- **Automatic price checks** — scans all tracked products on a configurable interval (default: every 30 minutes)
- **Manual scan** — trigger an immediate check from the popup with "Scan prices"
- **Drop notifications** — get notified with the old and new price when a drop is detected
- **Price history** — view the full price history for any tracked product
- **Settings** — configure scan interval, notification preferences, and history limits
- **Multi-currency** — handles USD, CAD, EUR, GBP, JPY, and more
- **Sale price aware** — prefers sale/current prices over crossed-out regular prices
- **Fully local** — all data stored in `chrome.storage.local`; no account or internet connection required
- **Cross-browser** — works on Chrome and Safari (macOS)

## Setup

### Chrome

```bash
pnpm install
pnpm build
```

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

### Safari (macOS)

```bash
pnpm install
pnpm build:safari
```

1. Open `safari/Price Tracker/Price Tracker.xcodeproj` in Xcode
2. Build & Run (Cmd+R)
3. Enable the extension in Safari → Settings → Extensions

## Development

```bash
pnpm dev          # Vite dev server (Chrome)
pnpm build        # production build (Chrome)
pnpm build:pack   # build + zip for Chrome Web Store upload
pnpm build:safari # full Safari build (build + converter + Xcode project)
pnpm test         # run unit tests
```

To debug the Chrome background worker: `chrome://extensions` → Price Tracker → **Service Worker** → Console.

To debug the Safari background worker: Develop → Web Extension Background Pages → Price Tracker.

## How it works

**Price extraction** uses three strategies in order:
1. **JSON-LD** — parses `application/ld+json` Product/Offer structured data
2. **Meta tags** — checks `og:price:amount`, `product:price:amount`, `itemprop="price"`
3. **CSS selectors** — falls back to known price element patterns (sale prices are checked before regular prices; struck-through prices are skipped)

**Background checks** open a silent tab for each unvisited product URL, extract the price, record it locally, and fire a notification if the price dropped. If the product page is already open in a tab, that tab is used directly.

**Storage** uses `chrome.storage.local` for all data — tracked products, price history, settings, and the notification badge count. No external service is required.

**Safari compatibility** — the service worker is built as a self-contained IIFE (Safari has unreliable ES module support in MV3 workers). The `notifications` API is guarded since Safari doesn't support it.

## Stack

- [Preact](https://preactjs.com) — popup UI
- [Vite](https://vitejs.dev) + [@crxjs/vite-plugin](https://crxjs.dev) — build tooling
- [Vitest](https://vitest.dev) — unit testing
- TypeScript, Chrome MV3
