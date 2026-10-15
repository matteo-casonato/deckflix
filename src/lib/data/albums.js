// @ts-check
// Manual albums ("Raccolte"): stored in Dexie and saved with the backup.
import { db } from '../db.js';

/**
 * @param {string} name
 * @param {string | null} [cardId] first card, when created from a card
 */
export async function createAlbum(name, cardId = null) {
  const now = Date.now();
  const id = crypto.randomUUID();
  await db.albums.put({
    id,
    name: name.trim() || 'Nuova raccolta',
    cards: cardId ? [{ cardId, addedAt: now }] : [],
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/**
 * Adds the card, or removes it when it is already there. Returns true when added.
 * @param {string} albumId
 * @param {string} cardId
 */
export async function toggleInAlbum(albumId, cardId) {
  let added = false;
  await db.transaction('rw', db.albums, async () => {
    const album = await db.albums.get(albumId);
    if (!album) return;
    added = !album.cards.some((c) => c.cardId === cardId);
    const cards = added ? [...album.cards, { cardId, addedAt: Date.now() }] : album.cards.filter((c) => c.cardId !== cardId);
    // Plain objects: IndexedDB can't clone Svelte state proxies.
    await db.albums.update(albumId, { cards: cards.map((c) => ({ cardId: c.cardId, addedAt: c.addedAt })), updatedAt: Date.now() });
  });
  return added;
}

/** @param {string} albumId @param {string} name */
export const renameAlbum = (albumId, name) => db.albums.update(albumId, { name: name.trim() || 'Raccolta', updatedAt: Date.now() });

/** Returns the deleted album, for "Annulla". @param {string} albumId */
export async function deleteAlbum(albumId) {
  const album = await db.albums.get(albumId);
  await db.albums.delete(albumId);
  return album;
}

/** @param {import('../db.js').Album} album */
export const restoreAlbum = (album) => db.albums.put(album);
