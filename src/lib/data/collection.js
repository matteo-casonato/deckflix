// @ts-check
// Writes to the collection and the wishlist. Screens read with Dexie liveQuery, so they
// update by themselves; every write also marks the backup "to sync" (sync.js hooks).
import { db } from '../db.js';
import { addCopies, collectionKey } from '../domain/collection.js';
import { setIdOf } from '../domain/cards.js';

/**
 * @typedef {{ cardId: string, lang: string, variant: string }} Copy
 */

/**
 * Adds `delta` copies (negative removes). Returns the entry before the change, for "Annulla".
 * @param {Copy} copy
 * @param {number} delta
 */
export async function changeCopies(copy, delta) {
  const key = collectionKey(copy.cardId, copy.lang, copy.variant);
  return db.transaction('rw', db.collection, async () => {
    const before = await db.collection.get(key);
    const next = addCopies(before, { ...copy, setId: setIdOf(copy.cardId) }, delta, Date.now());
    if (next) await db.collection.put(next);
    else await db.collection.delete(key);
    return before ?? null;
  });
}

/**
 * Restores an entry to a previous state (undo).
 * @param {string} key
 * @param {import('../db.js').CollectionEntry | null} before
 */
export async function restoreEntry(key, before) {
  if (before) await db.collection.put(before);
  else await db.collection.delete(key);
}

/**
 * All entries of one card (every language and variant).
 * @param {string} cardId
 */
export function entriesOf(cardId) {
  return db.collection.where('cardId').equals(cardId).toArray();
}

/**
 * @param {string} cardId
 */
export function isWished(cardId) {
  return db.wishlist.get(cardId).then(Boolean);
}

/**
 * @param {string} cardId
 * @param {{ lang?: string, variant?: string }} [o]
 */
export function addToWishlist(cardId, o = {}) {
  return db.wishlist.put({ cardId, ...o, addedAt: Date.now() });
}

/** @param {string} cardId */
export function removeFromWishlist(cardId) {
  return db.wishlist.delete(cardId);
}

/**
 * "Sposta nei desideri": removes every copy of the card and adds it to the wishlist.
 * Returns what was removed, for "Annulla".
 * @param {string} cardId
 * @param {{ lang?: string, variant?: string }} [o]
 */
export async function moveToWishlist(cardId, o = {}) {
  return db.transaction('rw', db.collection, db.wishlist, async () => {
    const removed = await db.collection.where('cardId').equals(cardId).toArray();
    await db.collection.bulkDelete(removed.map((e) => e.key));
    await db.wishlist.put({ cardId, ...o, addedAt: Date.now() });
    return removed;
  });
}

/**
 * Undo of moveToWishlist.
 * @param {string} cardId
 * @param {import('../db.js').CollectionEntry[]} removed
 */
export async function undoMoveToWishlist(cardId, removed) {
  await db.transaction('rw', db.collection, db.wishlist, async () => {
    await db.collection.bulkPut(removed);
    await db.wishlist.delete(cardId);
  });
}

/**
 * Condition of the copies of a card in one language and print (Cardmarket scale).
 * @param {string} key collection key (card, language, print)
 * @param {string} condition
 */
export const setCondition = (key, condition) => db.collection.update(key, { condition, updatedAt: Date.now() });
