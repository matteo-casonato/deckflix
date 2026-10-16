// @ts-check
// User preferences (synced to Drive with the backup) and device facts (not synced).
import { db } from '../db.js';

export const settings = $state({
  /** Language used to show cards and search (TCGdex lang). */
  cardLang: 'it',
  /** Sets used recently in quick add, newest first. */
  /** @type {string[]} */
  recentSets: [],
  /** Set binder: images of missing cards in grey (false = numbers only, saves data). */
  missingImages: true,
  /** Play! Pokémon players (the user, children…): name, Player ID, birth year. */
  /** @type {import('../domain/players.js').Player[]} */
  players: [],
  /** Cover card chosen with a long press, by list: "set:sv01", "album:top10", "album:<uuid>". */
  /** @type {Record<string, string>} */
  covers: {},
  /** Share of the Cardmarket price by condition, in % (estimate; see Qualità e prezzi). */
  /** @type {Record<string, number>} */
  conditionFactors: { MT: 110, NM: 100, EX: 85, GD: 70, LP: 60, PL: 45, PO: 30 },
  /** navigator.storage.persist() result: true = the browser won't evict IndexedDB. */
  /** @type {boolean | null} */
  persisted: null,
});

const SYNCED = /** @type {const} */ (['cardLang', 'recentSets', 'missingImages', 'players', 'covers', 'conditionFactors']);

export async function loadSettings() {
  const rows = await db.settings.bulkGet([...SYNCED]);
  rows.forEach((row, i) => {
    if (row) /** @type {any} */ (settings)[SYNCED[i]] = row.value;
  });
  // SPEC § 4.4: ask the browser not to clear the local data when space runs low.
  try {
    settings.persisted = (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false;
  } catch {
    settings.persisted = false;
  }
}

/**
 * @template {typeof SYNCED[number]} K
 * @param {K} key
 * @param {typeof settings[K]} value
 */
export async function setSetting(key, value) {
  /** @type {any} */ (settings)[key] = value;
  await db.settings.put({ key, value: $state.snapshot(value) });
}

/** @param {string} setId */
export function rememberSet(setId) {
  return setSetting('recentSets', [setId, ...settings.recentSets.filter((s) => s !== setId)].slice(0, 6));
}

/**
 * Chooses (or, with the same card again, clears) the cover of a set or album.
 * @param {string} key "set:<id>" or "album:<id>"
 * @param {string} cardId
 * @returns {Promise<string | null>} the new cover, null when back to automatic
 */
export async function toggleCover(key, cardId) {
  const covers = { ...settings.covers };
  const next = covers[key] === cardId ? null : cardId;
  if (next) covers[key] = next;
  else delete covers[key];
  await setSetting('covers', covers);
  return next;
}
