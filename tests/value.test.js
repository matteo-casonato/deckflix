import { describe, expect, it } from 'vitest';
import { collectionStats, collectionValue, dayKey, periodChange } from '../src/lib/domain/value.js';

const card = (o) => ({ pricing: { cardmarket: { trend: 1, 'trend-holo': 3, avg7: 1, avg30: 1, ...o.cm } }, rarity: 'Comune', ...o });
const cards = new Map([
  ['a', card({ rarity: 'Comune' })],
  ['b', card({ rarity: 'Rara', cm: { trend: 10, 'trend-holo': 15, avg7: 12, avg30: 10 } })],
  ['c', { rarity: 'Rara' }],
]);
const e = (cardId, qty, variant = 'normal', lang = 'it') => ({ key: `${cardId}|${lang}|${variant}`, cardId, setId: 's1', lang, variant, qty, addedAt: 0, updatedAt: 0 });

describe('collectionValue', () => {
  it('sums price × quantity, reverse uses the -holo price, unpriced copies are counted apart', () => {
    expect(collectionValue([e('a', 2), e('a', 1, 'reverse'), e('b', 1), e('c', 4), e('z', 1)], cards)).toEqual({
      total: 2 + 3 + 10,
      unpriced: 4,
      missingData: 1,
    });
  });
});

describe('dayKey', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });
});

describe('periodChange', () => {
  const snaps = [
    { date: '2026-09-01', totalValue: 100 },
    { date: '2026-09-10', totalValue: 110 },
    { date: '2026-10-10', totalValue: 120 },
    { date: '2026-10-15', totalValue: 132 },
  ];
  const now = new Date(2026, 9, 15, 12).getTime();

  it('starts from the last snapshot before the period', () => {
    const r = periodChange(snaps, 30, now);
    expect(r.points.map((p) => p.date)).toEqual(['2026-09-10', '2026-10-10', '2026-10-15']);
    expect(r.delta).toBe(22);
    expect(r.pct).toBeCloseTo(20);
  });

  it('handles "all" and too few points', () => {
    expect(periodChange(snaps, null, now).delta).toBe(32);
    expect(periodChange([{ date: '2026-10-15', totalValue: 5 }], 7, now)).toMatchObject({ delta: null, pct: null });
    expect(periodChange([], 7, now).points).toEqual([]);
  });
});

describe('collectionStats', () => {
  it('counts copies, uniques, duplicates, finishes, ranks and distributions', () => {
    const s = collectionStats([e('a', 2), e('a', 1, 'reverse', 'en'), e('b', 1, 'holo'), e('c', 1)], cards);
    expect(s).toMatchObject({ copies: 5, unique: 3, sets: 1, duplicates: 2, holo: 1, reverse: 1 });
    expect(s.mostValuable.map((t) => t.cardId)).toEqual(['b', 'a']);
    expect(s.rising.map((t) => [t.cardId, Math.round(t.pct)])).toEqual([['b', 20]]);
    expect(s.byRarity).toEqual([
      ['Comune', 3],
      ['Rara', 2],
    ]);
    expect(s.byLang).toEqual([
      ['it', 4],
      ['en', 1],
    ]);
  });
});
