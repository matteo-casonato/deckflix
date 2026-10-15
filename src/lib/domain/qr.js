// @ts-check
// Minimal QR Code encoder (ISO/IEC 18004): byte mode, versions 1–40, one error-correction
// level, automatic mask. Written here to avoid a dependency (CLAUDE.md); it follows the
// structure of Project Nayuki's reference implementation (MIT). Pure: text in, matrix out.

/** @typedef {'L' | 'M' | 'Q' | 'H'} Ecc */

const ECL = /** @type {const} */ ({ L: 0, M: 1, Q: 2, H: 3 });
const FORMAT_BITS = /** @type {const} */ ({ L: 1, M: 0, Q: 3, H: 2 });

// prettier-ignore
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
// prettier-ignore
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const bit = (/** @type {number} */ x, /** @type {number} */ i) => ((x >>> i) & 1) !== 0;

/** Modules available for data and ECC in a version. @param {number} ver */
function rawDataModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}

/** @param {number} ver @param {Ecc} ecc */
const dataCodewords = (ver, ecc) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ECL[ecc]][ver] * NUM_BLOCKS[ECL[ecc]][ver];

/** Multiplication in GF(2^8) modulo x^8 + x^4 + x^3 + x^2 + 1. */
function gfMul(/** @type {number} */ x, /** @type {number} */ y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/** @param {number} degree */
function rsDivisor(degree) {
  const r = new Array(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < degree) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}

/** @param {number[]} data @param {number[]} divisor */
function rsRemainder(data, divisor) {
  const r = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ /** @type {number} */ (r.shift());
    r.push(0);
    divisor.forEach((c, i) => (r[i] ^= gfMul(c, factor)));
  }
  return r;
}

/** Splits into blocks, adds Reed–Solomon codewords and interleaves. @param {number[]} data @param {number} ver @param {Ecc} ecc */
function withEcc(data, ver, ecc) {
  const blocks = NUM_BLOCKS[ECL[ecc]][ver];
  const eccLen = ECC_PER_BLOCK[ECL[ecc]][ver];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const short = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const div = rsDivisor(eccLen);
  /** @type {number[][]} */
  const out = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < short ? 0 : 1));
    k += dat.length;
    const block = dat.concat(rsRemainder(dat, div));
    if (i < short) block.splice(dat.length, 0, 0); // placeholder, skipped below
    out.push(block);
  }
  /** @type {number[]} */
  const result = [];
  for (let i = 0; i < out[0].length; i++) {
    out.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= short) result.push(b[i]);
    });
  }
  return result;
}

/** @param {number} ver */
function alignmentPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let pos = ver * 4 + 17 - 7; r.length < n; pos -= step) r.splice(1, 0, pos);
  return r;
}

const MASKS = [
  (/** @type {number} */ x, /** @type {number} */ y) => (x + y) % 2 === 0,
  (/** @type {number} */ _x, /** @type {number} */ y) => y % 2 === 0,
  (/** @type {number} */ x) => x % 3 === 0,
  (/** @type {number} */ x, /** @type {number} */ y) => (x + y) % 3 === 0,
  (/** @type {number} */ x, /** @type {number} */ y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (/** @type {number} */ x, /** @type {number} */ y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (/** @type {number} */ x, /** @type {number} */ y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (/** @type {number} */ x, /** @type {number} */ y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/**
 * QR matrix for a text (UTF-8 bytes): `modules[y][x]` true = dark. No quiet zone.
 * @param {string} text
 * @param {Ecc} [ecc]
 * @returns {boolean[][]}
 */
export function qrMatrix(text, ecc = 'M') {
  const bytes = [...new TextEncoder().encode(text)];
  let ver = 1;
  for (; ver <= 40; ver++) {
    const bits = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
    if (bits <= dataCodewords(ver, ecc) * 8) break;
  }
  if (ver > 40) throw new RangeError('Testo troppo lungo per un QR');

  // Data bits: byte mode, length, bytes, terminator, padding.
  /** @type {number[]} */
  const bb = [];
  const push = (/** @type {number} */ val, /** @type {number} */ len) => {
    for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  const capacity = dataCodewords(ver, ecc) * 8;
  push(0, Math.min(4, capacity - bb.length));
  push(0, (8 - (bb.length % 8)) % 8);
  for (let pad = 0xec; bb.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  /** @type {number[]} */
  const data = [];
  for (let i = 0; i < bb.length; i += 8) data.push(bb.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  const codewords = withEcc(data, ver, ecc);

  const size = ver * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (/** @type {number} */ x, /** @type {number} */ y, /** @type {boolean} */ dark) => {
    modules[y][x] = dark;
    fn[y][x] = true;
  };

  // Timing, finders, alignment.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
  }
  const al = alignmentPositions(ver);
  al.forEach((ax, i) =>
    al.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );

  const drawFormat = (/** @type {number} */ mask) => {
    const d = (FORMAT_BITS[ecc] << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((d << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i));
    set(8, 7, bit(bits, 6));
    set(8, 8, bit(bits, 7));
    set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit(bits, i));
      set(b, a, bit(bits, i));
    }
  }

  // Data in the zigzag order.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && i < codewords.length * 8) {
          modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
  }

  // Pick the mask with the lowest penalty.
  const applyMask = (/** @type {number} */ m) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) modules[y][x] = !modules[y][x];
  };
  let best = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const s = penalty(modules);
    if (s < bestScore) {
      bestScore = s;
      best = m;
    }
    applyMask(m);
  }
  applyMask(best);
  drawFormat(best);
  return modules;
}

/** Simplified penalty (runs, 2×2 blocks, finder-like patterns, balance). @param {boolean[][]} m */
function penalty(m) {
  const n = m.length;
  let score = 0;
  const lines = [...m, ...m[0].map((_, x) => m.map((row) => row[x]))];
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    const s = line.map((b) => (b ? 1 : 0)).join('');
    score += 40 * ((s.match(/1011101(?=0000)/g) ?? []).length + (s.match(/(?<=0000)1011101/g) ?? []).length);
  }
  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
  const dark = m.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  return score;
}
