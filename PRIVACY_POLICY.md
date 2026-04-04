# Privacy Policy — Price Tracker

**Last updated:** April 4, 2026

## Overview

Price Tracker is a browser extension that monitors product prices on e-commerce websites and notifies you when prices drop. Your privacy is important — this extension is designed to work entirely on your device with no external data collection.

## Data Collection

**Price Tracker does not collect, transmit, or share any personal data.**

All information the extension stores — tracked product URLs, prices, price history, and your settings — is saved locally on your device using `chrome.storage.local`. No data ever leaves your browser.

## What the Extension Stores Locally

- **Product data:** URL, page title, product image URL, current price, and currency for each product you choose to track.
- **Price history:** A record of price changes over time (limited by your configured history setting, default 50 entries per product).
- **Settings:** Your preferences for scan interval, notification behavior, and history limits.

## Permissions

The extension requests the following browser permissions:

| Permission | Why it's needed |
|---|---|
| **storage** | Save tracked products, price history, and settings locally on your device. |
| **alarms** | Schedule automatic background price checks at your configured interval. |
| **notifications** | Show a desktop notification when a tracked product's price drops. |
| **tabs** | Open background tabs to check prices on tracked product pages. |
| **scripting** | Run the price-extraction script on product pages. |
| **activeTab** | Read the current tab's URL and price when you click "Track price." |
| **Host permissions (all URLs)** | Access product pages on any e-commerce site so prices can be extracted. Without this, tracking would be limited to a hardcoded list of stores. |

## Third-Party Services

Price Tracker does **not** use any third-party services, analytics, tracking pixels, or external servers. There are no network requests made by the extension itself — it only reads the web pages you ask it to track.

## Data Retention and Deletion

All data is stored locally and is deleted when you uninstall the extension. You can also remove individual tracked products from the popup at any time.

## Children's Privacy

Price Tracker does not knowingly collect any information from children under 13.

## Changes to This Policy

If this policy is updated, the changes will be reflected in the extension's store listing and this document.

## Contact

If you have questions about this privacy policy, please open an issue on the project's GitHub repository.
