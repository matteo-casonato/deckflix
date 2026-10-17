// @ts-check
// Collection value from cached TCGdex prices, and the daily snapshot (SPEC § 4.3):
// TCGdex has no price history, so the app saves one value per day and builds it over time.
import { db } from '../db.js';
import { settings } from '../stores/settings.svelte.js';
import { cachedCards, prefetchCards } from './catalog.js';
import { copyPrice } from '../domain/cards.js';
import { collectionValue, dayKey } from '../domain/value.js';

/**
 * Entries and their cached cards (prices refresh once a day through the card cache).
 * @param {{ refresh?: boolean }} [o] refresh: download missing or expired cards first
 */
export async function valuedCollection({ refresh = false } = {}) {
  const entries = await db.collection.toArray();
  const ids = [...new Set(entries.map((e) => e.cardId))];
  if (refresh && ids.length) await prefetchCards(ids, settings.cardLang);
  const cards = await cachedCards(ids, settings.cardLang);
  return { entries, cards, value: collectionValue(entries, cards, settings.conditionFactors) };
}

/**
 * Saves today's value. Only with data for every card, so a phone offline at startup doesn't
 * record a value that is too low. Later in the day the snapshot is updated with the latest value.
 */
export async function recordTodaySnapshot() {
  const { entries, cards, value } = await valuedCollection({ refresh: navigator.onLine });
  if (!entries.length || value.missingData > 0) return null;
  const date = dayKey(Date.now());
  await recordCardPrices(date).catch(() => {});
  // Both kinds of price every day: the chart follows the one chosen, with its own history.
  const trend = collectionValue(entries, cards, settings.conditionFactors, 'trend').total;
  const low = collectionValue(entries, cards, settings.conditionFactors, 'low').total;
  const existing = await db.priceSnapshots.get(date);
  if (existing && Math.abs(existing.totalValue - trend) < 0.005 && Math.abs((existing.lowValue ?? -1) - low) < 0.005) return existing;
  const snap = { date, totalValue: trend, lowValue: low };
  await db.priceSnapshots.put(snap);
  return snap;
}

/**
 * Today's Cardmarket price of every owned or wished card, one row per card and day: the
 * history behind the chart in the card page. Local only (not in the Drive backup): it is
 * rebuilt day by day and would make the backup grow.
 * @param {string} date
 */
async function recordCardPrices(date) {
  const ids = [...new Set([...(await db.collection.toArray()).map((e) => e.cardId), ...(await db.wishlist.toArray()).map((w) => w.cardId)])];
  const cards = await cachedCards(ids, settings.cardLang);
  const rows = ids
    .map((cardId) => ({ cardId, date, price: copyPrice(cards.get(cardId), 'normal', 'trend') ?? null, low: copyPrice(cards.get(cardId), 'normal', 'low') ?? undefined }))
    .filter((r) => typeof r.price === 'number' && r.price > 0);
  await db.cardPrices.bulkPut(/** @type {import('../db.js').CardPrice[]} */ (rows));
}
