// @ts-check
import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Local HTTPS for testing the camera from a phone on the same Wi-Fi.
// Certificates are created with mkcert into .certs/ (see README).
const certDir = resolve(import.meta.dirname, '.certs');
const https = existsSync(resolve(certDir, 'cert.pem'))
  ? { cert: readFileSync(resolve(certDir, 'cert.pem')), key: readFileSync(resolve(certDir, 'key.pem')) }
  : undefined;

export default defineConfig({
  base: '/deckflix/',
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
