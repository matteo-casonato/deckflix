// @ts-check
// Recognition by the drawing (SPEC § 4.1): fingerprints of the photo and of TCGdex thumbnails,
// and the weekly index of every card's fingerprint published next to the app.
import { fingerprint } from '../domain/fingerprint.js';

/**
 * Fingerprint of a card photo (the canvas holds the card, edge to edge).
 * @param {HTMLCanvasElement} canvas
 */
export function photoFingerprint(canvas) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return fingerprint(data, width, height);
}

/** @type {Map<string, Promise<string | null>>} */
const thumbs = new Map();

/**
 * Fingerprint of a card's TCGdex thumbnail, or null when it can't be read. It uses low.png,
 * the file the index is built from: the app's <img> load low.webp without CORS, and the
 * service worker keeps those opaque copies, which a page can't read.
 * @param {string | null | undefined} imageBase the card's `image` field
 */
export function thumbFingerprint(imageBase) {
  if (!imageBase?.startsWith('https://assets.tcgdex.net/')) return Promise.resolve(null);
  let p = thumbs.get(imageBase);
  if (!p) {
    p = (async () => {
      const res = await fetch(`${imageBase}/low.png`, { mode: 'cors' });
      if (!res.ok) return null;
      const bitmap = await createImageBitmap(await res.blob());
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return fingerprint(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    })().catch(() => null);
    thumbs.set(imageBase, p);
  }
  return p;
}

/**
 * Runs `fn` on every item, `limit` at a time.
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function mapLimited(items, limit, fn) {
  const out = /** @type {R[]} */ (new Array(items.length));
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** @typedef {{ v: number, generatedAt: number, ids: string[], h: string[] }} ArtIndex */

/** @type {Promise<ArtIndex | null> | null} */
let index = null;

/**
 * The fingerprint index (fingerprints.json, built weekly by the deploy workflow), or null when
 * it isn't published yet or the phone is offline. Downloaded once per session.
 * @returns {Promise<ArtIndex | null>}
 */
export function artIndex() {
  if (!index) {
    index = fetch(`${import.meta.env.BASE_URL}fingerprints.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.ids?.length && j.ids.length === j.h?.length ? j : null))
      .catch(() => null);
    // Try again next time when it failed (offline now, online later).
    index.then((j) => {
      if (!j) index = null;
    });
  }
  return index;
}
