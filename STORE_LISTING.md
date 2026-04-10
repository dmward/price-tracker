# Chrome Web Store Listing

Use this as a reference when filling out the Chrome Web Store developer console.

---

## Name

Price Tracker

## Short Description (132 char max)

Track product prices across any online store and get notified when they drop. Fully local — no account or sign-up required.

## Detailed Description

Stop overpaying. Price Tracker monitors the products you care about and alerts you the moment a price drops.

HOW IT WORKS
1. Visit any product page and click the Price Tracker icon.
2. Hit "Track price" — the current price is saved instantly.
3. The extension automatically rechecks prices in the background (every 30 minutes by default).
4. When a price drops, you get a desktop notification with the old and new price.

FEATURES
- Works on any e-commerce site — Amazon, Best Buy, Home Depot, Walmart, Shopify stores, WooCommerce, and thousands more.
- Automatic background price checks on a configurable schedule.
- Manual "Scan prices" button for an instant refresh.
- Full price history for every tracked product.
- Multi-currency support (USD, EUR, GBP, CAD, JPY, and more).
- Sale-price aware — detects discounted prices and ignores crossed-out originals.
- Customizable settings: scan interval, notification preferences, history limits.

PRIVACY FIRST
All data stays on your device. Price Tracker uses chrome.storage.local — no accounts, no servers, no tracking. Uninstall the extension and everything is gone.

OPEN SOURCE
Price Tracker is free and open source. Contributions and feedback are welcome on GitHub.

---

## Single Purpose

Track product prices and notify the user when they drop.

## Category

Shopping

## Language

English

## Test Instructions (500 char max)

No login or setup required. Install and use immediately.

1. Go to any product page (e.g. amazon.com, bestbuy.com).
2. Click the extension icon, then "Track price."
3. Repeat on 2–3 different sites.
4. Click "Scan prices" to trigger a background check.
5. Click "Price history" on any product to see recorded prices.
6. Open Settings (gear icon) to adjust scan interval or notifications.
7. Click ✕ to remove a product.

All data stored locally. No accounts or external services.

## Permission Justifications

### Host permissions — <all_urls>

Price Tracker needs to access product pages on any website to extract the current price. E-commerce sites span thousands of domains (Amazon, eBay, Shopify stores, small retailers, etc.), so a restricted host list would make the extension unusable for most products. The extension only reads page content to extract prices — it does not modify pages or inject ads.

### tabs

Used to open background tabs for automatic price checking of tracked products and to query the active tab when the user clicks "Track price."

### notifications

Used to display a desktop notification when a tracked product's price drops.

### storage

Used to persist tracked products, price history, and user settings locally.

### alarms

Used to schedule periodic background price checks at the user's configured interval.

### activeTab

Used to access the current tab's URL and page content when the user clicks the extension icon to track a new product.
