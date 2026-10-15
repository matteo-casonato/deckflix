// @ts-check
// Service Worker registration (vite-plugin-pwa, registerType "prompt"): the app shows
// "Nuova versione disponibile · Aggiorna" instead of updating behind the user's back.
import { registerSW } from 'virtual:pwa-register';

export const pwa = $state({
  /** A new version is waiting. */
  needRefresh: false,
  /** The app shell is cached: it opens without network. */
  offlineReady: false,
});

/** @type {((reload?: boolean) => Promise<void>) | null} */
let updateSW = null;

export function initPwa() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  updateSW = registerSW({
    onNeedRefresh() {
      pwa.needRefresh = true;
    },
    onOfflineReady() {
      pwa.offlineReady = true;
    },
    // Check for a new version every hour while the app stays open.
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
}

export function applyUpdate() {
  pwa.needRefresh = false;
  return updateSW?.(true);
}
