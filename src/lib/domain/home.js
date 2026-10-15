// @ts-check
// What the Home page highlights (pure): the card of the day, price movers and the set
// being completed.
import { copyPrice } from './cards.js';

/** @typedef {import('./albums.js').Tile} Tile */

/** Small stable hash of a string (FNV-1a), to pick the same card all day. @param {string} s */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Card of the day: one of your cards with an image, different every day, the same all day.
 * Cards with a price come first, so the spotlight is rarely a common Energy.
 * @param {Tile[]} tiles
 * @param {Map<string, any>} cards
 * @param {string} day "YYYY-MM-DD"
 */
export function cardOfTheDay(tiles, cards, day) {
  const withImage = tiles.filter((t) => cards.get(t.cardId)?.image).sort((a, b) => a.cardId.localeCompare(b.cardId));
  const priced = withImage.filter((t) => t.unit >= 1);
  const pool = priced.length >= 3 ? priced : withImage;
  return pool.length ? pool[hash(day) % pool.length] : null;
}

/**
 * Cards whose Cardmarket average of the last 7 days moved most against the last 30, both ways.
 * Ignores tiny prices, where a few cents look like a big percentage.
 * @param {{ cardId: string }[]} items
 * @param {Map<string, any>} cards
 * @param {{ limit?: number, minPrice?: number, minPct?: number }} [o]
 */
export function priceMovers(items, cards, { limit = 6, minPrice = 0.5, minPct = 5 } = {}) {
  const moves = items
    .map((t) => {
      const cm = cards.get(t.cardId)?.pricing?.cardmarket;
      if (!(cm?.avg7 > 0) || !(cm?.avg30 > 0) || Math.max(cm.avg7, cm.avg30) < minPrice) return null;
      return { cardId: t.cardId, pct: (cm.avg7 / cm.avg30 - 1) * 100, price: copyPrice(cards.get(t.cardId), 'normal') ?? cm.avg7 };
    })
    .filter((m) => m !== null && Math.abs(m.pct) >= minPct);
  const list = /** @type {{ cardId: string, pct: number, price: number }[]} */ (moves);
  return {
    up: list.filter((m) => m.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, limit),
    down: list.filter((m) => m.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, limit),
  };
}

/**
 * The set you are completing: most owned cards among sets not yet complete (ties: the one
 * touched last). Counts distinct numbers up to the official size.
 * @param {{ cardId: string, setId: string, updatedAt: number }[]} entries
 * @param {Map<string, any>} sets setsMap (for cardCount.official)
 */
export function setInProgress(entries, sets) {
  /** @type {Map<string, { owned: Set<string>, last: number }>} */
  const by = new Map();
  for (const e of entries) {
    const g = by.get(e.setId) ?? { owned: new Set(), last: 0 };
    const local = e.cardId.slice(e.setId.length + 1);
    const official = sets.get(e.setId)?.cardCount?.official ?? 0;
    if (/^\d+$/.test(local) && Number(local) <= official) g.owned.add(local);
    g.last = Math.max(g.last, e.updatedAt);
    by.set(e.setId, g);
  }
  const rows = [...by.entries()]
    .map(([setId, g]) => ({ setId, owned: g.owned.size, total: sets.get(setId)?.cardCount?.official ?? 0, last: g.last }))
    .filter((r) => r.total > 0 && r.owned > 0 && r.owned < r.total)
    .sort((a, b) => b.owned - a.owned || b.last - a.last);
  const best = rows[0];
  return best ? { ...best, missing: best.total - best.owned, percent: Math.round((best.owned / best.total) * 100) } : null;
}
