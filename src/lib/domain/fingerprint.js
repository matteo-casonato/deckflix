// @ts-check
// Card artwork fingerprint (perceptual hash) to recognise a card by its drawing: the same
// function runs in the app (photo crops, TCGdex thumbnails) and in the weekly index script,
// on raw RGBA pixels, so both sides compute identical values.

/** The drawing window of a card, as fractions (standard cards; full arts have art there too). */
export const ART = { x0: 0.1, x1: 0.9, y0: 0.12, y1: 0.52 };

const N = 32;
const K = 8;

/** Cosine table for a 32-point DCT. */
const COS = Array.from({ length: K }, (_, u) => Array.from({ length: N }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N))));

/**
 * 64-bit perceptual hash (pHash) of a region of an image, as 16 hex digits: grey 32×32
 * average of the region, 2D DCT, the 8×8 lowest frequencies compared with their median.
 * Small changes of light, colour or sharpness move only a few bits.
 * @param {ArrayLike<number>} rgba pixels, 4 bytes each
 * @param {number} width
 * @param {number} height
 * @param {{ x0: number, x1: number, y0: number, y1: number }} [region]
 */
export function fingerprint(rgba, width, height, region = ART) {
  // Box average into a 32×32 grey grid.
  const grey = new Float64Array(N * N);
  const counts = new Float64Array(N * N);
  const xa = Math.floor(region.x0 * width);
  const xb = Math.max(xa + 1, Math.floor(region.x1 * width));
  const ya = Math.floor(region.y0 * height);
  const yb = Math.max(ya + 1, Math.floor(region.y1 * height));
  for (let y = ya; y < yb; y++) {
    const gy = Math.min(N - 1, Math.floor(((y - ya) * N) / (yb - ya)));
    for (let x = xa; x < xb; x++) {
      const gx = Math.min(N - 1, Math.floor(((x - xa) * N) / (xb - xa)));
      const i = (y * width + x) * 4;
      grey[gy * N + gx] += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      counts[gy * N + gx]++;
    }
  }
  for (let i = 0; i < grey.length; i++) grey[i] = counts[i] ? grey[i] / counts[i] : 0;

  // 8×8 low frequencies of the 2D DCT.
  const rows = new Float64Array(N * K);
  for (let y = 0; y < N; y++) for (let u = 0; u < K; u++) {
    let s = 0;
    for (let x = 0; x < N; x++) s += grey[y * N + x] * COS[u][x];
    rows[y * K + u] = s;
  }
  const coeffs = new Float64Array(K * K);
  for (let v = 0; v < K; v++) for (let u = 0; u < K; u++) {
    let s = 0;
    for (let y = 0; y < N; y++) s += rows[y * K + u] * COS[v][y];
    coeffs[v * K + u] = s;
  }
  // Median without the DC term (overall brightness).
  const median = [...coeffs.slice(1)].sort((a, b) => a - b)[31];
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) nibble = (nibble << 1) | (coeffs[i + b] > median ? 1 : 0);
    hex += nibble.toString(16);
  }
  return hex;
}

/** Bits set in a 4-bit value. */
const POP = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/**
 * Different bits between two fingerprints (0 = same drawing, ~32 = unrelated).
 * @param {string} a
 * @param {string} b
 */
export function distance(a, b) {
  let d = 0;
  for (let i = 0; i < 16; i++) d += POP[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}

/** Same card: below this the drawings match (photo noise, glare, small misalignment). */
export const SAME = 14;
/** Probably the same card: still worth proposing, marked "Da verificare". */
export const LIKELY = 20;

/**
 * Nearest fingerprints in an index, best first.
 * @param {string} fp
 * @param {{ ids: string[], h: string[] }} index
 * @param {number} [limit]
 * @returns {{ id: string, d: number }[]}
 */
export function nearest(fp, index, limit = 5) {
  /** @type {{ id: string, d: number }[]} */
  const best = [];
  for (let i = 0; i < index.h.length; i++) {
    const d = distance(fp, index.h[i]);
    if (best.length < limit || d < best[best.length - 1].d) {
      best.push({ id: index.ids[i], d });
      best.sort((a, b) => a.d - b.d);
      if (best.length > limit) best.pop();
    }
  }
  return best;
}

/**
 * Whether a drawing-only match needs checking: the best is not clearly the same drawing, or a
 * second card is just as close (reprints share their artwork).
 * @param {number[]} distances best first
 */
export function artUncertain(distances) {
  const [best, second] = distances;
  if (best == null || best > SAME) return true;
  return second != null && second <= LIKELY;
}
