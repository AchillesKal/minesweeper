import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * `npm run build`        installable, offline-capable site in dist/
 * `npm run build:single` one self-contained HTML file in dist-single/ (no service worker)
 */
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    build: { outDir: single ? 'dist-single' : 'dist', target: 'es2022' },
    worker: { format: 'es' },
    plugins: single
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'Minesweeper',
              short_name: 'Minesweeper',
              description: 'Minesweeper with no-guess boards and a daily puzzle.',
              theme_color: '#3448d6',
              background_color: '#3448d6',
              display: 'standalone',
              orientation: 'any',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
          }),
        ],
  };
});
