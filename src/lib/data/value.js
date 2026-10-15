// @ts-check
// Collection value from cached TCGdex prices, and the daily snapshot (SPEC § 4.3):
// TCGdex has no price history, so the app saves one value per day and builds it over time.
import { db } from '../db.js';
import { settings } from '../stores/settings.svelte.js';
import { cachedCards, prefetchCards } from './catalog.js';
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
  return { entries, cards, value: collectionValue(entries, cards) };
}

/**
 * Saves today's value. Only with data for every card, so a phone offline at startup doesn't
 * record a value that is too low. Later in the day the snapshot is updated with the latest value.
 */
export async function recordTodaySnapshot() {
  const { entries, value } = await valuedCollection({ refresh: navigator.onLine });
  if (!entries.length || value.missingData > 0) return null;
  const date = dayKey(Date.now());
  const existing = await db.priceSnapshots.get(date);
  if (existing && Math.abs(existing.totalValue - value.total) < 0.005) return existing;
  const snap = { date, totalValue: value.total };
  await db.priceSnapshots.put(snap);
  return snap;
}
