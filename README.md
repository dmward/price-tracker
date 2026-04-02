# Price Tracker

A Chrome extension that tracks product prices across e-commerce sites and notifies you when they drop.

![Price Tracker popup](public/icons/icon128.png)

## Features

- **Track any product** — visit a product page and click "Track price" to start monitoring
- **Automatic price checks** — scans all tracked products every 30 minutes in the background
- **Manual scan** — trigger an immediate check from the popup with "Scan prices"
- **Drop notifications** — get a Chrome notification with the old and new price when a drop is detected
- **Price history** — view the full price history for any tracked product
- **Multi-currency** — handles USD, CAD, EUR, GBP, KYD, and more
- **Sale price aware** — prefers sale/current prices over crossed-out regular prices
- **Fully local** — all data stored in `chrome.storage.local`; no account or internet connection required

## Setup

### 1. Install & build

```bash
pnpm install
pnpm build
```

### 2. Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

## Development

```bash
pnpm build        # production build
pnpm build:pack   # build + zip for Chrome Web Store upload
```

To debug the background service worker: `chrome://extensions` → Price Tracker → **Service Worker** → Console.

## How it works

**Price extraction** uses three strategies in order:
1. **JSON-LD** — parses `application/ld+json` Product/Offer structured data
2. **Meta tags** — checks `og:price:amount`, `product:price:amount`, `itemprop="price"`
3. **CSS selectors** — falls back to known price element patterns (sale prices are checked before regular prices; struck-through prices are skipped)

**Background checks** open a silent tab for each unvisited product URL, extract the price, record it locally, and fire a notification if the price dropped. If the product page is already open in a tab, that tab is used directly.

**Storage** uses `chrome.storage.local` for all data — tracked products, price history (up to 50 records per product), and the notification badge count. No external service is required.

## Stack

- [Preact](https://preactjs.com) — popup UI
- [Vite](https://vitejs.dev) + [@crxjs/vite-plugin](https://crxjs.dev) — build tooling
- TypeScript, Chrome MV3
