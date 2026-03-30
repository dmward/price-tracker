import { browserAPI } from './browserAPI'
import type { TrackedProduct } from './messages'

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

// Auth session
export interface StoredSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export const AUTH_KEY = 'auth_session'

export async function getStoredSession(): Promise<StoredSession | undefined> {
  return storageGet<StoredSession>(AUTH_KEY)
}

export async function setStoredSession(session: StoredSession): Promise<void> {
  return storageSet(AUTH_KEY, session)
}

export async function clearStoredSession(): Promise<void> {
  return storageRemove(AUTH_KEY)
}

// Product index: { [productId]: { url, title, lastPrice, currency } }
// Kept in local storage so notification click handlers don't need a Supabase round-trip.
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

// Cached product list (for fast popup load)
const PRODUCT_LIST_KEY = 'product_list_cache'

export async function getCachedProductList(): Promise<TrackedProduct[]> {
  return (await storageGet<TrackedProduct[]>(PRODUCT_LIST_KEY)) ?? []
}

export async function setCachedProductList(products: TrackedProduct[]): Promise<void> {
  return storageSet(PRODUCT_LIST_KEY, products)
}
