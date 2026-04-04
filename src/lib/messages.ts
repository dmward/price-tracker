// Discriminated union of all messages passed between popup, background, and content scripts.

// Popup → Background
export type TrackProductMsg = { type: 'TRACK_PRODUCT' }
export type UntrackProductMsg = { type: 'UNTRACK_PRODUCT'; productId: string }
export type GetTrackedProductsMsg = { type: 'GET_TRACKED_PRODUCTS' }
export type GetPriceHistoryMsg = { type: 'GET_PRICE_HISTORY'; productId: string }
export type ScanPricesMsg = { type: 'SCAN_PRICES' }
export type GetSettingsMsg = { type: 'GET_SETTINGS' }
export type UpdateSettingsMsg = { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }

// Background → Content (via chrome.tabs.sendMessage)
export type ExtractPriceMsg = { type: 'EXTRACT_PRICE' }
export type GetPageMetaMsg = { type: 'GET_PAGE_META' }
export type CheckIfTrackedMsg = { type: 'CHECK_IF_TRACKED'; url: string }

// Content → Background (responses / proactive sends)
export type PriceResultMsg = {
  type: 'PRICE_RESULT'
  price: number | null
  currency: string
  url: string
}
export type PageMetaMsg = {
  type: 'PAGE_META'
  title: string
  imageUrl: string | null
  url: string
}
export type TrackedStatusMsg = {
  type: 'TRACKED_STATUS'
  isTracked: boolean
  productId?: string
}

export type ExtensionMessage =
  | TrackProductMsg
  | UntrackProductMsg
  | GetTrackedProductsMsg
  | GetPriceHistoryMsg
  | ScanPricesMsg
  | GetSettingsMsg
  | UpdateSettingsMsg
  | ExtractPriceMsg
  | GetPageMetaMsg
  | CheckIfTrackedMsg
  | PriceResultMsg
  | PageMetaMsg
  | TrackedStatusMsg

// Response types keyed by request type
export interface MessageResponseMap {
  TRACK_PRODUCT: { success: boolean; error?: string; productId?: string }
  UNTRACK_PRODUCT: { success: boolean; error?: string }
  GET_TRACKED_PRODUCTS: { products: TrackedProduct[] }
  GET_PRICE_HISTORY: { history: PriceRecord[] }
  SCAN_PRICES: { success: boolean; checked: number; scannedAt?: string }
  GET_SETTINGS: { settings: Settings }
  UPDATE_SETTINGS: { success: boolean }
  EXTRACT_PRICE: PriceResultMsg
  GET_PAGE_META: PageMetaMsg
  CHECK_IF_TRACKED: TrackedStatusMsg
}

// Shared data shapes
export interface TrackedProduct {
  id: string
  url: string
  title: string | null
  imageUrl: string | null
  latestPrice: number | null
  currency: string
  createdAt: string
  priceDetectedAt: string | null
}

export interface PriceRecord {
  id: string
  productId: string
  price: number
  currency: string
  detectedAt: string
}

export interface Settings {
  scanIntervalMinutes: number
  notificationsEnabled: boolean
  maxHistoryRecords: number
}

export const DEFAULT_SETTINGS: Settings = {
  scanIntervalMinutes: 30,
  notificationsEnabled: true,
  maxHistoryRecords: 50,
}
