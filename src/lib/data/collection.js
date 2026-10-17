// @ts-check
// Writes to the collection and the wishlist. Screens read with Dexie liveQuery, so they
// update by themselves; every write also marks the backup "to sync" (sync.js hooks).
import { db } from '../db.js';
import { addCopies, collectionKey } from '../domain/collection.js';
import { setIdOf } from '../domain/cards.js';

/**
 * @typedef {{ cardId: string, lang: string, variant: string, condition?: string | null }} Copy
 */

/**
 * Adds `delta` copies (negative removes). Returns the entry before the change, for "Annulla".
 * @param {Copy} copy
 * @param {number} delta
 */
export async function changeCopies(copy, delta) {
  const key = collectionKey(copy.cardId, copy.lang, copy.variant, copy.condition);
  return db.transaction('rw', db.collection, async () => {
    const before = await db.collection.get(key);
    const next = addCopies(before, { ...copy, setId: setIdOf(copy.cardId) }, delta, Date.now());
    if (next) await db.collection.put(next);
    else await db.collection.delete(key);
    return before ?? null;
  });
}

/**
 * Adds one copy of each card in a single write (a whole set at once) and returns the undo.
 * @param {Copy[]} copies
 * @returns {Promise<() => Promise<void>>}
 */
export async function addOneEach(copies) {
  const now = Date.now();
  const befores = await db.transaction('rw', db.collection, async () => {
    /** @type {{ key: string, before: any }[]} */
    const out = [];
    for (const copy of copies) {
      const key = collectionKey(copy.cardId, copy.lang, copy.variant, copy.condition);
      const before = await db.collection.get(key);
      const next = addCopies(before, { ...copy, setId: setIdOf(copy.cardId) }, 1, now);
      if (next) await db.collection.put(next);
      out.push({ key, before: before ?? null });
    }
    return out;
  });
  return () =>
    db.transaction('rw', db.collection, async () => {
      for (const { key, before } of befores.reverse()) await restoreEntry(key, before);
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
 * Moves a group of copies to another condition, merging with copies already in it.
 * Returns the two entries before the change, for "Annulla".
 * @param {import('../db.js').CollectionEntry} entry
 * @param {string} condition
 */
export async function moveCondition(entry, condition) {
  const toKey = collectionKey(entry.cardId, entry.lang, entry.variant, condition);
  if (toKey === entry.key) return null;
  return db.transaction('rw', db.collection, async () => {
    const target = await db.collection.get(toKey);
    await db.collection.delete(entry.key);
    const { condition: _old, ...rest } = entry;
    await db.collection.put({
      ...rest,
      ...(target ?? {}),
      key: toKey,
      qty: (target?.qty ?? 0) + entry.qty,
      ...(condition !== 'NM' ? { condition } : {}),
      updatedAt: Date.now(),
    });
    return { from: entry, to: target ?? null, toKey };
  });
}

/**
 * Undo of moveCondition.
 * @param {{ from: import('../db.js').CollectionEntry, to: import('../db.js').CollectionEntry | null, toKey: string }} m
 */
export async function undoMoveCondition(m) {
  await db.transaction('rw', db.collection, async () => {
    if (m.to) await db.collection.put(m.to);
    else await db.collection.delete(m.toKey);
    await db.collection.put(m.from);
  });
}
