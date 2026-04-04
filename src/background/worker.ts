import { browserAPI } from '../lib/browserAPI'
import {
  getProductIndex,
  upsertProductCache,
  removeProductFromCache,
  setCachedProductList,
  incrementBadgeCount,
  clearBadgeCount,
  getProducts,
  setProducts,
  appendPriceRecord,
  getPriceHistoryForProduct,
  removeProductHistory,
  getSettings,
  updateSettings,
} from '../lib/storage'
import type {
  ExtensionMessage,
  TrackedProduct,
  PriceResultMsg,
  Settings,
} from '../lib/messages'

// ─── Startup ────────────────────────────────────────────────────────────────

registerAlarm()

// ─── Alarm ──────────────────────────────────────────────────────────────────

async function registerAlarm(): Promise<void> {
  const settings = await getSettings()
  browserAPI.alarms.get('PRICE_CHECK', (alarm) => {
    if (!alarm) {
      browserAPI.alarms.create('PRICE_CHECK', { periodInMinutes: settings.scanIntervalMinutes })
    }
  })
}

browserAPI.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings()
  browserAPI.alarms.create('PRICE_CHECK', { periodInMinutes: settings.scanIntervalMinutes })
})

browserAPI.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'PRICE_CHECK') {
    runPriceCheckCycle().catch(console.error)
  }
})

// ─── Message Router ──────────────────────────────────────────────────────────

browserAPI.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    switch (message.type) {
      case 'TRACK_PRODUCT':
        handleTrackProduct(sender.tab)
          .then(sendResponse)
          .catch((e) => sendResponse({ success: false, error: String(e) }))
        return true // async

      case 'UNTRACK_PRODUCT':
        handleUntrackProduct(message.productId)
          .then(sendResponse)
          .catch((e) => sendResponse({ success: false, error: String(e) }))
        return true

      case 'GET_TRACKED_PRODUCTS':
        handleGetTrackedProducts()
          .then(sendResponse)
          .catch((e) => sendResponse({ products: [], error: String(e) }))
        return true

      case 'GET_PRICE_HISTORY':
        handleGetPriceHistory(message.productId)
          .then(sendResponse)
          .catch((e) => sendResponse({ history: [], error: String(e) }))
        return true

      case 'CHECK_IF_TRACKED': {
        const url = message.url
        handleCheckIfTracked(url)
          .then(sendResponse)
          .catch(() => sendResponse({ isTracked: false }))
        return true
      }

      case 'SCAN_PRICES':
        handleScanPrices()
          .then(sendResponse)
          .catch((e) => sendResponse({ success: false, checked: 0, error: String(e) }))
        return true

      case 'GET_SETTINGS':
        getSettings()
          .then((settings) => sendResponse({ settings }))
          .catch((e) => sendResponse({ settings: null, error: String(e) }))
        return true

      case 'UPDATE_SETTINGS':
        handleUpdateSettings(message.settings)
          .then(() => sendResponse({ success: true }))
          .catch((e) => sendResponse({ success: false, error: String(e) }))
        return true

      case 'PRICE_RESULT':
        // Proactive price report from content script (passive visit check)
        handlePassivePriceResult(message).catch(console.error)
        return false

      default:
        return false
    }
  },
)

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleTrackProduct(senderTab?: chrome.tabs.Tab) {
  // Messages from the popup don't have sender.tab — query the active tab directly
  let tab = senderTab
  if (!tab?.id || !tab.url) {
    const [active] = await new Promise<chrome.tabs.Tab[]>((resolve) => {
      browserAPI.tabs.query({ active: true, currentWindow: true }, resolve)
    })
    tab = active
  }

  if (!tab?.id || !tab.url) {
    return { success: false, error: 'No active tab' }
  }

  // Get page metadata from content script
  const meta = await sendToTab<{ type: 'PAGE_META'; title: string; imageUrl: string | null; url: string }>(
    tab.id,
    { type: 'GET_PAGE_META' },
  )
  // Get current price
  const priceResult = await sendToTab<PriceResultMsg>(tab.id, { type: 'EXTRACT_PRICE' })

  const url = meta?.url ?? tab.url
  const title = meta?.title ?? tab.title ?? null
  const imageUrl = meta?.imageUrl ?? tab.favIconUrl ?? null
  const price = priceResult?.price ?? null
  const currency = priceResult?.currency ?? 'USD'

  const products = await getProducts()

  // Dedup by URL
  const existing = Object.values(products).find((p) => p.url === url)
  if (existing) {
    return { success: true, productId: existing.id }
  }

  const productId = crypto.randomUUID()
  const now = new Date().toISOString()

  const product: TrackedProduct = {
    id: productId,
    url,
    title,
    imageUrl,
    latestPrice: price,
    currency,
    createdAt: now,
    priceDetectedAt: price !== null ? now : null,
  }

  products[productId] = product
  await setProducts(products)

  if (price !== null) {
    const { maxHistoryRecords } = await getSettings()
    await appendPriceRecord(productId, {
      id: crypto.randomUUID(),
      productId,
      price,
      currency,
      detectedAt: now,
    }, maxHistoryRecords)
  }

  await upsertProductCache(productId, { url, title, lastPrice: price, currency })
  await refreshProductListCache()

  return { success: true, productId }
}

async function handleUntrackProduct(productId: string) {
  const products = await getProducts()
  delete products[productId]
  await setProducts(products)

  await removeProductHistory(productId)
  await removeProductFromCache(productId)
  await refreshProductListCache()

  return { success: true }
}

async function handleGetTrackedProducts(): Promise<{ products: TrackedProduct[] }> {
  const products = await getProducts()
  const sorted = Object.values(products).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  await setCachedProductList(sorted)
  return { products: sorted }
}

async function handleGetPriceHistory(productId: string) {
  const history = await getPriceHistoryForProduct(productId)
  return { history }
}

async function handleCheckIfTracked(url: string) {
  const index = await getProductIndex()
  const entry = Object.entries(index).find(([, v]) => v.url === url)
  if (entry) {
    return { isTracked: true, productId: entry[0] }
  }
  return { isTracked: false }
}

async function handleUpdateSettings(partial: Partial<Settings>) {
  const updated = await updateSettings(partial)
  // Re-register alarm if interval changed
  if (partial.scanIntervalMinutes != null) {
    browserAPI.alarms.clear('PRICE_CHECK', () => {
      browserAPI.alarms.create('PRICE_CHECK', { periodInMinutes: updated.scanIntervalMinutes })
    })
  }
}

async function handlePassivePriceResult(msg: PriceResultMsg) {
  if (msg.price === null) return

  const index = await getProductIndex()
  const entry = Object.entries(index).find(([, v]) => v.url === msg.url)
  if (!entry) return

  const [productId, cached] = entry

  if (cached.lastPrice !== null && msg.price < cached.lastPrice) {
    await recordPriceDrop(productId, cached, msg.price, msg.currency)
  } else {
    const { maxHistoryRecords } = await getSettings()
    await appendPriceRecord(productId, {
      id: crypto.randomUUID(),
      productId,
      price: msg.price,
      currency: msg.currency,
      detectedAt: new Date().toISOString(),
    }, maxHistoryRecords)
    await upsertProductCache(productId, { ...cached, lastPrice: msg.price, currency: msg.currency })
    await updateProductLatestPrice(productId, msg.price, msg.currency)
  }
}

// ─── Background Price Check Cycle ────────────────────────────────────────────

async function runPriceCheckCycle() {
  // Prefer local cache; fall back to full products store so the alarm never silently skips
  let entries = Object.entries(await getProductIndex())
  if (entries.length === 0) {
    const { products } = await handleGetTrackedProducts()
    entries = products.map((p) => [
      p.id,
      { url: p.url, title: p.title, lastPrice: p.latestPrice, currency: p.currency },
    ])
  }
  if (entries.length === 0) return

  for (let i = 0; i < entries.length; i += 5) {
    const batch = entries.slice(i, i + 5)
    await Promise.all(batch.map(([productId, entry]) => checkPriceForEntry(productId, entry)))
  }
}

// Manual scan: always fetches fresh product list from local storage
async function handleScanPrices(): Promise<{ success: boolean; checked: number; scannedAt?: string }> {
  const { products } = await handleGetTrackedProducts()
  if (products.length === 0) return { success: true, checked: 0 }

  const entries: [string, { url: string; title: string | null; lastPrice: number | null; currency: string }][] =
    products.map((p) => [p.id, { url: p.url, title: p.title, lastPrice: p.latestPrice, currency: p.currency }])

  for (let i = 0; i < entries.length; i += 5) {
    const batch = entries.slice(i, i + 5)
    await Promise.all(batch.map(([productId, entry]) => checkPriceForEntry(productId, entry)))
  }

  console.log(`[price-tracker] scan complete — checked ${products.length} products`)
  return { success: true, checked: products.length, scannedAt: new Date().toISOString() }
}

async function checkPriceForEntry(
  productId: string,
  entry: { url: string; title: string | null; lastPrice: number | null; currency: string },
) {
  const label = entry.title ?? new URL(entry.url).hostname
  try {
    const existingTabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
      browserAPI.tabs.query({ url: entry.url }, resolve)
    })

    let price: number | null = null
    let currency = entry.currency

    if (existingTabs.length > 0 && existingTabs[0].id != null) {
      console.log(`[price-tracker] ${label}: checking open tab`)
      const result = await sendToTab<PriceResultMsg>(existingTabs[0].id, { type: 'EXTRACT_PRICE' })
      price = result?.price ?? null
      currency = result?.currency ?? currency
    } else {
      console.log(`[price-tracker] ${label}: opening background tab`)
      const tab = await new Promise<chrome.tabs.Tab>((resolve) => {
        browserAPI.tabs.create({ url: entry.url, active: false }, resolve)
      })
      if (tab.id == null) return

      await waitForTabLoad(tab.id, 10_000)
      const result = await sendToTab<PriceResultMsg>(tab.id, { type: 'EXTRACT_PRICE' })
      price = result?.price ?? null
      currency = result?.currency ?? currency

      browserAPI.tabs.remove(tab.id)
    }

    if (price === null) {
      console.warn(`[price-tracker] ${label}: price not detected`)
      return
    }

    const formatted = formatPrice(price, currency)
    if (entry.lastPrice !== null && price < entry.lastPrice) {
      console.log(`[price-tracker] ${label}: price DROP ${formatPrice(entry.lastPrice, entry.currency)} → ${formatted}`)
      await recordPriceDrop(productId, entry, price, currency)
    } else {
      const change = entry.lastPrice !== null && price !== entry.lastPrice
        ? ` (was ${formatPrice(entry.lastPrice, entry.currency)})`
        : ''
      console.log(`[price-tracker] ${label}: ${formatted}${change}`)
      const { maxHistoryRecords } = await getSettings()
      await appendPriceRecord(productId, {
        id: crypto.randomUUID(),
        productId,
        price,
        currency,
        detectedAt: new Date().toISOString(),
      }, maxHistoryRecords)
      await upsertProductCache(productId, { ...entry, lastPrice: price, currency })
      await updateProductLatestPrice(productId, price, currency)
    }
  } catch (err) {
    console.error(`[price-tracker] ${label}: check failed`, err)
  }
}

function waitForTabLoad(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs)

    function listener(id: number, info: { status?: string }) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer)
        browserAPI.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }

    browserAPI.tabs.onUpdated.addListener(listener)
  })
}

// ─── Price Drop Logic ─────────────────────────────────────────────────────────

async function recordPriceDrop(
  productId: string,
  entry: { url: string; title: string | null; lastPrice: number | null; currency: string },
  newPrice: number,
  currency: string,
) {
  const settings = await getSettings()

  await appendPriceRecord(productId, {
    id: crypto.randomUUID(),
    productId,
    price: newPrice,
    currency,
    detectedAt: new Date().toISOString(),
  }, settings.maxHistoryRecords)

  await upsertProductCache(productId, { ...entry, lastPrice: newPrice, currency })
  await updateProductLatestPrice(productId, newPrice, currency)
  await refreshProductListCache()

  if (settings.notificationsEnabled) {
    sendPriceDropNotification(productId, entry, newPrice, currency)
  }

  const count = await incrementBadgeCount()
  browserAPI.action.setBadgeText({ text: String(count) })
  browserAPI.action.setBadgeBackgroundColor({ color: '#E53E3E' })
}

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

function sendPriceDropNotification(
  productId: string,
  entry: { title: string | null; url: string; lastPrice: number | null; currency: string },
  newPrice: number,
  currency: string,
) {
  const oldFormatted = entry.lastPrice != null ? formatPrice(entry.lastPrice, entry.currency) : '?'
  const newFormatted = formatPrice(newPrice, currency)
  const title = entry.title ?? new URL(entry.url).hostname
  const hostname = (() => { try { return new URL(entry.url).hostname } catch { return entry.url } })()

  if (browserAPI.notifications?.create) {
    browserAPI.notifications.create(productId, {
      type: 'basic',
      iconUrl: browserAPI.runtime.getURL('icons/icon128.png'),
      title: 'Price Drop!',
      message: `${title}: ${oldFormatted} → ${newFormatted}`,
      contextMessage: hostname,
      buttons: [{ title: 'View Deal' }],
      requireInteraction: false,
      priority: 1,
    })
  }
}

if (browserAPI.notifications?.onClicked) {
  browserAPI.notifications.onClicked.addListener(async (notificationId) => {
    const index = await getProductIndex()
    const entry = index[notificationId]
    if (entry?.url) {
      browserAPI.tabs.create({ url: entry.url })
      browserAPI.notifications.clear(notificationId)
    }
  })
}

if (browserAPI.notifications?.onButtonClicked) {
  browserAPI.notifications.onButtonClicked.addListener(async (notificationId) => {
    const index = await getProductIndex()
    const entry = index[notificationId]
    if (entry?.url) {
      browserAPI.tabs.create({ url: entry.url })
      browserAPI.notifications.clear(notificationId)
    }
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function updateProductLatestPrice(
  productId: string,
  price: number,
  currency: string,
): Promise<void> {
  const products = await getProducts()
  if (products[productId]) {
    products[productId].latestPrice = price
    products[productId].currency = currency
    products[productId].priceDetectedAt = new Date().toISOString()
    await setProducts(products)
  }
}

async function refreshProductListCache() {
  const { products } = await handleGetTrackedProducts()
  await setCachedProductList(products)
}

function sendToTab<T>(tabId: number, message: ExtensionMessage): Promise<T | null> {
  return new Promise((resolve) => {
    browserAPI.tabs.sendMessage(tabId, message, (response) => {
      if (browserAPI.runtime.lastError) {
        resolve(null)
      } else {
        resolve(response as T)
      }
    })
  })
}

// Clear badge when popup opens
browserAPI.action.onClicked.addListener(() => {
  clearBadgeCount()
  browserAPI.action.setBadgeText({ text: '' })
})
