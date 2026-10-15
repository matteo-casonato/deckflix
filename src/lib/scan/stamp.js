// @ts-check
// Play! Pokémon stamp on the photographed card (SPEC § 4.1, variants). A drawn geometric
// template finds where the stamp would be; only a template learned from one of the user's
// stamped cards (kept on this device, never in the repo) decides that it is there.
import {
  CARD_H,
  CARD_W,
  LEARNED_THRESHOLD,
  STAMP_H,
  STAMP_W,
  cropFeatures,
  features,
  findStamp,
  templateFromJSON,
  templateToJSON,
} from '../domain/stamp.js';

const KEY = 'deckflix-stamp-play';
/** Calibration made in the Phase 0 prototype, reused if present. */
const LAB_KEY = 'deckflix-lab-stamp-play';

/**
 * @param {CanvasImageSource} img
 * @param {number} w
 * @param {number} h
 */
function featuresOf(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d', { willReadFrequently: true }));
  ctx.drawImage(img, 0, 0, w, h);
  return features(ctx.getImageData(0, 0, w, h).data, w, h);
}

/** @type {import('../domain/stamp.js').Features | null} */
let drawn = null;

/** Rounded box, red top and dark bottom, ball top left, light silhouette. Not the logo. */
function drawnTemplate() {
  if (drawn) return drawn;
  const w = Math.round(STAMP_W * CARD_W * 4);
  const h = Math.round(STAMP_H * CARD_H * 4);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const light = '#e8e8e8';
  const dark = '#1c1c1c';
  x.fillStyle = light;
  x.beginPath();
  x.roundRect(0, 0, w, h, w * 0.08);
  x.fill();
  x.save();
  x.beginPath();
  x.roundRect(w * 0.05, w * 0.05, w * 0.9, h - w * 0.1, w * 0.06);
  x.clip();
  x.fillStyle = '#d42a2a';
  x.fillRect(0, 0, w, h * 0.55);
  x.fillStyle = dark;
  x.fillRect(0, h * 0.55, w, h);
  const bx = w * 0.24;
  const by = h * 0.4;
  const br = w * 0.17;
  x.fillStyle = light;
  x.beginPath();
  x.arc(bx, by, br, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#c42020';
  x.beginPath();
  x.arc(bx, by, br * 0.86, Math.PI, 0);
  x.fill();
  x.fillStyle = dark;
  x.fillRect(bx - br, by - br * 0.08, br * 2, br * 0.16);
  x.fillStyle = light;
  x.beginPath();
  x.arc(bx + br * 0.1, by, br * 0.28, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.arc(w * 0.7, h * 0.33, w * 0.095, 0, Math.PI * 2);
  x.fill();
  x.lineWidth = w * 0.09;
  x.lineCap = 'round';
  x.strokeStyle = light;
  x.beginPath();
  x.moveTo(w * 0.35, h * 0.22);
  x.lineTo(w * 0.55, h * 0.48);
  x.stroke();
  x.beginPath();
  x.ellipse(w * 0.66, h * 0.75, w * 0.17, h * 0.33, 0, 0, Math.PI * 2);
  x.fill();
  x.restore();
  drawn = featuresOf(c, Math.round(w / 4), Math.round(h / 4));
  return drawn;
}

function learnedTemplate() {
  try {
    return templateFromJSON(JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem(LAB_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

export const hasStampModel = () => !!learnedTemplate();

/**
 * @param {HTMLCanvasElement} cardCanvas
 * @returns {{ detected: boolean, learned: boolean, score: number, hit: ReturnType<typeof findStamp>, card: import('../domain/stamp.js').Features }}
 */
export function detectPlayStamp(cardCanvas) {
  const card = featuresOf(cardCanvas, CARD_W, CARD_H);
  const learned = learnedTemplate();
  const hit = findStamp(card, learned ?? drawnTemplate());
  return { detected: !!learned && hit.score >= LEARNED_THRESHOLD, learned: !!learned, score: hit.score, hit, card };
}

/**
 * Saves the stamp found on this card as the device's model ("Usa come modello del timbro").
 * @param {ReturnType<typeof detectPlayStamp>} result
 */
export function learnStamp(result) {
  const { hit, card } = result;
  const t = cropFeatures(card, Math.round(hit.x * CARD_W), Math.round(hit.y * CARD_H), Math.round(hit.w * CARD_W), Math.round(hit.h * CARD_H));
  try {
    localStorage.setItem(KEY, JSON.stringify(templateToJSON(t)));
  } catch {}
}
