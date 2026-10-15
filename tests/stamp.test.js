import { describe, expect, it } from 'vitest';
import { CELL, anomalyMap, bestShift, strongestBlob } from '../lab/scan/stamp.js';

/** Deterministic textured "card": smooth gradients plus a pseudo-random pattern. */
function card(w, h) {
  const data = new Float32Array(w * h);
  let seed = 7;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[y * w + x] = 60 + 0.6 * x + 0.4 * y + (seed % 60);
    }
  }
  return { data, w, h };
}

/** Copy shifted so that photo(x + dx, y + dy) = ref(x, y). */
function shifted(ref, dx, dy) {
  const data = new Float32Array(ref.w * ref.h).fill(128);
  for (let y = 0; y < ref.h; y++) {
    for (let x = 0; x < ref.w; x++) {
      const px = x + dx, py = y + dy;
      if (px >= 0 && py >= 0 && px < ref.w && py < ref.h) data[py * ref.w + px] = ref.data[y * ref.w + x];
    }
  }
  return { data, w: ref.w, h: ref.h };
}

/** Paints a high-contrast "logo" (checkerboard) on a copy. */
function withLogo(img, x0, y0, size) {
  const data = img.data.slice();
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) data[y * img.w + x] = ((x >> 1) + (y >> 1)) % 2 ? 250 : 5;
  }
  return { ...img, data };
}

describe('bestShift', () => {
  it('recovers a small misalignment', () => {
    const ref = card(63, 88);
    expect(bestShift(shifted(ref, 2, -1), ref, 4)).toMatchObject({ dx: 2, dy: -1 });
  });
});

describe('stamp anomaly', () => {
  const ref = card(126, 176);

  it('finds a logo that is not on the reference', () => {
    const photo = withLogo(ref, 80, 100, CELL * 2);
    const map = anomalyMap(photo, ref, 0, 0);
    const blob = strongestBlob(map);
    expect(blob.score).toBeGreaterThan(6);
    expect(blob.x * 126).toBeGreaterThan(70);
    expect(blob.y * 176).toBeGreaterThan(90);
  });

  it('reports no strong blob on an identical photo', () => {
    const blob = strongestBlob(anomalyMap(ref, ref, 0, 0));
    expect(blob.value).toBeLessThan(0.1);
  });
});
