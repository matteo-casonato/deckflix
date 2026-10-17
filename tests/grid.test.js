import { describe, expect, it } from 'vitest';
import { gridCells, moveCorner } from '../src/lib/domain/grid.js';

describe('gridCells', () => {
  it('1×1 is the whole frame, a single card', () => {
    const [cell, ...rest] = gridCells({ width: 1000, height: 1400 }, { x0: 0, y0: 0, x1: 1, y1: 1 }, 1, 1, 0);
    expect(rest).toEqual([]);
    expect(cell).toEqual({ x: 0, y: 0, w: 1000, h: 1400, row: 0, col: 0 });
  });

  it('cuts a 3×3 page into nine cells in reading order, a bit inside each slot', () => {
    const cells = gridCells({ width: 3000, height: 4200 }, { x0: 0, y0: 0, x1: 1, y1: 1 }, 3, 3, 0.05);
    expect(cells).toHaveLength(9);
    expect(cells[0]).toEqual({ x: 50, y: 70, w: 900, h: 1260, row: 0, col: 0 });
    expect(cells[4]).toMatchObject({ x: 1050, y: 1470, row: 1, col: 1 });
    expect(cells[8]).toMatchObject({ row: 2, col: 2 });
  });
  it('works inside a frame', () => {
    const [first] = gridCells({ width: 1000, height: 1000 }, { x0: 0.1, y0: 0.2, x1: 0.9, y1: 0.8 }, 2, 2, 0);
    expect(first).toEqual({ x: 100, y: 200, w: 400, h: 300, row: 0, col: 0 });
  });
});

describe('moveCorner', () => {
  it('moves a corner and keeps the frame inside the photo and not too small', () => {
    const f = { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9 };
    expect(moveCorner(f, 'tl', 0.2, -0.5)).toEqual({ x0: 0.2, y0: 0, x1: 0.9, y1: 0.9 });
    expect(moveCorner(f, 'br', 0.15, 0.95).x1).toBeCloseTo(0.2);
  });
});
