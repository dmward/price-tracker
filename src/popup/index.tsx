import { render, h } from 'preact'
import { useState, useEffect, useCallback } from 'preact/hooks'
import { browserAPI } from '../lib/browserAPI'
import { getCachedProductList, clearBadgeCount } from '../lib/storage'
import type { TrackedProduct, Settings } from '../lib/messages'
import { DEFAULT_SETTINGS } from '../lib/messages'

// ─── Root ─────────────────────────────────────────────────────────────────────

function App() {
  const [view, setView] = useState<'main' | 'settings'>('main')

  useEffect(() => {
    clearBadgeCount()
    browserAPI.action.setBadgeText({ text: '' })
  }, [])

  return (
    <div id="app">
      {view === 'settings'
        ? <SettingsView onBack={() => setView('main')} />
        : <MainView onOpenSettings={() => setView('settings')} />}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

function MainView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [products, setProducts] = useState<TrackedProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [currentTab, setCurrentTab] = useState<{ url: string; title: string; price: number | null; currency: string } | null>(null)
  const [trackingState, setTrackingState] = useState<'idle' | 'loading' | 'tracked'>('idle')
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'done'>('idle')

  const loadProducts = useCallback(async () => {
    // Show cached list instantly, then refresh from background
    const cached = await getCachedProductList()
    if (cached.length > 0) {
      setProducts(cached)
      setLoadingProducts(false)
    }

    browserAPI.runtime.sendMessage({ type: 'GET_TRACKED_PRODUCTS' }, (resp) => {
      if (browserAPI.runtime.lastError || !resp) {
        setLoadingProducts(false)
        return
      }
      if (resp.products) {
        setProducts(resp.products)
        setLoadingProducts(false)
      }
    })
  }, [])

  // Detect current tab info
  const detectCurrentTab = useCallback(async () => {
    const [tab] = await new Promise<chrome.tabs.Tab[]>((resolve) => {
      browserAPI.tabs.query({ active: true, currentWindow: true }, resolve)
    })

    if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
      setCurrentTab(null)
      return
    }

    // Get page meta + price
    browserAPI.tabs.sendMessage(tab.id, { type: 'GET_PAGE_META' }, (meta) => {
      if (browserAPI.runtime.lastError || !meta) {
        setCurrentTab({ url: tab.url!, title: tab.title ?? '', price: null, currency: 'USD' })
        return
      }

      browserAPI.tabs.sendMessage(tab.id!, { type: 'EXTRACT_PRICE' }, (priceResult) => {
        setCurrentTab({
          url: meta.url ?? tab.url!,
          title: meta.title ?? tab.title ?? '',
          price: priceResult?.price ?? null,
          currency: priceResult?.currency ?? 'USD',
        })
      })
    })
  }, [])

  useEffect(() => {
    loadProducts()
    detectCurrentTab()
  }, [loadProducts, detectCurrentTab])

  // Determine if current tab is already tracked
  const isCurrentTabTracked = currentTab
    ? products.some((p) => p.url === currentTab.url)
    : false

  const handleTrack = async () => {
    if (!currentTab || isCurrentTabTracked) return
    setTrackingState('loading')

    browserAPI.runtime.sendMessage({ type: 'TRACK_PRODUCT' }, (resp) => {
      if (browserAPI.runtime.lastError) {
        console.error('Track failed:', browserAPI.runtime.lastError.message)
        setTrackingState('idle')
        return
      }
      if (resp?.success) {
        setTrackingState('tracked')
        loadProducts()
      } else {
        setTrackingState('idle')
        console.error('Track failed:', resp?.error)
      }
    })
  }

  const handleUntrack = (productId: string) => {
    browserAPI.runtime.sendMessage({ type: 'UNTRACK_PRODUCT', productId }, (resp) => {
      if (resp?.success) loadProducts()
    })
  }

  const [scanCount, setScanCount] = useState(0)

  const handleScan = () => {
    setScanState('scanning')
    browserAPI.runtime.sendMessage({ type: 'SCAN_PRICES' }, (resp) => {
      if (browserAPI.runtime.lastError) {
        console.error('Scan failed:', browserAPI.runtime.lastError.message)
      }
      setScanCount(resp?.checked ?? 0)
      setScanState('done')
      loadProducts()
      setTimeout(() => setScanState('idle'), 2500)
    })
  }

  return (
    <>
      <div class="header">
        <h1>Price Tracker</h1>
        <div class="header-actions">
          <button
            class="btn-ghost"
            onClick={handleScan}
            disabled={scanState === 'scanning'}
            title="Check all tracked products for price changes"
          >
            {scanState === 'scanning' ? 'Scanning…' : scanState === 'done' ? `Checked ${scanCount} ✓` : 'Scan prices'}
          </button>
          <button
            class="btn-ghost btn-settings"
            onClick={onOpenSettings}
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="8" r="2.5" />
              <path d="M13.3 10a1.1 1.1 0 0 0 .2 1.2l.04.04a1.33 1.33 0 1 1-1.88 1.88l-.04-.04a1.1 1.1 0 0 0-1.2-.2 1.1 1.1 0 0 0-.67 1.01v.12a1.33 1.33 0 1 1-2.67 0v-.06A1.1 1.1 0 0 0 6.37 13a1.1 1.1 0 0 0-1.2.2l-.04.04a1.33 1.33 0 1 1-1.88-1.88l.04-.04a1.1 1.1 0 0 0 .2-1.2 1.1 1.1 0 0 0-1.01-.67h-.12a1.33 1.33 0 1 1 0-2.67h.06A1.1 1.1 0 0 0 3 6.37a1.1 1.1 0 0 0-.2-1.2l-.04-.04A1.33 1.33 0 1 1 4.64 3.25l.04.04a1.1 1.1 0 0 0 1.2.2h.05a1.1 1.1 0 0 0 .67-1.01v-.12a1.33 1.33 0 1 1 2.67 0v.06A1.1 1.1 0 0 0 10 3.13a1.1 1.1 0 0 0 1.2-.2l.04-.04a1.33 1.33 0 1 1 1.88 1.88l-.04.04a1.1 1.1 0 0 0-.2 1.2v.05a1.1 1.1 0 0 0 1.01.67h.12a1.33 1.33 0 0 1 0 2.67h-.06A1.1 1.1 0 0 0 13.3 10z" />
            </svg>
          </button>
        </div>
      </div>

      {currentTab && (
        <div class="track-bar">
          <div class="track-bar-inner">
            <div class="current-page-info">
              <div class="current-page-title" title={currentTab.title}>{currentTab.title || currentTab.url}</div>
              {currentTab.price !== null && (
                <div class="current-page-price">
                  {formatPrice(currentTab.price, currentTab.currency)}
                </div>
              )}
            </div>
            <button
              class={`btn-track${isCurrentTabTracked ? ' tracked' : ''}`}
              onClick={handleTrack}
              disabled={trackingState === 'loading' || isCurrentTabTracked}
            >
              {isCurrentTabTracked
                ? 'Tracking'
                : trackingState === 'loading'
                ? 'Tracking…'
                : 'Track price'}
            </button>
          </div>
        </div>
      )}

      <div class="product-list-container">
        {loadingProducts && products.length === 0 ? (
          <div class="loading">Loading tracked items…</div>
        ) : products.length === 0 ? (
          <div class="empty-state">
            <div class="icon">🏷️</div>
            <p>No tracked products yet.<br />Visit any product page and click <strong>Track price</strong>.</p>
          </div>
        ) : (
          products.map((product) => (
            <ProductItem
              key={product.id}
              product={product}
              onUntrack={() => handleUntrack(product.id)}
            />
          ))
        )}
      </div>
    </>
  )
}

// ─── Product Item ─────────────────────────────────────────────────────────────

function ProductItem({
  product,
  onUntrack,
}: {
  product: TrackedProduct
  onUntrack: () => void
}) {
  const [history, setHistory] = useState<{ price: number; currency: string; detectedAt: string }[]>([])
  const [expanded, setExpanded] = useState(false)

  const hostname = (() => {
    try { return new URL(product.url).hostname.replace(/^www\./, '') } catch { return product.url }
  })()

  const lowestPrice =
    history.length > 0 ? Math.min(...history.map((h) => h.price)) : null

  const isAtLowest =
    lowestPrice !== null &&
    product.latestPrice !== null &&
    product.latestPrice <= lowestPrice

  const loadHistory = () => {
    if (history.length > 0) {
      setExpanded((v) => !v)
      return
    }
    browserAPI.runtime.sendMessage({ type: 'GET_PRICE_HISTORY', productId: product.id }, (resp) => {
      if (resp?.history) {
        setHistory(resp.history)
        setExpanded(true)
      }
    })
  }

  return (
    <div class="product-item">
      {product.imageUrl ? (
        <img class="product-thumbnail" src={product.imageUrl} alt="" loading="lazy" />
      ) : (
        <div class="product-thumbnail-placeholder">🛍️</div>
      )}

      <div class="product-details">
        <div class="product-title">
          <a href={product.url} target="_blank" rel="noopener noreferrer" title={product.title ?? undefined}>
            {product.title ?? hostname}
          </a>
        </div>
        <div class="product-hostname">{hostname}</div>
        <div class="product-price-row">
          {product.latestPrice !== null ? (
            <>
              <span class="product-price">{formatPrice(product.latestPrice, product.currency)}</span>
              {isAtLowest && history.length > 1 && (
                <span class="price-badge drop">Lowest</span>
              )}
            </>
          ) : (
            <span class="product-price no-price">Price not detected</span>
          )}
        </div>

        {expanded && history.length > 0 && (
          <PriceHistory history={history} currency={product.currency} />
        )}

        {product.latestPrice !== null && (
          <button class="btn-ghost" style="font-size:11px;padding:3px 0;margin-top:2px;" onClick={loadHistory}>
            {expanded ? 'Hide history' : 'Price history'}
          </button>
        )}
      </div>

      <div class="product-actions">
        <button class="btn-danger" onClick={onUntrack} title="Stop tracking">✕</button>
      </div>
    </div>
  )
}

// ─── Price History ────────────────────────────────────────────────────────────

function PriceHistory({
  history,
  currency,
}: {
  history: { price: number; currency: string; detectedAt: string }[]
  currency: string
}) {
  const shown = history.slice(0, 10)

  return (
    <div style="margin-top:6px;font-size:11px;color:var(--text-muted);">
      {shown.map((entry, i) => {
        const prev = shown[i + 1]
        const dropped = prev && entry.price < prev.price
        return (
          <div key={entry.detectedAt} style="display:flex;justify-content:space-between;padding:1px 0;">
            <span style={dropped ? 'color:var(--drop);font-weight:500;' : ''}>
              {formatPrice(entry.price, entry.currency ?? currency)}
              {dropped && ' ↓'}
            </span>
            <span>{formatDate(entry.detectedAt)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Settings View ───────────────────────────────────────────────────────────

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 360, label: '6 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '24 hours' },
]

const HISTORY_OPTIONS = [
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' },
]

function SettingsView({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    browserAPI.runtime.sendMessage({ type: 'GET_SETTINGS' }, (resp) => {
      if (resp?.settings) setSettings(resp.settings)
      setLoading(false)
    })
  }, [])

  const save = (partial: Partial<Settings>) => {
    const updated = { ...settings, ...partial }
    setSettings(updated)
    browserAPI.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: partial })
  }

  if (loading) {
    return (
      <>
        <div class="header">
          <button class="btn-ghost" onClick={onBack}>← Back</button>
          <h1>Settings</h1>
          <div style="width:48px" />
        </div>
        <div class="loading">Loading…</div>
      </>
    )
  }

  return (
    <>
      <div class="header">
        <button class="btn-ghost" onClick={onBack}>← Back</button>
        <h1>Settings</h1>
        <div style="width:48px" />
      </div>

      <div class="settings-list">
        <div class="settings-item">
          <div class="settings-label">
            <div class="settings-title">Scan interval</div>
            <div class="settings-desc">How often to check for price changes</div>
          </div>
          <select
            class="settings-select"
            value={settings.scanIntervalMinutes}
            onChange={(e) => save({ scanIntervalMinutes: Number((e.target as HTMLSelectElement).value) })}
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div class="settings-item">
          <div class="settings-label">
            <div class="settings-title">Price drop notifications</div>
            <div class="settings-desc">Show a notification when a tracked price drops</div>
          </div>
          <label class="settings-toggle">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => save({ notificationsEnabled: (e.target as HTMLInputElement).checked })}
            />
            <span class="toggle-slider" />
          </label>
        </div>

        <div class="settings-item">
          <div class="settings-label">
            <div class="settings-title">History limit</div>
            <div class="settings-desc">Max price records kept per product</div>
          </div>
          <select
            class="settings-select"
            value={settings.maxHistoryRecords}
            onChange={(e) => save({ maxHistoryRecords: Number((e.target as HTMLSelectElement).value) })}
          >
            {HISTORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

// ─── Mount ────────────────────────────────────────────────────────────────────

render(<App />, document.getElementById('app')!)
