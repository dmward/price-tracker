// Polyfill: Safari uses `browser.*`, Chrome uses `chrome.*`
// Using `chrome` directly works in both when the extension polyfill is present,
// but Safari's native WebExtension runtime exposes `browser` first.
declare const browser: typeof chrome | undefined

export const browserAPI: typeof chrome =
  typeof browser !== 'undefined' ? browser : chrome
