import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

// base relativa: funziona sia su GitHub Pages (/pixel-calcio-arcade/) sia in locale.
/**
 * Il manifest deve restare nella radice (./manifest.webmanifest): se Vite lo
 * sposta in assets/, start_url e scope diventano .../assets/ e le icone non si
 * trovano, quindi Chrome dice "Questa app non può essere installata".
 */
const manifestInRoot: Plugin = {
  name: 'manifest-in-root',
  apply: 'build',
  enforce: 'post',
  generateBundle(_opts, bundle) {
    for (const [name, out] of Object.entries(bundle)) {
      if (/manifest-.*\.webmanifest$/.test(name)) delete bundle[name];
      else if (name.endsWith('.html') && out.type === 'asset') {
        out.source = String(out.source).replace(/href="[^"]*manifest[^"]*\.webmanifest"/, 'href="./manifest.webmanifest"');
      }
    }
  },
};

export default defineConfig({
  base: './',
  plugins: [manifestInRoot],
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
