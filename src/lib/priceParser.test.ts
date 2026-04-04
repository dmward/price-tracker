import { describe, it, expect } from 'vitest'
import { extractPrice } from './priceParser'

/**
 * Minimal DOM stub — just enough for querySelectorAll / querySelector / getAttribute / textContent.
 * Avoids pulling in jsdom for fast unit tests.
 */
function makeDoc(html: string): Document {
  // We need a real DOM for querySelector to work.  Vitest runs in Node by
  // default so we parse with the global DOMParser-like approach via a simple
  // fake.  Instead, we'll structure tests by testing normalizePrice indirectly
  // through helpers that build minimal document mocks.
  //
  // Since extractPrice needs a real Document, we'll use vitest's jsdom
  // environment for this file (see the config below) or build stub elements.
  //
  // For now: we construct a minimal object that satisfies the querySelectorAll
  // / querySelector interface used by priceParser.
  return buildFakeDocument(html)
}

interface FakeElement {
  tagName: string
  textContent: string | null
  parentElement: FakeElement | null
  attributes: Record<string, string>
  children: FakeElement[]
  getAttribute(name: string): string | null
  querySelector(selector: string): FakeElement | null
  querySelectorAll(selector: string): FakeElement[]
}

function buildFakeDocument(html: string): Document {
  // Parse simple scenarios: JSON-LD scripts, meta tags, and elements with classes
  const elements: FakeElement[] = []

  // Extract JSON-LD scripts
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = jsonLdRegex.exec(html)) !== null) {
    elements.push(fakeElement('script', match[1], { type: 'application/ld+json' }))
  }

  // Extract meta tags
  const metaRegex = /<meta\s+([^>]+)\/?>/gi
  while ((match = metaRegex.exec(html)) !== null) {
    const attrs: Record<string, string> = {}
    const attrRegex = /([\w-]+)="([^"]*)"/g
    let attrMatch
    while ((attrMatch = attrRegex.exec(match[1])) !== null) {
      attrs[attrMatch[1]] = attrMatch[2]
    }
    elements.push(fakeElement('meta', null, attrs))
  }

  // Extract generic elements with class/id/data attributes
  const elemRegex = /<(\w+)\s+([^>]+)>([\s\S]*?)<\/\1>/gi
  while ((match = elemRegex.exec(html)) !== null) {
    if (match[1] === 'script' || match[1] === 'meta') continue
    const attrs: Record<string, string> = {}
    const attrRegex = /([\w-]+)="([^"]*)"/g
    let attrMatch
    while ((attrMatch = attrRegex.exec(match[2])) !== null) {
      attrs[attrMatch[1]] = attrMatch[2]
    }
    const el = fakeElement(match[1], match[3], attrs)
    // Handle del/s wrapping for strikethrough detection
    if (match[1] === 'del' || match[1] === 's') {
      const innerMatch = /<(\w+)\s+([^>]+)>([\s\S]*?)<\/\1>/i.exec(match[3])
      if (innerMatch) {
        const innerAttrs: Record<string, string> = {}
        const innerAttrRegex = /([\w-]+)="([^"]*)"/g
        let innerAttrMatch
        while ((innerAttrMatch = innerAttrRegex.exec(innerMatch[2])) !== null) {
          innerAttrs[innerAttrMatch[1]] = innerAttrMatch[2]
        }
        const child = fakeElement(innerMatch[1], innerMatch[3], innerAttrs)
        child.parentElement = el
        el.children.push(child)
        elements.push(child)
      }
    }
    elements.push(el)
  }

  function matchesSelector(el: FakeElement, selector: string): boolean {
    // Handle compound selectors like 'ins .amount'
    if (selector.includes(' ')) {
      const parts = selector.split(/\s+/)
      // Only check last part against the element
      return matchesSelector(el, parts[parts.length - 1])
    }

    if (selector.startsWith('[') && selector.endsWith(']')) {
      const inner = selector.slice(1, -1)
      if (inner.includes('*=')) {
        const [attr, val] = inner.split('*=')
        const cleanVal = val.replace(/"/g, '')
        return (el.attributes[attr] ?? '').includes(cleanVal)
      }
      if (inner.includes('=')) {
        const [attr, val] = inner.split('=')
        const cleanVal = val.replace(/"/g, '')
        return el.attributes[attr] === cleanVal
      }
      return el.attributes[inner] !== undefined
    }

    if (selector.startsWith('.')) {
      const cls = selector.slice(1)
      return (el.attributes['class'] ?? '').split(/\s+/).includes(cls)
    }

    if (selector.startsWith('#')) {
      return el.attributes['id'] === selector.slice(1)
    }

    // tag[attr] compound
    const tagAttrMatch = selector.match(/^(\w+)\[([^\]]+)\]$/)
    if (tagAttrMatch) {
      if (el.tagName.toLowerCase() !== tagAttrMatch[1].toLowerCase()) return false
      return matchesSelector(el, `[${tagAttrMatch[2]}]`)
    }

    return el.tagName.toLowerCase() === selector.toLowerCase()
  }

  const doc = {
    querySelectorAll(selector: string): FakeElement[] {
      return elements.filter((el) => matchesSelector(el, selector))
    },
    querySelector(selector: string): FakeElement | null {
      return elements.find((el) => matchesSelector(el, selector)) ?? null
    },
  }

  return doc as unknown as Document
}

function fakeElement(
  tag: string,
  textContent: string | null,
  attrs: Record<string, string> = {},
): FakeElement {
  return {
    tagName: tag.toUpperCase(),
    textContent,
    parentElement: null,
    attributes: attrs,
    children: [],
    getAttribute(name: string) {
      return this.attributes[name] ?? null
    },
    querySelector() {
      return null
    },
    querySelectorAll() {
      return []
    },
  }
}

// ─── JSON-LD Tests ──────────────────────────────────────────────────────────

describe('extractPrice — JSON-LD', () => {
  it('extracts price from Product with Offer', () => {
    const doc = makeDoc(`
      <script type="application/ld+json">
        {"@type": "Product", "offers": {"@type": "Offer", "price": "29.99", "priceCurrency": "USD"}}
      </script>
    `)
    expect(extractPrice(doc)).toEqual({ price: 29.99, currency: 'USD' })
  })

  it('extracts price from Product with offers array', () => {
    const doc = makeDoc(`
      <script type="application/ld+json">
        {"@type": "Product", "offers": [
          {"@type": "AggregateOffer", "lowPrice": "10.00", "highPrice": "50.00", "priceCurrency": "USD"},
          {"@type": "Offer", "price": "24.99", "priceCurrency": "USD"}
        ]}
      </script>
    `)
    expect(extractPrice(doc)).toEqual({ price: 24.99, currency: 'USD' })
  })

  it('extracts price from @graph array', () => {
    const doc = makeDoc(`
      <script type="application/ld+json">
        {"@graph": [
          {"@type": "WebPage"},
          {"@type": "Product", "offers": {"@type": "Offer", "price": 149.00, "priceCurrency": "CAD"}}
        ]}
      </script>
    `)
    expect(extractPrice(doc)).toEqual({ price: 149, currency: 'CAD' })
  })

  it('extracts price from standalone Offer', () => {
    const doc = makeDoc(`
      <script type="application/ld+json">
        {"@type": "Offer", "price": "39.95", "priceCurrency": "GBP"}
      </script>
    `)
    expect(extractPrice(doc)).toEqual({ price: 39.95, currency: 'GBP' })
  })

  it('skips AggregateOffer lowPrice (range bound, not actual price)', () => {
    const doc = makeDoc(`
      <script type="application/ld+json">
        {"@type": "Product", "offers": {"@type": "AggregateOffer", "lowPrice": "10.00", "highPrice": "50.00", "priceCurrency": "USD"}}
      </script>
    `)
    // AggregateOffer with only lowPrice should not be used — but it has "price" fallback behavior
    // The parser skips lowPrice for AggregateOffer, so no result from JSON-LD
    expect(extractPrice(doc)).toBeNull()
  })

  it('handles numeric price value (not string)', () => {
    const doc = makeDoc(`
      <script type="application/ld+json">
        {"@type": "Product", "offers": {"@type": "Offer", "price": 99, "priceCurrency": "EUR"}}
      </script>
    `)
    expect(extractPrice(doc)).toEqual({ price: 99, currency: 'EUR' })
  })

  it('skips invalid JSON-LD gracefully', () => {
    const doc = makeDoc(`
      <script type="application/ld+json">not valid json</script>
    `)
    expect(extractPrice(doc)).toBeNull()
  })
})

// ─── Meta Tag Tests ─────────────────────────────────────────────────────────

describe('extractPrice — meta tags', () => {
  it('extracts from product:price:amount', () => {
    const doc = makeDoc(`
      <meta property="product:price:amount" content="59.99" />
      <meta property="product:price:currency" content="USD" />
    `)
    expect(extractPrice(doc)).toEqual({ price: 59.99, currency: 'USD' })
  })

  it('extracts from og:price:amount with currency', () => {
    const doc = makeDoc(`
      <meta property="og:price:amount" content="129.00" />
      <meta property="og:price:currency" content="CAD" />
    `)
    expect(extractPrice(doc)).toEqual({ price: 129, currency: 'CAD' })
  })

  it('falls back to USD when no currency meta', () => {
    const doc = makeDoc(`
      <meta property="product:price:amount" content="45.00" />
    `)
    expect(extractPrice(doc)).toEqual({ price: 45, currency: 'USD' })
  })
})

// ─── CSS Selector Tests ─────────────────────────────────────────────────────

describe('extractPrice — CSS selectors', () => {
  it('extracts from .product-price', () => {
    const doc = makeDoc(`
      <span class="product-price">$49.99</span>
    `)
    expect(extractPrice(doc)).toEqual({ price: 49.99, currency: 'USD' })
  })

  it('extracts from data-price attribute', () => {
    const doc = makeDoc(`
      <span data-price="199.99">$199.99</span>
    `)
    expect(extractPrice(doc)).toEqual({ price: 199.99, currency: 'USD' })
  })

  it('extracts from itemprop="price" content attribute', () => {
    const doc = makeDoc(`
      <span itemprop="price" content="79.99">$79.99</span>
    `)
    expect(extractPrice(doc)).toEqual({ price: 79.99, currency: 'USD' })
  })

  it('skips struck-through prices (del)', () => {
    const doc = makeDoc(`
      <del><span class="product-price">$99.99</span></del>
      <span class="sale-price">$69.99</span>
    `)
    expect(extractPrice(doc)).toEqual({ price: 69.99, currency: 'USD' })
  })
})

// ─── Price Normalization (tested through extractPrice) ──────────────────────

describe('price normalization', () => {
  it('handles euro format: 1.299,99 €', () => {
    const doc = makeDoc(`
      <meta property="product:price:amount" content="1.299,99" />
      <meta property="product:price:currency" content="EUR" />
    `)
    expect(extractPrice(doc)).toEqual({ price: 1299.99, currency: 'EUR' })
  })

  it('handles US format: $1,299.99', () => {
    const doc = makeDoc(`
      <span class="product-price">$1,299.99</span>
    `)
    expect(extractPrice(doc)).toEqual({ price: 1299.99, currency: 'USD' })
  })

  it('handles comma as decimal: 29,99', () => {
    const doc = makeDoc(`
      <meta property="product:price:amount" content="29,99" />
      <meta property="product:price:currency" content="EUR" />
    `)
    expect(extractPrice(doc)).toEqual({ price: 29.99, currency: 'EUR' })
  })

  it('handles comma as thousands: 1,299', () => {
    const doc = makeDoc(`
      <meta property="product:price:amount" content="1,299" />
    `)
    expect(extractPrice(doc)).toEqual({ price: 1299, currency: 'USD' })
  })

  it('handles currency prefix: €49.99', () => {
    const doc = makeDoc(`
      <span class="product-price">€49.99</span>
    `)
    expect(extractPrice(doc)).toEqual({ price: 49.99, currency: 'EUR' })
  })

  it('handles currency suffix: 49.99 EUR', () => {
    const doc = makeDoc(`
      <span class="product-price">49.99 EUR</span>
    `)
    expect(extractPrice(doc)).toEqual({ price: 49.99, currency: 'EUR' })
  })

  it('handles CA$ prefix', () => {
    const doc = makeDoc(`
      <span class="product-price">CA$79.99</span>
    `)
    expect(extractPrice(doc)).toEqual({ price: 79.99, currency: 'CAD' })
  })

  it('handles £ prefix', () => {
    const doc = makeDoc(`
      <span class="product-price">£199.99</span>
    `)
    expect(extractPrice(doc)).toEqual({ price: 199.99, currency: 'GBP' })
  })

  it('rejects zero price', () => {
    const doc = makeDoc(`
      <meta property="product:price:amount" content="0" />
    `)
    expect(extractPrice(doc)).toBeNull()
  })

  it('rejects price >= 1,000,000', () => {
    const doc = makeDoc(`
      <meta property="product:price:amount" content="1000000" />
    `)
    expect(extractPrice(doc)).toBeNull()
  })

  it('handles whole number prices', () => {
    const doc = makeDoc(`
      <meta property="product:price:amount" content="50" />
    `)
    expect(extractPrice(doc)).toEqual({ price: 50, currency: 'USD' })
  })
})

// ─── Strategy Priority ─────────────────────────────────────────────────────

describe('strategy priority', () => {
  it('prefers JSON-LD over meta tags', () => {
    const doc = makeDoc(`
      <script type="application/ld+json">
        {"@type": "Product", "offers": {"@type": "Offer", "price": "29.99", "priceCurrency": "USD"}}
      </script>
      <meta property="product:price:amount" content="39.99" />
    `)
    expect(extractPrice(doc)).toEqual({ price: 29.99, currency: 'USD' })
  })

  it('falls back to meta when no JSON-LD', () => {
    const doc = makeDoc(`
      <meta property="product:price:amount" content="39.99" />
    `)
    expect(extractPrice(doc)).toEqual({ price: 39.99, currency: 'USD' })
  })

  it('falls back to CSS when no structured data', () => {
    const doc = makeDoc(`
      <span class="product-price">$19.99</span>
    `)
    expect(extractPrice(doc)).toEqual({ price: 19.99, currency: 'USD' })
  })

  it('returns null when no price found', () => {
    const doc = makeDoc(`<div>No price here</div>`)
    expect(extractPrice(doc)).toBeNull()
  })
})
