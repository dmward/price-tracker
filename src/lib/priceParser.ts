// Pure price extraction function — no browser API dependencies, fully unit-testable.

export interface ExtractedPrice {
  price: number
  currency: string
}

// Currency symbol → ISO 4217 code
const SYMBOL_MAP: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  '₩': 'KRW',
  '₪': 'ILS',
  '₺': 'TRY',
  '₽': 'RUB',
  'A$': 'AUD',
  'CA$': 'CAD',
  'NZ$': 'NZD',
  'HK$': 'HKD',
  'S$': 'SGD',
  'CHF': 'CHF',
  'kr': 'SEK',
}

function symbolToCurrency(symbol: string): string {
  return SYMBOL_MAP[symbol.trim()] ?? 'USD'
}

/**
 * Normalize a raw price string like "$1,299.99" or "1.299,99 €" into a number.
 * Returns null if parsing fails.
 */
function normalizePrice(raw: string): { price: number; currency: string } | null {
  if (!raw) return null

  // Extract currency prefix/suffix
  let currency = 'USD'
  let cleaned = raw.trim()

  // Try multi-char currency codes first (CA$, NZ$, A$, S$, HK$, CHF, kr)
  const multiCharMatch = cleaned.match(/^(CA\$|NZ\$|A\$|S\$|HK\$|CHF|kr)\s*/)
  if (multiCharMatch) {
    currency = symbolToCurrency(multiCharMatch[1])
    cleaned = cleaned.slice(multiCharMatch[0].length)
  } else {
    // Try single-char prefix symbols
    const prefixMatch = cleaned.match(/^([$€£¥₹₩₪₺₽])\s*/)
    if (prefixMatch) {
      currency = symbolToCurrency(prefixMatch[1])
      cleaned = cleaned.slice(prefixMatch[0].length)
    } else {
      // Try suffix symbols/codes
      const suffixMatch = cleaned.match(/\s*([$€£¥₹₩₪₺₽]|USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|INR|KRW)$/)
      if (suffixMatch) {
        const sym = suffixMatch[1]
        currency = sym.length === 1 ? symbolToCurrency(sym) : sym
        cleaned = cleaned.slice(0, -suffixMatch[0].length)
      }
    }
  }

  // Remove any remaining alphabetic characters
  cleaned = cleaned.replace(/[a-zA-Z]/g, '').trim()

  // Detect decimal separator: if both '.' and ',' present, rightmost is decimal
  const hasDot = cleaned.includes('.')
  const hasComma = cleaned.includes(',')

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.')
    const lastComma = cleaned.lastIndexOf(',')
    if (lastDot > lastComma) {
      // "1,299.99" — comma is thousands
      cleaned = cleaned.replace(/,/g, '')
    } else {
      // "1.299,99" — dot is thousands
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    }
  } else if (hasComma && !hasDot) {
    // Ambiguous: "1,299" could be thousands or "1,99" could be decimal
    const parts = cleaned.split(',')
    if (parts.length === 2 && parts[1].length !== 3) {
      // Likely decimal: "29,99"
      cleaned = cleaned.replace(',', '.')
    } else {
      // Likely thousands: "1,299"
      cleaned = cleaned.replace(/,/g, '')
    }
  }

  const price = parseFloat(cleaned)
  if (isNaN(price) || price <= 0 || price >= 1_000_000) return null

  return { price: Math.round(price * 100) / 100, currency }
}

// --- Strategy 1: JSON-LD ---

function extractFromJsonLd(document: Document): ExtractedPrice | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')

  for (const script of Array.from(scripts)) {
    let data: unknown
    try {
      data = JSON.parse(script.textContent ?? '')
    } catch {
      continue
    }

    // Handle @graph arrays
    const nodes: unknown[] = Array.isArray(data)
      ? data
      : (data as { '@graph'?: unknown[] })['@graph'] ?? [data]

    for (const node of nodes) {
      const n = node as Record<string, unknown>
      const type = n['@type']

      let offerNode: Record<string, unknown> | null = null

      if (type === 'Product' || type === 'IndividualProduct') {
        const offers = n['offers']
        if (offers && typeof offers === 'object') {
          if (Array.isArray(offers)) {
            // Prefer a specific Offer over AggregateOffer (which only has a price range)
            offerNode = (offers.find(
              (o) => (o as Record<string, unknown>)['@type'] === 'Offer',
            ) ?? offers[0]) as Record<string, unknown>
          } else {
            offerNode = offers as Record<string, unknown>
          }
        }
      } else if (type === 'Offer') {
        offerNode = n
      }
      // Skip standalone AggregateOffer — lowPrice/highPrice are range bounds, not the actual price

      if (offerNode) {
        const isAggregate = offerNode['@type'] === 'AggregateOffer'
        // Don't use lowPrice for AggregateOffer — it's the cheapest variant, not the listed price
        const rawPrice = offerNode['price'] ?? (isAggregate ? null : offerNode['lowPrice'])
        const rawCurrency = offerNode['priceCurrency'] as string | undefined

        if (rawPrice != null) {
          const normalized = normalizePrice(String(rawPrice))
          if (normalized) {
            if (rawCurrency && rawCurrency.length === 3) {
              normalized.currency = rawCurrency.toUpperCase()
            }
            return normalized
          }
        }
      }
    }
  }

  return null
}

// --- Strategy 2: Open Graph / meta tags ---

function extractFromMeta(document: Document): ExtractedPrice | null {
  const selectors = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[name="price"]',
    'meta[itemprop="price"]',
  ]
  const currencySelectors = [
    'meta[property="product:price:currency"]',
    'meta[property="og:price:currency"]',
    'meta[name="currency"]',
    'meta[itemprop="priceCurrency"]',
  ]

  for (const sel of selectors) {
    const el = document.querySelector(sel)
    const raw = el?.getAttribute('content')
    if (raw) {
      const normalized = normalizePrice(raw)
      if (normalized) {
        // Try to find explicit currency meta
        for (const csel of currencySelectors) {
          const cel = document.querySelector(csel)
          const cur = cel?.getAttribute('content')
          if (cur && cur.length === 3) {
            normalized.currency = cur.toUpperCase()
            break
          }
        }
        return normalized
      }
    }
  }

  return null
}

// --- Strategy 3: CSS selector fallback ---

// Selectors ordered so sale/current price comes before regular/original price.
const CSS_SELECTORS = [
  // Sale / special price first (most specific)
  '.sale-price',
  '.special-price',
  '.price-sale',
  '[class*="sale-price"]',
  '[class*="special-price"]',
  // WooCommerce: ins = current price, del = crossed-out old price
  'ins .woocommerce-Price-amount',
  'ins .amount',
  // Amazon
  '.a-price .a-offscreen',
  '#priceblock_ourprice',
  '#priceblock_dealprice',
  '.a-price[data-a-color="base"] .a-offscreen',
  // Home Depot (CA + US)
  '.price-format__main-price',
  '[class*="price-format__main-price"]',
  '[data-testid="price-format__main-price"]',
  // Best Buy
  '[data-automation="product-price"]',
  '.priceView-customer-price span',
  // Shopify themes
  '.product-price__value',
  '.product__price',
  '.price--withoutTax',
  // Generic current/active price
  '.current-price',
  '.pdp-price .price-value',
  '[class*="price"][class*="current"]',
  // Structured microdata — content attribute (e.g. Home Depot, Best Buy)
  '[itemprop="price"][content]',
  '[itemprop="offers"] [itemprop="price"][content]',
  // Structured microdata — text fallback
  '[itemprop="price"]',
  '[itemprop="offers"] [itemprop="price"]',
  // Generic fallback
  '.product-price',
  '.regular-price',
  '[data-price]',
  '[class*="price"][class*="sale"]',
  '[id*="price"]',
]

/** Returns true if the element is inside a <del> or <s> (struck-through = old price). */
function isStrikethrough(el: Element): boolean {
  let node: Element | null = el
  while (node) {
    const tag = node.tagName.toLowerCase()
    if (tag === 'del' || tag === 's') return true
    node = node.parentElement
  }
  return false
}

function extractFromCSS(document: Document): ExtractedPrice | null {
  for (const selector of CSS_SELECTORS) {
    const el = document.querySelector(selector)
    if (!el || isStrikethrough(el)) continue

    // Try data-price attribute first (often already numeric)
    const dataPrice = el.getAttribute('data-price') ?? el.getAttribute('content')
    const rawText = dataPrice ?? el.textContent

    if (rawText) {
      const normalized = normalizePrice(rawText.trim())
      if (normalized) return normalized
    }
  }

  return null
}

// --- Main export ---

export function extractPrice(document: Document): ExtractedPrice | null {
  return (
    extractFromJsonLd(document) ??
    extractFromMeta(document) ??
    extractFromCSS(document)
  )
}
