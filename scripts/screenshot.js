#!/usr/bin/env node
/**
 * Generates a Chrome Web Store screenshot (1280x800) by rendering
 * a static HTML mockup of the popup with realistic sample data,
 * then capturing it with Puppeteer.
 */
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const iconSvg = readFileSync(join(root, 'public/icons/icon.svg'), 'utf8');
const iconDataUri = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;

const WIDTH = 1280;
const HEIGHT = 800;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
${readFileSync(join(root, 'src/popup/index.css'), 'utf8')}

/* Override popup sizing for screenshot context */
body {
  width: ${WIDTH}px;
  height: ${HEIGHT}px;
  min-height: ${HEIGHT}px;
  max-height: ${HEIGHT}px;
  overflow: hidden;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
}

#app {
  width: 360px;
  height: 540px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 25px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Left-side feature callouts */
.callout-left, .callout-right {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.callout-left { left: 56px; top: 50%; transform: translateY(-50%); }
.callout-right { right: 56px; top: 50%; transform: translateY(-50%); }

.callout {
  display: flex;
  align-items: center;
  gap: 14px;
  color: rgba(255,255,255,0.92);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.callout-left .callout { flex-direction: row-reverse; text-align: right; }
.callout-right .callout { flex-direction: row; text-align: left; }

.callout-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.callout-text h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 3px 0;
}
.callout-text p {
  font-size: 12px;
  margin: 0;
  opacity: 0.65;
  line-height: 1.4;
}

/* Title above popup */
.hero-title {
  position: absolute;
  top: 44px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.hero-title img { width: 36px; height: 36px; border-radius: 8px; }
.hero-title h2 { font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
.hero-title span { font-size: 14px; opacity: 0.55; font-weight: 400; margin-left: 2px; }

/* Product list should fill space */
.product-list-container {
  flex: 1;
  overflow: hidden;
}
</style>
</head>
<body>

<!-- Hero title -->
<div class="hero-title">
  <img src="${iconDataUri}" alt="Price Tracker icon" />
  <h2>Price Tracker <span>for Chrome</span></h2>
</div>

<!-- Left callouts -->
<div class="callout-left">
  <div class="callout">
    <div class="callout-text">
      <h3>Track Any Product</h3>
      <p>Works on Amazon, Best Buy,<br>Walmart, Shopify, and more</p>
    </div>
    <div class="callout-icon">🛒</div>
  </div>
  <div class="callout">
    <div class="callout-text">
      <h3>Price Drop Alerts</h3>
      <p>Get notified the moment<br>a price drops</p>
    </div>
    <div class="callout-icon">🔔</div>
  </div>
  <div class="callout">
    <div class="callout-text">
      <h3>100% Private</h3>
      <p>All data stays on your<br>device — no account needed</p>
    </div>
    <div class="callout-icon">🔒</div>
  </div>
</div>

<!-- Right callouts -->
<div class="callout-right">
  <div class="callout">
    <div class="callout-icon">📊</div>
    <div class="callout-text">
      <h3>Price History</h3>
      <p>See how prices change<br>over time</p>
    </div>
  </div>
  <div class="callout">
    <div class="callout-icon">⚡</div>
    <div class="callout-text">
      <h3>Auto Background Checks</h3>
      <p>Scans every 30 min<br>by default</p>
    </div>
  </div>
  <div class="callout">
    <div class="callout-icon">💱</div>
    <div class="callout-text">
      <h3>Multi-Currency</h3>
      <p>USD, EUR, GBP, CAD,<br>JPY, and more</p>
    </div>
  </div>
</div>

<!-- Popup mockup -->
<div id="app">
  <div class="header">
    <h1>Price Tracker</h1>
    <div class="header-actions">
      <button class="btn-ghost">Scan prices</button>
      <button class="btn-ghost btn-settings">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="8" r="2.5" />
          <path d="M13.3 10a1.1 1.1 0 0 0 .2 1.2l.04.04a1.33 1.33 0 1 1-1.88 1.88l-.04-.04a1.1 1.1 0 0 0-1.2-.2 1.1 1.1 0 0 0-.67 1.01v.12a1.33 1.33 0 1 1-2.67 0v-.06A1.1 1.1 0 0 0 6.37 13a1.1 1.1 0 0 0-1.2.2l-.04.04a1.33 1.33 0 1 1-1.88-1.88l.04-.04a1.1 1.1 0 0 0 .2-1.2 1.1 1.1 0 0 0-1.01-.67h-.12a1.33 1.33 0 1 1 0-2.67h.06A1.1 1.1 0 0 0 3 6.37a1.1 1.1 0 0 0-.2-1.2l-.04-.04A1.33 1.33 0 1 1 4.64 3.25l.04.04a1.1 1.1 0 0 0 1.2.2h.05a1.1 1.1 0 0 0 .67-1.01v-.12a1.33 1.33 0 1 1 2.67 0v.06A1.1 1.1 0 0 0 10 3.13a1.1 1.1 0 0 0 1.2-.2l.04-.04a1.33 1.33 0 1 1 1.88 1.88l-.04.04a1.1 1.1 0 0 0-.2 1.2v.05a1.1 1.1 0 0 0 1.01.67h.12a1.33 1.33 0 0 1 0 2.67h-.06A1.1 1.1 0 0 0 13.3 10z" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Track bar (simulating user on a product page) -->
  <div class="track-bar">
    <div class="track-bar-inner">
      <div class="current-page-info">
        <div class="current-page-title">Sony WH-1000XM5 Wireless Headphones</div>
        <div class="current-page-price">$278.00</div>
      </div>
      <button class="btn-track" style="width:auto;padding:8px 16px;">Track price</button>
    </div>
  </div>

  <!-- Product list -->
  <div class="product-list-container">

    <!-- Product 1: with price drop -->
    <div class="product-item">
      <div class="product-thumbnail-placeholder" style="background:#fef3c7;border-color:#fde68a;">📦</div>
      <div class="product-details">
        <div class="product-title"><a>Apple AirPods Pro (2nd Gen)</a></div>
        <div class="product-hostname">amazon.com</div>
        <div class="product-price-row">
          <span class="product-price">$189.99</span>
          <span class="price-badge drop">Lowest</span>
        </div>
        <div style="margin-top:6px;font-size:11px;color:var(--text-muted);">
          <div style="display:flex;justify-content:space-between;padding:1px 0;">
            <span style="color:var(--drop);font-weight:500;">$189.99 ↓</span>
            <span>Apr 3</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:1px 0;">
            <span>$219.99</span>
            <span>Mar 28</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:1px 0;">
            <span>$249.00</span>
            <span>Mar 15</span>
          </div>
        </div>
      </div>
      <div class="product-actions">
        <button class="btn-danger">✕</button>
      </div>
    </div>

    <!-- Product 2 -->
    <div class="product-item">
      <div class="product-thumbnail-placeholder" style="background:#e0f2fe;border-color:#bae6fd;">🖥️</div>
      <div class="product-details">
        <div class="product-title"><a>LG 27" 4K UltraFine Monitor</a></div>
        <div class="product-hostname">bestbuy.com</div>
        <div class="product-price-row">
          <span class="product-price">$349.99</span>
        </div>
      </div>
      <div class="product-actions">
        <button class="btn-danger">✕</button>
      </div>
    </div>

    <!-- Product 3 -->
    <div class="product-item">
      <div class="product-thumbnail-placeholder" style="background:#fce7f3;border-color:#fbcfe8;">⌨️</div>
      <div class="product-details">
        <div class="product-title"><a>Keychron K2 Pro Mechanical Keyboard</a></div>
        <div class="product-hostname">keychron.com</div>
        <div class="product-price-row">
          <span class="product-price">$89.00</span>
        </div>
      </div>
      <div class="product-actions">
        <button class="btn-danger">✕</button>
      </div>
    </div>

    <!-- Product 4 -->
    <div class="product-item">
      <div class="product-thumbnail-placeholder" style="background:#ecfdf5;border-color:#a7f3d0;">🎮</div>
      <div class="product-details">
        <div class="product-title"><a>Xbox Wireless Controller — Stellar Shift</a></div>
        <div class="product-hostname">walmart.com</div>
        <div class="product-price-row">
          <span class="product-price">$59.97</span>
        </div>
      </div>
      <div class="product-actions">
        <button class="btn-danger">✕</button>
      </div>
    </div>

  </div>
</div>

</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const outPath = join(root, 'store-assets', 'screenshot-1280x800.png');
  const { mkdirSync } = await import('node:fs');
  mkdirSync(join(root, 'store-assets'), { recursive: true });

  await page.screenshot({ path: outPath, type: 'png', omitBackground: false });
  await browser.close();

  console.log(`Screenshot saved: ${outPath}`);
})();
