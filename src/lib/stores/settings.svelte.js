// @ts-check
// User preferences (synced to Drive with the backup) and device facts (not synced).
import { db } from '../db.js';

export const settings = $state({
  /** Language used to show cards and search (TCGdex lang). */
  cardLang: 'it',
  /** Sets used recently in quick add, newest first. */
  /** @type {string[]} */
  recentSets: [],
  /** navigator.storage.persist() result: true = the browser won't evict IndexedDB. */
  /** @type {boolean | null} */
  persisted: null,
});

const SYNCED = /** @type {const} */ (['cardLang', 'recentSets']);

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
