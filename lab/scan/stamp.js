// @ts-check
// Play! Pokémon stamp detection by template matching.
// The stamp is printed on the lower edge of the artwork: on the left for Pokémon,
// on the right for Trainers. A geometric drawing of it (not a copy of the logo) is
// good enough to locate it; a template cut from the user's own stamped card, kept
// only on the device, is what makes the decision reliable.
// Measured on real crops (15/10/2026): learned template 0.66–0.90 on stamped cards,
// at most 0.53 on 23 official scans without stamp. Drawn template: 0.41–0.54 vs 0.41.

/** Working size of the card (63:88). */
export const CARD_W = 315;
export const CARD_H = 440;

/** Stamp size as a fraction of the card. */
export const STAMP_W = 0.165;
export const STAMP_H = 0.092;

/** Where the stamp can be: lower part of the artwork, left or right edge. */
export const STAMP_ZONES = [
  { side: 'left', x0: 0, x1: 0.34, y0: 0.28, y1: 0.62 },
  { side: 'right', x0: 0.66, x1: 1, y0: 0.28, y1: 0.62 },
];

/** Score from which a learned template counts as a detected stamp. */
export const LEARNED_THRESHOLD = 0.6;

/**
 * Two channels per pixel: brightness and "redness" (red above the other two).
 * @typedef {{ w: number, h: number, g: Float32Array, red: Float32Array }} Features
 */

/**
 * @param {Uint8ClampedArray} rgba
 * @param {number} w
 * @param {number} h
 * @returns {Features}
 */
export function features(rgba, w, h) {
  const g = new Float32Array(w * h);
  const red = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    g[p] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    red[p] = Math.max(0, rgba[i] - (rgba[i + 1] + rgba[i + 2]) / 2);
  }
  return { w, h, g, red };
}

/**
 * @param {Features} f
 * @param {number} x0
 * @param {number} y0
 * @param {number} w
 * @param {number} h
 * @returns {Features}
 */
export function cropFeatures(f, x0, y0, w, h) {
  const out = { w, h, g: new Float32Array(w * h), red: new Float32Array(w * h) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(f.w - 1, Math.max(0, x0 + x));
      const sy = Math.min(f.h - 1, Math.max(0, y0 + y));
      out.g[y * w + x] = f.g[sy * f.w + sx];
      out.red[y * w + x] = f.red[sy * f.w + sx];
    }
  }
  return out;
}

/**
 * Nearest-neighbour resize of a template.
 * @param {Features} t
 * @param {number} s
 * @returns {Features}
 */
export function scaleFeatures(t, s) {
  const w = Math.max(4, Math.round(t.w * s));
  const h = Math.max(4, Math.round(t.h * s));
  const out = { w, h, g: new Float32Array(w * h), red: new Float32Array(w * h) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = Math.min(t.h - 1, Math.floor(y / s)) * t.w + Math.min(t.w - 1, Math.floor(x / s));
      out.g[y * w + x] = t.g[k];
      out.red[y * w + x] = t.red[k];
    }
  }
  return out;
}

/**
 * Correlation of a template with the card at (x0, y0), on both channels.
 * Columns past the right edge of the card are skipped: the guide crop often cuts
 * the stamp of Trainer cards, which sits right on the edge.
 * @param {Features} card
 * @param {Features} t
 * @param {number} x0
 * @param {number} y0
 */
export function scoreAt(card, t, x0, y0) {
  const vw = Math.min(t.w, card.w - x0);
  if (vw < t.w * 0.6 || y0 < 0 || y0 + t.h > card.h || x0 < 0) return -1;
  let n = 0;
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  let ra = 0, rb = 0, raa = 0, rbb = 0, rab = 0;
  for (let y = 0; y < t.h; y++) {
    for (let x = 0; x < vw; x++) {
      const p = (y0 + y) * card.w + x0 + x;
      const q = y * t.w + x;
      const a = card.g[p], b = t.g[q], c = card.red[p], d = t.red[q];
      sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
      ra += c; rb += d; raa += c * c; rbb += d * d; rab += c * d;
      n++;
    }
  }
  /** @param {number} s1 @param {number} s2 @param {number} s11 @param {number} s22 @param {number} s12 */
  const ncc = (s1, s2, s11, s22, s12) => {
    const v1 = s11 - (s1 * s1) / n;
    const v2 = s22 - (s2 * s2) / n;
    return v1 > 0 && v2 > 0 ? (s12 - (s1 * s2) / n) / Math.sqrt(v1 * v2) : 0;
  };
  return (ncc(sa, sb, saa, sbb, sab) + ncc(ra, rb, raa, rbb, rab)) / 2;
}

/**
 * Best match of the template in the stamp zones, over a few sizes.
 * @param {Features} card features at CARD_W × CARD_H
 * @param {Features} template
 * @param {number[]} [scales]
 * @returns {{ score: number, x: number, y: number, w: number, h: number, side: string }}
 */
export function findStamp(card, template, scales = [0.9, 1, 1.1]) {
  let best = { score: -1, x: 0, y: 0, w: 0, h: 0, side: '' };
  for (const s of scales) {
    const t = scaleFeatures(template, s);
    for (const z of STAMP_ZONES) {
      const xs = Math.round(z.x0 * card.w);
      const xe = Math.round(z.x1 * card.w) - Math.round(t.w * 0.6);
      const ys = Math.round(z.y0 * card.h);
      const ye = Math.round(z.y1 * card.h) - t.h;
      for (let y = ys; y <= ye; y += 2) {
        for (let x = xs; x <= xe; x += 2) {
          const score = scoreAt(card, t, x, y);
          if (score > best.score) {
            best = { score, x: x / card.w, y: y / card.h, w: t.w / card.w, h: t.h / card.h, side: z.side };
          }
        }
      }
    }
  }
  return best;
}

/**
 * Serialisable form of a template (kept in the device's storage, never in the repo).
 * @param {Features} t
 */
export function templateToJSON(t) {
  return { w: t.w, h: t.h, g: Array.from(t.g, Math.round), red: Array.from(t.red, Math.round) };
}

/**
 * @param {any} json
 * @returns {Features | null}
 */
export function templateFromJSON(json) {
  if (!json || !Array.isArray(json.g) || json.g.length !== json.w * json.h) return null;
  return { w: json.w, h: json.h, g: Float32Array.from(json.g), red: Float32Array.from(json.red) };
}
