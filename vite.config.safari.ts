import { defineConfig } from 'vite'

// Builds a single self-contained service worker bundle for Safari.
// Safari MV3 has unreliable support for ES module service workers with
// inter-chunk imports. This config produces one IIFE file with all
// dependencies inlined — no import/export statements.
export default defineConfig({
  build: {
    outDir: 'dist-safari-worker',
    emptyOutDir: true,
    lib: {
      entry: 'src/background/worker.ts',
      formats: ['iife'],
      name: 'PriceTrackerWorker',
      fileName: () => 'worker.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: false,
  },
})
