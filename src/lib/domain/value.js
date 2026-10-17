// @ts-check
// Collection value and statistics (SPEC § 4.3). Pure: entries, cached cards and snapshots in.
import { copyPrice, priceTrend, standardPrint } from './cards.js';
import { conditionFactor } from './collection.js';

/**
 * @typedef {import('../db.js').CollectionEntry} Entry
 * @typedef {import('../db.js').PriceSnapshot} Snapshot
 */

/** Local calendar day "YYYY-MM-DD" (snapshots are one per day). */
/** @param {number | Date} t */
export function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Estimated price of one copy: Cardmarket price of its print × its condition factor.
 * @param {any} card
 * @param {{ variant: string, condition?: string }} entry
 * @param {Record<string, number>} [factors]
 * @param {'low' | 'trend'} [field] price field (default: the reference one)
 */
export function entryPrice(card, entry, factors, field = undefined) {
  const p = copyPrice(card, entry.variant, field);
  return p == null ? null : Math.round(p * conditionFactor(entry.condition, factors) * 100) / 100;
}

/**
 * Value = sum of estimated price × qty. Copies without a price don't count and are reported.
 * @param {Entry[]} entries
 * @param {Map<string, any>} cards full TCGdex cards by id (any language: prices are the same)
 * @param {Record<string, number>} [factors] condition factors in %
 * @param {'low' | 'trend'} [field] price field (default: the reference one)
 */
export function collectionValue(entries, cards, factors, field = undefined) {
  let total = 0;
  let unpriced = 0;
  let missingData = 0;
  for (const e of entries) {
    const card = cards.get(e.cardId);
    if (!card) {
      missingData += e.qty;
      continue;
    }
    const p = entryPrice(card, e, factors, field);
    if (p == null) unpriced += e.qty;
    else total += p * e.qty;
  }
  return { total: Math.round(total * 100) / 100, unpriced, missingData };
}

/** Periods of the statistics screen, in days (null = all). */
export const PERIODS = /** @type {const} */ ([
  ['7', '7 g', 7],
  ['30', '30 g', 30],
  ['365', '1 anno', 365],
  ['all', 'Tutto', null],
]);

/**
 * The daily values with one kind of price, as { date, totalValue }: snapshots keep the value
 * with the trend (`totalValue`) and the lowest price (`lowValue`, recorded since 17/10/2026),
 * so the chart never mixes the two.
 * @param {Snapshot[]} snapshots
 * @param {'low' | 'trend'} field
 * @returns {Snapshot[]}
 */
export function snapshotSeries(snapshots, field) {
  if (field === 'trend') return snapshots;
  return snapshots.filter((s) => typeof s.lowValue === 'number').map((s) => ({ date: s.date, totalValue: /** @type {number} */ (s.lowValue) }));
}

/**
 * Snapshots inside the period plus the change from its first to its last value.
 * The first point is the last snapshot on or before the start, so a 30-day change still
 * works when the oldest snapshot is 35 days old.
 * @param {Snapshot[]} snapshots
 * @param {number | null} days
 * @param {number} now
 */
export function periodChange(snapshots, days, now) {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return { points: [], delta: null, pct: null };
  const start = days == null ? sorted[0].date : dayKey(now - days * 86_400_000);
  const before = sorted.filter((s) => s.date <= start).at(-1);
  const inside = sorted.filter((s) => s.date > start);
  const points = before ? [before, ...inside] : inside;
  if (points.length < 2) return { points, delta: null, pct: null };
  const first = points[0].totalValue;
  const last = points.at(-1)?.totalValue ?? first;
  return { points, delta: last - first, pct: first > 0 ? ((last - first) / first) * 100 : null };
}

/**
 * Numbers and lists of the statistics screen.
 * @param {Entry[]} entries
 * @param {Map<string, any>} cards
 * @param {Record<string, number>} [factors]
 */
export function collectionStats(entries, cards, factors) {
  const copies = entries.reduce((n, e) => n + e.qty, 0);
  /** @type {Map<string, { cardId: string, qty: number, unit: number, variant: string }>} */
  const byCard = new Map();
  for (const e of entries) {
    const unit = entryPrice(cards.get(e.cardId), e, factors) ?? 0;
    const t = byCard.get(e.cardId);
    if (!t) byCard.set(e.cardId, { cardId: e.cardId, qty: e.qty, unit, variant: e.variant });
    else {
      t.qty += e.qty;
      if (unit > t.unit) {
        t.unit = unit;
        t.variant = e.variant;
      }
    }
  }
  const tiles = [...byCard.values()];
  /** @param {(e: Entry) => string} key */
  const countBy = (key) => {
    /** @type {Map<string, number>} */
    const m = new Map();
    for (const e of entries) m.set(key(e), (m.get(key(e)) ?? 0) + e.qty);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    copies,
    unique: byCard.size,
    sets: new Set(entries.map((e) => e.setId)).size,
    duplicates: tiles.reduce((n, t) => n + Math.max(0, t.qty - 1), 0),
    // Prints other than the card's standard one (stamps, 1st edition, holo where a normal
    // print exists); reverse holos are counted apart.
    special: entries.filter((e) => !e.variant.startsWith('reverse') && e.variant !== standardPrint(cards.get(e.cardId))).reduce((n, e) => n + e.qty, 0),
    reverse: entries.filter((e) => e.variant.startsWith('reverse')).reduce((n, e) => n + e.qty, 0),
    mostValuable: tiles.filter((t) => t.unit > 0).sort((a, b) => b.unit - a.unit).slice(0, 5),
    rising: tiles
      .map((t) => {
        const cm = cards.get(t.cardId)?.pricing?.cardmarket;
        const pct = priceTrend(cards.get(t.cardId)) === 'up' ? (cm.avg7 / cm.avg30 - 1) * 100 : null;
        return { ...t, pct };
      })
      .filter((t) => t.pct != null)
      .sort((a, b) => /** @type {number} */ (b.pct) - /** @type {number} */ (a.pct))
      .slice(0, 5),
    byRarity: countBy((e) => cards.get(e.cardId)?.rarity ?? 'Sconosciuta'),
    byLang: countBy((e) => e.lang),
  };
}
