import { browserAPI } from './browserAPI'
import type { TrackedProduct, PriceRecord, Settings } from './messages'
import { DEFAULT_SETTINGS } from './messages'

// Typed wrappers around chrome.storage.local

export async function storageGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    browserAPI.storage.local.get(key, (result) => {
      resolve(result[key] as T | undefined)
    })
  })
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    browserAPI.storage.local.set({ [key]: value }, resolve)
  })
}

export async function storageRemove(key: string): Promise<void> {
  return new Promise((resolve) => {
    browserAPI.storage.local.remove(key, resolve)
  })
}

// Primary product store
const PRODUCTS_KEY = 'products'

export async function getProducts(): Promise<Record<string, TrackedProduct>> {
  return (await storageGet<Record<string, TrackedProduct>>(PRODUCTS_KEY)) ?? {}
}

export async function setProducts(products: Record<string, TrackedProduct>): Promise<void> {
  return storageSet(PRODUCTS_KEY, products)
}

// Price history store (newest-first, capped at 50 per product)
const PRICE_HISTORY_KEY = 'price_history'
const PRICE_HISTORY_MAX = 50

export async function getPriceHistoryForProduct(productId: string): Promise<PriceRecord[]> {
  const all = (await storageGet<Record<string, PriceRecord[]>>(PRICE_HISTORY_KEY)) ?? {}
  return all[productId] ?? []
}

export async function appendPriceRecord(productId: string, record: PriceRecord, maxRecords?: number): Promise<void> {
  const all = (await storageGet<Record<string, PriceRecord[]>>(PRICE_HISTORY_KEY)) ?? {}
  const existing = all[productId] ?? []
  all[productId] = [record, ...existing].slice(0, maxRecords ?? PRICE_HISTORY_MAX)
  return storageSet(PRICE_HISTORY_KEY, all)
}

export async function removeProductHistory(productId: string): Promise<void> {
  const all = (await storageGet<Record<string, PriceRecord[]>>(PRICE_HISTORY_KEY)) ?? {}
  delete all[productId]
  return storageSet(PRICE_HISTORY_KEY, all)
}

// Product index: { [productId]: { url, title, lastPrice, currency } }
// Kept in local storage so notification click handlers and CHECK_IF_TRACKED
// don't need to scan the full products store.
export interface ProductCacheEntry {
  url: string
  title: string | null
  lastPrice: number | null
  currency: string
}

export type ProductIndex = Record<string, ProductCacheEntry>

const PRODUCT_INDEX_KEY = 'product_index'

export async function getProductIndex(): Promise<ProductIndex> {
  return (await storageGet<ProductIndex>(PRODUCT_INDEX_KEY)) ?? {}
}

export async function setProductIndex(index: ProductIndex): Promise<void> {
  return storageSet(PRODUCT_INDEX_KEY, index)
}

export async function upsertProductCache(
  productId: string,
  entry: ProductCacheEntry,
): Promise<void> {
  const index = await getProductIndex()
  index[productId] = entry
  return setProductIndex(index)
}

export async function removeProductFromCache(productId: string): Promise<void> {
  const index = await getProductIndex()
  delete index[productId]
  return setProductIndex(index)
}

// Badge count
const BADGE_KEY = 'badge_count'

export async function getBadgeCount(): Promise<number> {
  return (await storageGet<number>(BADGE_KEY)) ?? 0
}

export async function incrementBadgeCount(): Promise<number> {
  const current = await getBadgeCount()
  const next = current + 1
  await storageSet(BADGE_KEY, next)
  return next
}

export async function clearBadgeCount(): Promise<void> {
  await storageSet(BADGE_KEY, 0)
}

// Settings
const SETTINGS_KEY = 'settings'

export async function getSettings(): Promise<Settings> {
  const stored = await storageGet<Partial<Settings>>(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()
  const updated = { ...current, ...partial }
  await storageSet(SETTINGS_KEY, updated)
  return updated
}

// Cached product list (for fast popup load)
const PRODUCT_LIST_KEY = 'product_list_cache'

export async function getCachedProductList(): Promise<TrackedProduct[]> {
  return (await storageGet<TrackedProduct[]>(PRODUCT_LIST_KEY)) ?? []
}

export async function setCachedProductList(products: TrackedProduct[]): Promise<void> {
  return storageSet(PRODUCT_LIST_KEY, products)
}
