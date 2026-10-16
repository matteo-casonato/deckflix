import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { artUncertain, distance, fingerprint, nearest } from '../src/lib/domain/fingerprint.js';
import { decodePng } from '../scripts/png.mjs';

/** Synthetic "card": random coloured blocks (seeded), so two seeds are two different drawings. */
function card(seed, w = 245, h = 337, light = 0) {
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const blocks = Array.from({ length: 12 * 16 }, () => 40 + rnd() * 170);
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const v = blocks[Math.floor((y / h) * 16) * 12 + Math.floor((x / w) * 12)] + light;
    px[i] = px[i + 1] = px[i + 2] = Math.max(0, Math.min(255, v));
    px[i + 3] = 255;
  }
  return px;
}

describe('fingerprint', () => {
  it('gives the same drawing the same print, even brighter or at another size', () => {
    const a = fingerprint(card(1), 245, 337);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(distance(a, fingerprint(card(1, 245, 337, 25), 245, 337))).toBeLessThan(6);
    expect(distance(a, fingerprint(card(1, 490, 674), 490, 674))).toBeLessThan(14);
  });
  it('tells different drawings apart and finds the nearest in an index', () => {
    const a = fingerprint(card(1), 245, 337);
    const b = fingerprint(card(5), 245, 337);
    expect(distance(a, b)).toBeGreaterThan(14);
    const index = { ids: ['x', 'y', 'z'], h: [b, a, fingerprint(card(9), 245, 337)] };
    expect(nearest(a, index, 2)[0]).toEqual({ id: 'y', d: 0 });
  });
});

describe('decodePng', () => {
  it('reads an 8-bit RGB PNG', () => {
    const w = 2;
    const h = 2;
    const rows = Buffer.from([0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255]);
    const chunk = (name, data) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      return Buffer.concat([len, Buffer.from(name, 'ascii'), data, Buffer.alloc(4)]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
    const img = decodePng(png);
    expect([img.width, img.height]).toEqual([2, 2]);
    expect([...img.rgba.slice(0, 8)]).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
    expect([...img.rgba.slice(8, 16)]).toEqual([0, 0, 255, 255, 255, 255, 255, 255]);
  });
});

describe('artUncertain', () => {
  it('trusts one clearly matching drawing', () => {
    expect(artUncertain([6, 29])).toBe(false);
    expect(artUncertain([6])).toBe(false);
  });
  it('doubts a far match or two close ones', () => {
    expect(artUncertain([17])).toBe(true);
    expect(artUncertain([4, 5])).toBe(true);
    expect(artUncertain([])).toBe(true);
  });
});
