// @ts-check
// Reads number, set code, language and name from a card image (SPEC § 4.1).
// Main engine: Google on-device text recognition through Chrome's TextDetector (Play
// Services / ML Kit on Android; needs the "Experimental Web Platform features" flag).
// Fallback: Tesseract.js, which runs in its own Web Worker and is loaded only when needed.
import { detectLanguage, parseCollectorNumber, parseSetCode, parseSpecialNumber } from '../domain/recognize.js';

export const hasGoogleOcr = typeof window !== 'undefined' && 'TextDetector' in window;

/** Zones of the card, as fractions of its height. */
const TOP_END = 0.13;
const BOTTOM_START = 0.87;
const CORNERS = [
  { x0: 0, x1: 0.45 },
  { x0: 0.55, x1: 1 },
];

/**
 * @typedef {{ number: number, total: number } | null} Num
 * @typedef {{ num: Num, special?: { code: string, raw: string } | null, setCode: string | null, lang: import('../domain/recognize.js').Lang | null, nameText: string, text: string, engine: 'google' | 'tesseract' }} Reading
 */

/**
 * @param {HTMLCanvasElement} card
 * @param {Set<number> | null} totals known set sizes, to reject impossible readings
 * @returns {Promise<Reading>}
 */
export async function readCard(card, totals) {
  const r = hasGoogleOcr ? await readGoogle(card, totals) : await readTesseract(card, totals);
  const { lang } = detectLanguage(r.text);
  return { ...r, lang, setCode: parseSetCode(r.bottom) ?? parseSetCode(r.text) };
}

// ---------- Google (TextDetector) ----------

/**
 * One pass on the whole card; blocks split by position into top (name, HP) and bottom
 * (number, set code). Missing number: retry on enlarged bottom corners.
 * @param {HTMLCanvasElement} card
 * @param {Set<number> | null} totals
 */
async function readGoogle(card, totals) {
  // @ts-ignore -- TextDetector is not in the DOM typings yet
  const detector = new TextDetector();
  /** @type {{ rawValue: string, boundingBox: DOMRectReadOnly }[]} */
  const blocks = await detector.detect(card);
  const lines = blocks
    .map((b) => ({ text: b.rawValue, y0: b.boundingBox.y / card.height, y1: (b.boundingBox.y + b.boundingBox.height) / card.height }))
    .sort((a, b) => a.y0 - b.y0);
  const text = lines.map((l) => l.text).join('\n');
  const bottom = lines.filter((l) => l.y1 > BOTTOM_START).map((l) => l.text).join('\n');
  let num = parseCollectorNumber(bottom, totals) ?? parseCollectorNumber(text, totals);
  // Gallery and promo cards print "TG25/TG30" or "SWSH302" instead of "025/165".
  let special = num ? null : (parseSpecialNumber(bottom) ?? parseSpecialNumber(text));
  for (const c of CORNERS) {
    if (num || special) break;
    const found = await detector.detect(prepare(card, BOTTOM_START, 1, c.x0, c.x1, {}));
    const cornerText = found.map((/** @type {any} */ b) => b.rawValue).join('\n');
    num = parseCollectorNumber(cornerText, totals);
    special = num ? null : parseSpecialNumber(cornerText);
  }
  // Google reads the whole card: the name can be anywhere in the text (photos with margins).
  return { num, special, nameText: text, text, bottom, engine: /** @type {const} */ ('google') };
}

// ---------- Tesseract fallback ----------

/** @type {Promise<any> | null} */
let worker = null;

function getWorker() {
  worker ??= import('tesseract.js').then(({ createWorker }) => createWorker(['eng']));
  return worker;
}

/**
 * Digits-only passes on each bottom corner (grey, inverted, local threshold), then the
 * full text of the top and bottom strips for name, language and set code.
 * @param {HTMLCanvasElement} card
 * @param {Set<number> | null} totals
 */
async function readTesseract(card, totals) {
  const w = await getWorker();
  await w.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '0123456789/' });
  /** @type {Num} */
  let num = null;
  outer: for (const look of [{}, { invert: true }, { adaptive: true }, { adaptive: true, invert: true }]) {
    for (const c of CORNERS) {
      num = parseCollectorNumber((await w.recognize(prepare(card, BOTTOM_START, 1, c.x0, c.x1, look))).data.text, totals);
      if (num) break outer;
    }
  }
  await w.setParameters({ tessedit_char_whitelist: '' });
  let top = '';
  let bottom = '';
  if (num) {
    bottom = (await w.recognize(prepare(card, BOTTOM_START, 1, 0, 1, {}))).data.text;
    await w.setParameters({ tessedit_pageseg_mode: '6' });
    top = (await w.recognize(prepare(card, 0, TOP_END, 0, 1, {}))).data.text;
  }
  return { num, nameText: top, text: `${top}\n${bottom}`, bottom, engine: /** @type {const} */ ('tesseract') };
}

// ---------- image preparation ----------

/** Crops are resized so the collector number (~1.8% of the card height) is ~48 px tall. */
const NUMBER_HEIGHT_RATIO = 0.018;
const TARGET_TEXT_PX = 48;

/**
 * Grey crop of a card region, enlarged for OCR, optionally inverted or locally thresholded.
 * @param {HTMLCanvasElement} card
 * @param {number} y0
 * @param {number} y1
 * @param {number} x0
 * @param {number} x1
 * @param {{ invert?: boolean, adaptive?: boolean }} o
 */
function prepare(card, y0, y1, x0, x1, o) {
  const sx = Math.round(card.width * x0);
  const sw = Math.max(1, Math.round(card.width * (x1 - x0)));
  const sy = Math.round(card.height * y0);
  const sh = Math.max(1, Math.round(card.height * (y1 - y0)));
  const k = Math.max(0.5, Math.min(4, TARGET_TEXT_PX / (card.height * NUMBER_HEIGHT_RATIO)));
  const out = document.createElement('canvas');
  out.width = Math.round(sw * k);
  out.height = Math.round(sh * k);
  const ctx = /** @type {CanvasRenderingContext2D} */ (out.getContext('2d', { willReadFrequently: true }));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(card, sx, sy, sw, sh, 0, 0, out.width, out.height);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const grey = new Uint8ClampedArray(d.length / 4);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) grey[p] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] - 128) * 1.2 + 128;
  const bin = o.adaptive ? adaptiveThreshold(grey, out.width, out.height) : null;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let v = bin ? bin[p] : grey[p];
    if (o.invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/**
 * Bradley local threshold: copes with holo foil and uneven light.
 * @param {Uint8ClampedArray} grey
 * @param {number} w
 * @param {number} h
 */
function adaptiveThreshold(grey, w, h) {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += grey[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.max(4, Math.round(h / 4));
  const out = new Uint8ClampedArray(grey.length);
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r);
    const yb = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r);
      const xb = Math.min(w, x + r + 1);
      const sum = integral[yb * (w + 1) + xb] - integral[ya * (w + 1) + xb] - integral[yb * (w + 1) + xa] + integral[ya * (w + 1) + xa];
      out[y * w + x] = grey[y * w + x] < (sum / ((xb - xa) * (yb - ya))) * 0.85 ? 0 : 255;
    }
  }
  return out;
}
