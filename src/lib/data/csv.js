// @ts-check
// Rows of the CSV export from the collection, the wishlist or one deck.
import { db } from '../db.js';
import { settings } from '../stores/settings.svelte.js';
import { cachedCards, prefetchCards, setsMap } from './catalog.js';
import { copyPrice, setIdOf } from '../domain/cards.js';
import { listVariants } from '../domain/variants.js';

/**
 * @typedef {import('../domain/csv.js').CsvRow} CsvRow
 * @typedef {{ cardId: string, qty: number, lang?: string, variant?: string }} Line
 */

/**
 * Lines of a source: "collection", "wishlist" or "deck:<id>".
 * @param {string} source
 * @returns {Promise<Line[]>}
 */
async function linesOf(source) {
  if (source === 'collection') return db.collection.toArray();
  if (source === 'wishlist') return (await db.wishlist.toArray()).map((w) => ({ ...w, qty: 1 }));
  const deck = await db.decks.get(source.slice('deck:'.length));
  return deck?.cards ?? [];
}

/**
 * Rows sorted by set and number. Cards missing from the cache are downloaded when online;
 * offline they are exported with their id and an empty price.
 * @param {string} source
 * @returns {Promise<CsvRow[]>}
 */
export async function csvRows(source) {
  const lines = await linesOf(source);
  const lang = settings.cardLang;
  const ids = [...new Set(lines.map((l) => l.cardId))];
  if (navigator.onLine && ids.length) await prefetchCards(ids, lang).catch(() => {});
  const [cards, sets] = await Promise.all([cachedCards(ids, lang), setsMap(lang).catch(() => new Map())]);
  return lines
    .map((l) => {
      const card = cards.get(l.cardId);
      const set = sets.get(setIdOf(l.cardId));
      const variant = l.variant ?? 'normal';
      const total = set?.cardCount?.official;
      const localId = card?.localId ?? l.cardId.slice(setIdOf(l.cardId).length + 1);
      return {
        name: card?.name ?? l.cardId,
        set: set?.name ?? card?.set?.name ?? setIdOf(l.cardId),
        number: total ? `${localId}/${total}` : localId,
        lang: l.lang ?? '',
        variant: (card && listVariants(card).find((v) => v.key === variant)?.label) ?? (variant === 'normal' ? 'Normale' : variant),
        qty: l.qty,
        price: copyPrice(card, variant),
        sort: `${setIdOf(l.cardId)}|${String(localId).padStart(4, '0')}`,
      };
    })
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map(({ sort, ...row }) => row);
}
