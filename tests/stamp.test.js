import { describe, expect, it } from 'vitest';
import { CARD_H, CARD_W, cropFeatures, findStamp, templateFromJSON, templateToJSON } from '../lab/scan/stamp.js';

/** Deterministic textured "card" as features, optionally with a distinctive patch. */
function card(seed = 7) {
  const w = CARD_W, h = CARD_H;
  const g = new Float32Array(w * h);
  const red = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      g[y * w + x] = 80 + 0.2 * x + 0.1 * y + (seed % 40);
      red[y * w + x] = seed % 25;
    }
  }
  return { w, h, g, red };
}

/** Paints a "stamp": dark box, red top, bright blob. */
function paintStamp(f, x0, y0, sw, sh) {
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const p = (y0 + y) * f.w + x0 + x;
      if (x0 + x >= f.w) continue;
      const top = y < sh * 0.55;
      const blob = (x - sw * 0.65) ** 2 / (sw * 0.18) ** 2 + (y - sh * 0.7) ** 2 / (sh * 0.3) ** 2 < 1;
      f.g[p] = blob ? 230 : top ? 90 : 25;
      f.red[p] = blob ? 0 : top ? 120 : 0;
    }
  }
}

describe('findStamp', () => {
  const sw = Math.round(0.165 * CARD_W), sh = Math.round(0.092 * CARD_H);

  it('finds the stamp on the left edge of the artwork', () => {
    const f = card();
    paintStamp(f, 20, 170, sw, sh);
    const template = cropFeatures(f, 20, 170, sw, sh);
    const other = card(11);
    paintStamp(other, 18, 175, sw, sh);
    const hit = findStamp(other, template);
    expect(hit.score).toBeGreaterThan(0.8);
    expect(hit.side).toBe('left');
    expect(Math.abs(hit.x * CARD_W - 18)).toBeLessThanOrEqual(4);
  });

  it('finds a stamp cut by the right edge of the crop', () => {
    const f = card();
    paintStamp(f, 20, 170, sw, sh);
    const template = cropFeatures(f, 20, 170, sw, sh);
    const other = card(13);
    paintStamp(other, CARD_W - Math.round(sw * 0.75), 180, sw, sh);
    const hit = findStamp(other, template);
    expect(hit.side).toBe('right');
    expect(hit.score).toBeGreaterThan(0.7);
  });

  it('scores low without a stamp', () => {
    const f = card();
    paintStamp(f, 20, 170, sw, sh);
    const template = cropFeatures(f, 20, 170, sw, sh);
    expect(findStamp(card(17), template).score).toBeLessThan(0.3);
  });
});

describe('template storage', () => {
  it('round-trips through JSON', () => {
    const t = cropFeatures(card(), 10, 10, 8, 6);
    const back = templateFromJSON(JSON.parse(JSON.stringify(templateToJSON(t))));
    expect(back.w).toBe(8);
    expect(back.g.length).toBe(48);
    expect(templateFromJSON({ w: 2, h: 2, g: [1], red: [] })).toBeNull();
  });
});
