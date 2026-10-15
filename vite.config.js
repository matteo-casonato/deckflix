// @ts-check
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Local HTTPS for testing the camera from a phone on the same Wi-Fi.
// Certificates are created with mkcert into .certs/ (see README).
const certDir = resolve(import.meta.dirname, '.certs');
const https = existsSync(resolve(certDir, 'cert.pem'))
  ? { cert: readFileSync(resolve(certDir, 'cert.pem')), key: readFileSync(resolve(certDir, 'key.pem')) }
  : undefined;

const DAY = 24 * 60 * 60;

export default defineConfig({
  base: '/deckflix/',
  plugins: [
    svelte(),
    VitePWA({
      // The app asks before updating: "Nuova versione disponibile · Aggiorna".
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png', 'fonts/*.woff2'],
      manifest: {
        id: '/deckflix/',
        name: 'Deckflix',
        short_name: 'Deckflix',
        description: 'Le tue carte Pokémon: collezione, valore e deck.',
        lang: 'it',
        start_url: '/deckflix/#/home',
        scope: '/deckflix/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F1115',
        theme_color: '#0F1115',
        categories: ['entertainment', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only: the Phase 0 scan lab (and its OCR) stays out of the precache.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        globIgnores: ['lab/**', 'assets/scanLab-*', 'icons/*.svg'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/lab\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Card images: they never change, keep them (SPEC: CacheFirst).
            urlPattern: ({ url }) => url.hostname === 'assets.tcgdex.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'tcgdex-images',
              // <img> requests are opaque (status 0): allowed, Workbox pads them in the quota.
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 3000, maxAgeSeconds: 180 * DAY, purgeOnQuotaError: true },
            },
          },
          {
            // API responses: network first, cached copy when the network fails or is slow.
            // Not StaleWhileRevalidate: Dexie already caches with its own expiry, and serving an
            // old response first would make the app store days-old prices as fresh.
            urlPattern: ({ url }) => url.hostname === 'api.tcgdex.net',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tcgdex-api',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 600, maxAgeSeconds: 7 * DAY, purgeOnQuotaError: true },
            },
          },
        ],
      },
    }),
  ],
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  server: { https },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        scanLab: resolve(import.meta.dirname, 'lab/scan/index.html'),
      },
    },
  },
});
