# Roadmap

Future improvements for Price Tracker, roughly prioritized.

## Completed

- ~~Clean up Supabase credentials in `.env`~~
- ~~Add unit tests for `priceParser.ts`~~
- ~~Settings page (scan interval, notifications, history limit)~~
- ~~Safari support~~
- ~~CalVer versioning (YYYY.M.patch)~~

## Up Next

### Dark Mode
- The popup CSS already uses custom properties (`--bg`, `--text`, `--accent`), making a dark theme straightforward.
- Add `prefers-color-scheme: dark` media query with dark theme values. Optionally add a manual toggle in settings.
- **Files:** `src/popup/index.css`, optionally `src/popup/index.tsx` + settings toggle

### Search / Filter in Popup
- With many tracked products, scrolling through the list becomes unusable.
- Add a search input above the product list that filters by title or domain.
- **Files:** `src/popup/index.tsx`, `src/popup/index.css`

### Price Change Sparkline / Mini Chart
- The price history is currently a text list. A small visual chart would make trends obvious at a glance.
- Render a simple inline SVG sparkline next to each product using the existing price history data. No charting library needed.
- **Files:** `src/popup/index.tsx` (new Sparkline component)

## Later

### Expand Price Extraction Coverage
- Strategy 3 (CSS selectors) has 47 selectors but may miss modern SPA e-commerce sites.
- Add selectors for Target, Walmart, Costco, Etsy, eBay modern layouts.
- Optionally add a delayed retry for SPA-rendered prices via MutationObserver.
- **Files:** `src/lib/priceParser.ts`, possibly `src/content/index.ts`

### Export / Import Tracked Products
- Users switching browsers or reinstalling lose all data since storage is local-only.
- JSON export button in popup or settings, JSON file import with merge logic.
- **Files:** `src/popup/index.tsx` or settings view, `src/background/worker.ts`

### Firefox Support
- Firefox uses `browser.*` natively with Promises (no callback wrapping needed). The `browserAPI` polyfill already handles this.
- Main work would be manifest v2/v3 compatibility and a build target.
- **Files:** New `manifest.firefox.json`, vite config adjustments
