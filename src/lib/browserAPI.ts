// Polyfill: Safari exposes `browser.*`, Chrome exposes `chrome.*`.
// In service worker contexts, globals are on `self` rather than the window scope,
// so we check `self.browser` and `self.chrome` explicitly to avoid ReferenceErrors.
declare const browser: typeof chrome | undefined

const _self = (typeof self !== 'undefined' ? self : globalThis) as typeof globalThis & {
  browser?: typeof chrome
  chrome?: typeof chrome
}

export const browserAPI: typeof chrome =
  _self.browser ?? _self.chrome ?? (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : undefined as unknown as typeof chrome))
