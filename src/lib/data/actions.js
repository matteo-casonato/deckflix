// @ts-check
// User actions shared by several screens, with their confirmation and "Annulla".
import { getCard } from '../api/tcgdex.js';
import { listVariants } from '../domain/variants.js';
import { collectionKey } from '../domain/collection.js';
import { showToast } from '../stores/toast.svelte.js';
import { addToWishlist, changeCopies, isWished, removeFromWishlist, restoreEntry } from './collection.js';

/**
 * Default print for a quick add: the normal one if it exists, otherwise the first listed.
 * @param {any} card
 */
export function defaultVariant(card) {
  const variants = listVariants(card);
  return variants.find((v) => v.key === 'normal')?.key ?? variants[0]?.key ?? 'normal';
}

/**
 * Adds one copy (default print, or `variant`), with a toast that can undo it.
 * @param {{ cardId: string, lang: string, variant?: string, name?: string }} o
 */
export async function addOneCopy({ cardId, lang, variant, name }) {
  let v = variant;
  let label = name ?? cardId;
  if (!v) {
    try {
      const card = (await getCard(lang, cardId)).data;
      v = defaultVariant(card);
      label = name ?? card.name;
    } catch {
      v = 'normal';
    }
  }
  const copy = { cardId, lang, variant: v };
  const before = await changeCopies(copy, 1);
  const qty = (before?.qty ?? 0) + 1;
  showToast(`${label} aggiunta · ne hai ${qty}`, () => restoreEntry(collectionKey(cardId, lang, v), before));
}

/**
 * Adds to or removes from the wishlist, with undo.
 * @param {string} cardId
 * @param {string} [name]
 */
export async function toggleWish(cardId, name = 'Carta') {
  if (await isWished(cardId)) {
    await removeFromWishlist(cardId);
    showToast(`${name} tolta dai desideri`, () => addToWishlist(cardId));
  } else {
    await addToWishlist(cardId);
    showToast(`${name} aggiunta ai desideri`, () => removeFromWishlist(cardId));
  }
}
