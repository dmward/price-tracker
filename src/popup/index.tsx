import { render, h } from 'preact'
import { useState, useEffect, useCallback } from 'preact/hooks'
import { supabase, setupAuthPersistence } from '../lib/supabase'
import { browserAPI } from '../lib/browserAPI'
import { getCachedProductList, clearBadgeCount } from '../lib/storage'
import type { TrackedProduct } from '../lib/messages'
import type { User } from '@supabase/supabase-js'

setupAuthPersistence()

// ─── Root ─────────────────────────────────────────────────────────────────────

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    // Clear badge when popup opens
    clearBadgeCount()
    browserAPI.action.setBadgeText({ text: '' })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return <div class="loading">Loading…</div>

  return (
    <div id="app">
      {user ? <MainView user={user} /> : <AuthView onAuth={setUser} />}
    </div>
  )
}

// ─── Auth View ────────────────────────────────────────────────────────────────

function AuthView({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const fn =
      mode === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })

    const { data, error: authError } = await fn
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    if (mode === 'register' && !data.session) {
      setError('Check your email to confirm your account, then log in.')
      return
    }

    if (data.user) onAuth(data.user)
  }

  return (
    <div class="auth-container">
      <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
      <p>Track product prices across the web and get notified when they drop.</p>

      <form class="form" onSubmit={submit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          required
        />
        {error && <p class="error-msg">{error}</p>}
        <button class="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p class="form-toggle">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

function MainView({ user: _user }: { user: User }) {
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
      if (resp?.products) {
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
      setScanCount(resp?.checked ?? 0)
      setScanState('done')
      loadProducts()
      setTimeout(() => setScanState('idle'), 2500)
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
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
          <button class="btn-ghost" onClick={handleSignOut}>Sign out</button>
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
