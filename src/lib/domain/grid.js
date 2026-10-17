// @ts-check
// Group photo: the cards laid out in a grid (a 3×3 binder page) are cut into one cell each.

/**
 * @typedef {{ x0: number, y0: number, x1: number, y1: number }} Frame fractions of the photo, 0–1
 * @typedef {{ x: number, y: number, w: number, h: number, row: number, col: number }} Cell in pixels
 */

/** Grids offered: rows × columns (1×1: a single card from a photo of the gallery). */
export const GRIDS = /** @type {const} */ ([
  [1, 1],
  [3, 3],
  [2, 2],
  [2, 3],
  [3, 2],
  [3, 4],
  [4, 3],
]);

/**
 * The cells of a `rows × cols` grid inside the frame, in reading order (left to right, top to
 * bottom), each shrunk by `inset` (a fraction of the cell). Kept small: the collector number is
 * close to the card's bottom edge and must stay inside the cell.
 * @param {{ width: number, height: number }} photo
 * @param {Frame} frame
 * @param {number} rows
 * @param {number} cols
 * @param {number} [inset]
 * @returns {Cell[]}
 */
export function gridCells(photo, frame, rows, cols, inset = 0.01) {
  const left = Math.min(frame.x0, frame.x1) * photo.width;
  const top = Math.min(frame.y0, frame.y1) * photo.height;
  const cw = (Math.abs(frame.x1 - frame.x0) * photo.width) / cols;
  const ch = (Math.abs(frame.y1 - frame.y0) * photo.height) / rows;
  /** @type {Cell[]} */
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dx = cw * inset;
      const dy = ch * inset;
      cells.push({
        x: Math.round(left + col * cw + dx),
        y: Math.round(top + row * ch + dy),
        w: Math.round(cw - 2 * dx),
        h: Math.round(ch - 2 * dy),
        row,
        col,
      });
    }
  }
  return cells;
}

/**
 * Moves one corner of the frame, keeping it inside the photo and at least `min` wide and tall.
 * @param {Frame} frame
 * @param {'tl' | 'tr' | 'bl' | 'br'} corner
 * @param {number} x fraction
 * @param {number} y fraction
 * @param {number} [min]
 * @returns {Frame}
 */
export function moveCorner(frame, corner, x, y, min = 0.1) {
  const clamp = (/** @type {number} */ v) => Math.min(1, Math.max(0, v));
  const f = { ...frame };
  if (corner === 'tl' || corner === 'bl') f.x0 = Math.min(clamp(x), f.x1 - min);
  else f.x1 = Math.max(clamp(x), f.x0 + min);
  if (corner === 'tl' || corner === 'tr') f.y0 = Math.min(clamp(y), f.y1 - min);
  else f.y1 = Math.max(clamp(y), f.y0 + min);
  return f;
}
