// @ts-check
// Read helpers over the TCGdex cache for the collection screens.
import { liveQuery } from 'dexie';
import { db } from '../db.js';
import { guessImage, setIdOf } from '../domain/cards.js';
import { getCard, getSetWithCards, getSets } from '../api/tcgdex.js';

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
  /** @type {Map<string, any>} */
  const map = new Map(rows.filter(Boolean).map((r) => [/** @type {any} */ (r).cardId, /** @type {any} */ (r).data]));
  // Old and gallery cards: TCGdex may lack the localized card (EX Deoxys in Italian) or its
  // image (Base Set Charizard). Use the English card or image, else guess the asset path.
  const incomplete = cardIds.filter((id) => !map.get(id)?.image);
  if (!incomplete.length) return map;
  const english =
    lang === 'en'
      ? new Map()
      : new Map(
          (await db.cardCache.bulkGet(incomplete.map((id) => /** @type {[string, string]} */ (['en', id]))))
            .filter(Boolean)
            .map((r) => [/** @type {any} */ (r).cardId, /** @type {any} */ (r).data]),
        );
  for (const id of incomplete) {
    const local = map.get(id);
    const en = english.get(id);
    const card = local ?? en;
    if (!card) continue;
    // Guessed paths in English: localized files are often missing for these cards.
    const image = en?.image ?? guessImage(id, card.localId ?? id.slice(setIdOf(id).length + 1), 'en');
    map.set(id, { ...card, image });
  }
  return map;
}

/** @type {Set<string>} */
const inFlight = new Set();

/**
 * Downloads, a few at a time, the cards not cached yet (for prices and variants).
 * @param {string[]} cardIds
 * @param {string} lang
 */
export async function prefetchCards(cardIds, lang) {
  const ids = [...new Set(cardIds)];
  // Raw cache rows (cachedCards fills gaps with guesses): fetch what is missing, and the
  // English card when the localized one has no image.
  const [local, en] = await Promise.all(
    [lang, 'en'].map((l) => db.cardCache.bulkGet(ids.map((id) => /** @type {[string, string]} */ ([l, id])))),
  );
  const need = (/** @type {number} */ i) => !local[i] || (lang !== 'en' && !local[i]?.data?.image && !en[i]);
  const queue = ids.filter((id, i) => need(i) && !inFlight.has(`${lang}/${id}`));
  queue.forEach((id) => inFlight.add(`${lang}/${id}`));
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const local = await getCard(lang, id).catch(() => null);
      // Not in this language, or without image: the English card fills the gaps.
      if (lang !== 'en' && !local?.data?.image) await getCard('en', id).catch(() => {});
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
      getSetWithCards(lang, id)
        .then((r) => /** @type {[string, any]} */ ([id, r.data]))
        .catch(() => null),
    ),
  );
  return new Map(/** @type {[string, any][]} */ (rows.filter(Boolean)));
}

/**
 * Live map of cached cards. Takes the ids as arguments so that, inside `$derived`, they are
 * read right away and a new query starts when they change (a closure would read them only
 * when the query first runs).
 * @param {string[]} cardIds
 * @param {string} lang
 */
export const liveCards = (cardIds, lang) => liveQuery(() => cachedCards(cardIds, lang));
