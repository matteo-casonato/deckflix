// @ts-check
// Experimental stamp detection: compares the photographed card with the official TCGdex
// scan (which shows the print without stamps). A logo that is on the photo but not on the
// scan shows up as a compact block of cells whose structure doesn't match.
// The math works on plain grey-level arrays so it can be unit tested.

/** Working size: 63:88 card ratio, small enough to align by brute force on a phone. */
export const GRID_W = 126;
export const GRID_H = 176;
/** Cell size in working pixels for the anomaly map. */
export const CELL = 9;

/**
 * @typedef {{ data: Float32Array, w: number, h: number }} Gray
 */

/**
 * Normalised cross-correlation of two equally sized windows.
 * @param {Gray} a
 * @param {Gray} b
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @param {number} w
 * @param {number} h
 * @returns {{ ncc: number, sa: number, sb: number }}
 */
export function windowNcc(a, b, ax, ay, bx, by, w, h) {
  let sumA = 0, sumB = 0, sumAA = 0, sumBB = 0, sumAB = 0, n = 0;
  for (let y = 0; y < h; y++) {
    const ya = ay + y, yb = by + y;
    if (ya < 0 || yb < 0 || ya >= a.h || yb >= b.h) continue;
    for (let x = 0; x < w; x++) {
      const xa = ax + x, xb = bx + x;
      if (xa < 0 || xb < 0 || xa >= a.w || xb >= b.w) continue;
      const va = a.data[ya * a.w + xa];
      const vb = b.data[yb * b.w + xb];
      sumA += va; sumB += vb; sumAA += va * va; sumBB += vb * vb; sumAB += va * vb; n++;
    }
  }
  if (n < 4) return { ncc: 0, sa: 0, sb: 0 };
  const ma = sumA / n, mb = sumB / n;
  const va = Math.max(0, sumAA / n - ma * ma);
  const vb = Math.max(0, sumBB / n - mb * mb);
  const sa = Math.sqrt(va), sb = Math.sqrt(vb);
  const cov = sumAB / n - ma * mb;
  return { ncc: sa > 0 && sb > 0 ? cov / (sa * sb) : 0, sa, sb };
}

/**
 * Best integer shift of `photo` over `ref` (photo pixel (x+dx, y+dy) ↔ ref pixel (x, y)),
 * by correlation over the inner area of the card.
 * @param {Gray} photo
 * @param {Gray} ref
 * @param {number} range
 */
export function bestShift(photo, ref, range) {
  const m = range + 2;
  let best = { dx: 0, dy: 0, ncc: -Infinity };
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const { ncc } = windowNcc(photo, ref, m + dx, m + dy, m, m, ref.w - 2 * m, ref.h - 2 * m);
      if (ncc > best.ncc) best = { dx, dy, ncc };
    }
  }
  return best;
}

/**
 * Per-cell mismatch between aligned photo and reference, from 0 (same) to 1.
 * A cell that is flat on the reference but textured on the photo (a logo printed on a
 * plain area) also counts as a mismatch; flat-on-both cells (glare, borders) don't.
 * @param {Gray} photo
 * @param {Gray} ref
 * @param {number} dx
 * @param {number} dy
 * @returns {{ cols: number, rows: number, values: Float32Array }}
 */
export function anomalyMap(photo, ref, dx, dy) {
  const cols = Math.floor(ref.w / CELL);
  const rows = Math.floor(ref.h / CELL);
  const values = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * CELL, y = r * CELL;
      const { ncc, sa, sb } = windowNcc(photo, ref, x + dx, y + dy, x, y, CELL, CELL);
      const FLAT = 6;
      let v;
      if (sa < FLAT && sb < FLAT) v = 0;
      else if (sb < FLAT) v = 1;
      else if (sa < FLAT) v = 0.3;
      else v = Math.min(1, Math.max(0, (1 - ncc) / 1.2));
      values[r * cols + c] = v;
    }
  }
  return { cols, rows, values };
}

/**
 * Inner area searched for stamps: the outer frame (rounded corners, border) never lines
 * up exactly between a photo and the scan, so it would only produce false alarms.
 */
export const INNER_AREA = { x0: 0.07, y0: 0.05, x1: 0.93, y1: 0.95 };

/**
 * Strongest compact blob (2×2 cells) inside `area`, compared with the rest of that area.
 * `score` is a robust z-score: how many median absolute deviations above the median.
 * @param {{ cols: number, rows: number, values: Float32Array }} map
 * @param {{ x0: number, y0: number, x1: number, y1: number }} [area] fractions of the card to search
 */
export function strongestBlob(map, area = INNER_AREA) {
  const { cols, rows, values } = map;
  const blobs = [];
  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      if (c / cols < area.x0 || (c + 2) / cols > area.x1 || r / rows < area.y0 || (r + 2) / rows > area.y1) continue;
      const v = (values[r * cols + c] + values[r * cols + c + 1] + values[(r + 1) * cols + c] + values[(r + 1) * cols + c + 1]) / 4;
      blobs.push({ c, r, v });
    }
  }
  if (!blobs.length) return null;
  const sorted = blobs.map((b) => b.v).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mad = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)];
  const top = blobs.reduce((a, b) => (b.v > a.v ? b : a));
  return {
    x: top.c / cols,
    y: top.r / rows,
    w: 2 / cols,
    h: 2 / rows,
    value: top.v,
    median,
    score: (top.v - median) / Math.max(mad, 0.02),
  };
}

/**
 * Suggestions are off: on simulated photos (blur, glare, no perspective) cards without a
 * logo scored as high as cards with one, because small text and glare also mismatch the
 * scan. Next step: test only where each stamp is printed, tuned on real crops.
 */
export const STAMP_SUGGESTIONS_ENABLED = false;

/** Thresholds for suggesting a stamp; to be tuned on real scans. */
export const STAMP_MIN_SCORE = 6;
export const STAMP_MIN_VALUE = 0.55;
/** The alignment must be decent, or every cell looks different. */
export const MIN_ALIGNMENT = 0.45;
