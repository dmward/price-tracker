import { browserAPI } from '../lib/browserAPI'
import { extractPrice } from '../lib/priceParser'
import type {
  ExtensionMessage,
  PriceResultMsg,
  PageMetaMsg,
  TrackedStatusMsg,
} from '../lib/messages'

function notifyBackground(): void {
  const url = window.location.href
  browserAPI.runtime.sendMessage<ExtensionMessage, TrackedStatusMsg>(
    { type: 'CHECK_IF_TRACKED', url },
    (response) => {
      if (browserAPI.runtime.lastError) return
      if (response?.isTracked) {
        const extracted = extractPrice(document)
        const msg: PriceResultMsg = {
          type: 'PRICE_RESULT',
          price: extracted?.price ?? null,
          currency: extracted?.currency ?? 'USD',
          url,
        }
        browserAPI.runtime.sendMessage(msg)
      }
    },
  )
}

function getPageImage(): string | null {
  const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')
  if (ogImage?.content) return ogImage.content

  const scripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (const script of Array.from(scripts)) {
    try {
      const data = JSON.parse(script.textContent ?? '')
      const nodes = Array.isArray(data) ? data : [data]
      for (const node of nodes) {
        if (node['@type'] === 'Product') {
          const img = node['image']
          if (typeof img === 'string') return img
          if (Array.isArray(img) && img.length > 0) return img[0]
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return null
}

function setup() {
  // Listen for messages from the background or popup
  browserAPI.runtime.onMessage.addListener(
    (message: ExtensionMessage, _sender, sendResponse) => {
      if (message.type === 'EXTRACT_PRICE') {
        const extracted = extractPrice(document)
        const response: PriceResultMsg = {
          type: 'PRICE_RESULT',
          price: extracted?.price ?? null,
          currency: extracted?.currency ?? 'USD',
          url: window.location.href,
        }
        sendResponse(response)
        return false
      }

      if (message.type === 'GET_PAGE_META') {
        const response: PageMetaMsg = {
          type: 'PAGE_META',
          title: document.title,
          imageUrl: getPageImage(),
          url: window.location.href,
        }
        sendResponse(response)
        return false
      }

      return false
    },
  )

  // Kick off the passive check after the page is idle
  if (document.readyState === 'complete') {
    notifyBackground()
  } else {
    window.addEventListener('load', notifyBackground)
  }
}

// crxjs v2 loader pattern: onExecute is called from the content script
// loader IIFE in the page's isolated world (where document is available).
export function onExecute() {
  setup()
}
