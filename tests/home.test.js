import { describe, expect, it } from 'vitest';
import { cardOfTheDay, priceMovers, setInProgress } from '../src/lib/domain/home.js';

const cm = (avg7, avg30, trend = avg7) => ({ image: 'x', pricing: { cardmarket: { avg7, avg30, trend } } });
const cards = new Map([
  ['a', cm(12, 10)],
  ['b', cm(8, 10)],
  ['c', cm(0.2, 0.1)],
  ['d', cm(5, 5)],
  ['e', { pricing: { cardmarket: { avg7: 3, avg30: 2, trend: 3 } } }],
]);
const tile = (cardId, unit) => ({ cardId, qty: 1, unit, value: unit, variants: ['normal'] });

describe('cardOfTheDay', () => {
  it('is stable within a day, changes across days and needs an image', () => {
    const tiles = ['a', 'b', 'c', 'd', 'e'].map((id) => tile(id, 5));
    const today = cardOfTheDay(tiles, cards, '2026-10-15');
    expect(cardOfTheDay(tiles, cards, '2026-10-15')).toEqual(today);
    expect(today.cardId).not.toBe('e');
    const days = new Set(['01', '02', '03', '04', '05', '06'].map((d) => cardOfTheDay(tiles, cards, `2026-10-${d}`).cardId));
    expect(days.size).toBeGreaterThan(1);
    expect(cardOfTheDay([], cards, '2026-10-15')).toBe(null);
  });
});

describe('priceMovers', () => {
  it('splits up and down by 7-day vs 30-day average, skipping tiny prices and flat cards', () => {
    const r = priceMovers(['a', 'b', 'c', 'd', 'e'].map((cardId) => ({ cardId })), cards);
    expect(r.up.map((m) => [m.cardId, Math.round(m.pct)])).toEqual([['e', 50], ['a', 20]]);
    expect(r.down.map((m) => [m.cardId, Math.round(m.pct)])).toEqual([['b', -20]]);
  });
});

describe('setInProgress', () => {
  it('picks the incomplete set with most distinct cards', () => {
    const sets = new Map([['s1', { cardCount: { official: 3 } }], ['s2', { cardCount: { official: 10 } }]]);
    const e = (cardId, setId, updatedAt = 0) => ({ cardId, setId, updatedAt });
    const entries = [e('s1-1', 's1'), e('s1-2', 's1'), e('s1-3', 's1'), e('s2-1', 's2'), e('s2-2', 's2'), e('s2-2', 's2'), e('s2-11', 's2')];
    expect(setInProgress(entries, sets)).toEqual({ setId: 's2', owned: 2, total: 10, last: 0, missing: 8, percent: 20 });
    expect(setInProgress([], sets)).toBe(null);
  });
});
