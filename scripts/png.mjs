// @ts-check
// Minimal PNG decoder for the fingerprint index (Node only, no dependencies): 8-bit grey,
// RGB, grey+alpha and RGBA, and palette images at 1–8 bits, interlaced (Adam7) or not, as
// TCGdex serves its thumbnails. Returns RGBA pixels.
import { inflateSync } from 'node:zlib';

/** Adam7 passes: start x, start y, step x, step y. */
const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

/**
 * @param {Buffer} buf
 * @returns {{ width: number, height: number, rgba: Uint8Array }}
 */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  /** @type {Buffer[]} */
  const idat = [];
  /** @type {Buffer | null} */
  let palette = null;
  /** @type {Buffer | null} */
  let trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (name === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
      interlace = data[12];
    } else if (name === 'PLTE') palette = data;
    else if (name === 'tRNS') trns = data;
    else if (name === 'IDAT') idat.push(data);
    else if (name === 'IEND') break;
    pos += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels || (type !== 3 && depth !== 8)) throw new Error(`unsupported PNG (type ${type}, depth ${depth})`);
  const bitsPerPixel = channels * depth;
  const bytesPerPixel = Math.max(1, bitsPerPixel >> 3);
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(width * height * 4);
  let offset = 0;

  /** Unfilters one (sub)image and writes its pixels. */
  const pass = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ dx, /** @type {number} */ dy) => {
    const w = Math.ceil((width - x0) / dx);
    const h = Math.ceil((height - y0) / dy);
    if (w <= 0 || h <= 0) return;
    const stride = Math.ceil((w * bitsPerPixel) / 8);
    let prev = new Uint8Array(stride);
    for (let row = 0; row < h; row++) {
      const filter = raw[offset++];
      const line = new Uint8Array(raw.subarray(offset, offset + stride));
      offset += stride;
      for (let i = 0; i < stride; i++) {
        const a = i >= bytesPerPixel ? line[i - bytesPerPixel] : 0;
        const b = prev[i];
        const c = i >= bytesPerPixel ? prev[i - bytesPerPixel] : 0;
        let add = 0;
        if (filter === 1) add = a;
        else if (filter === 2) add = b;
        else if (filter === 3) add = (a + b) >> 1;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        line[i] = (line[i] + add) & 0xff;
      }
      for (let col = 0; col < w; col++) {
        const out = ((y0 + row * dy) * width + (x0 + col * dx)) * 4;
        if (type === 3) {
          const bit = col * depth;
          const idx = (line[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
          rgba[out] = palette ? palette[idx * 3] : 0;
          rgba[out + 1] = palette ? palette[idx * 3 + 1] : 0;
          rgba[out + 2] = palette ? palette[idx * 3 + 2] : 0;
          rgba[out + 3] = trns && idx < trns.length ? trns[idx] : 255;
        } else {
          const p = col * channels;
          const grey = type === 0 || type === 4;
          rgba[out] = line[p];
          rgba[out + 1] = grey ? line[p] : line[p + 1];
          rgba[out + 2] = grey ? line[p] : line[p + 2];
          rgba[out + 3] = type === 4 ? line[p + 1] : type === 6 ? line[p + 3] : 255;
        }
      }
      prev = line;
    }
  };

  if (interlace) for (const [x0, y0, dx, dy] of ADAM7) pass(x0, y0, dx, dy);
  else pass(0, 0, 1, 1);
  return { width, height, rgba };
}
