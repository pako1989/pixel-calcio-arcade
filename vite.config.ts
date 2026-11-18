import { defineConfig } from 'vitest/config';

// base relativa: funziona sia su GitHub Pages (/pixel-calcio-arcade/) sia in locale.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
    // la pagina sorgente è game.html: index.html nella radice è la build pubblicata
    rollupOptions: { input: 'game.html' },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
