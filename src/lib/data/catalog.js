// @ts-check
// Read helpers over the TCGdex cache for the collection screens.
import { db } from '../db.js';
import { getCard, getSet, getSets } from '../api/tcgdex.js';

/**
 * Sets by id in `lang`, completed with the English list for sets not translated.
 * @param {string} lang
 * @returns {Promise<Map<string, any>>}
 */
export async function setsMap(lang) {
  const [local, en] = await Promise.all([
    getSets(lang).then((r) => r.data).catch(() => []),
    lang === 'en' ? Promise.resolve([]) : getSets('en').then((r) => r.data).catch(() => []),
  ]);
  const map = new Map();
  for (const s of en) map.set(s.id, s);
  for (const s of local) map.set(s.id, s);
  return map;
}

/**
 * Cached full cards (with prices) for these ids, without network. Missing ones are absent.
 * Use inside liveQuery: it re-runs when prefetchCards fills the cache.
 * @param {string[]} cardIds
 * @param {string} lang
 * @returns {Promise<Map<string, any>>}
 */
export async function cachedCards(cardIds, lang) {
  const rows = await db.cardCache.bulkGet(cardIds.map((id) => /** @type {[string, string]} */ ([lang, id])));
  return new Map(rows.filter(Boolean).map((r) => [/** @type {any} */ (r).cardId, /** @type {any} */ (r).data]));
}

/** @type {Set<string>} */
const inFlight = new Set();

/**
 * Downloads, a few at a time, the cards not cached yet (for prices and variants).
 * @param {string[]} cardIds
 * @param {string} lang
 */
export async function prefetchCards(cardIds, lang) {
  const have = await cachedCards(cardIds, lang);
  const queue = [...new Set(cardIds)].filter((id) => !have.has(id) && !inFlight.has(`${lang}/${id}`));
  queue.forEach((id) => inFlight.add(`${lang}/${id}`));
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      await getCard(lang, id).catch(() => {});
      inFlight.delete(`${lang}/${id}`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
}

/**
 * Set details (abbreviation, serie, release date) for a few sets, from the cache when possible.
 * @param {string[]} setIds
 * @param {string} lang
 * @returns {Promise<Map<string, any>>}
 */
export async function setDetails(setIds, lang) {
  const rows = await Promise.all(
    [...new Set(setIds)].map((id) =>
      getSet(lang, id)
        .catch(() => getSet('en', id))
        .then((r) => /** @type {[string, any]} */ ([id, r.data]))
        .catch(() => null),
    ),
  );
  return new Map(/** @type {[string, any][]} */ (rows.filter(Boolean)));
}
