// @ts-check
// Card images cached by the Service Worker (Workbox cache "tcgdex-images", vite.config.js).

export const IMAGE_CACHE = 'tcgdex-images';

/**
 * Number of cached images and the space used by the whole site (the browser doesn't give
 * the size of a single cache, and images are opaque responses).
 * @returns {Promise<{ images: number, usageMb: number | null }>}
 */
export async function imageCacheInfo() {
  let images = 0;
  try {
    if (await caches.has(IMAGE_CACHE)) images = (await (await caches.open(IMAGE_CACHE)).keys()).length;
  } catch {
    // Cache API unavailable (old browser, private mode).
  }
  let usageMb = null;
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.usage != null) usageMb = Math.round(est.usage / 1024 / 1024);
  } catch {
    // ignore
  }
  return { images, usageMb };
}

/** Deletes the cached images: they download again when shown. */
export async function clearImageCache() {
  try {
    await caches.delete(IMAGE_CACHE);
  } catch {
    // ignore
  }
}
