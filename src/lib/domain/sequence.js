// @ts-check
// Stepping through the list a card was opened from (see stores/cardSequence.svelte.js).

/**
 * Previous and next card of `id` in a list, and its position (1-based); null when the card is
 * not in the list or the list has a single card.
 * @param {string[]} ids
 * @param {string} id
 * @returns {{ prev: string | null, next: string | null, index: number, total: number } | null}
 */
export function neighbours(ids, id) {
  const i = ids.indexOf(id);
  if (i < 0 || ids.length < 2) return null;
  return { prev: ids[i - 1] ?? null, next: ids[i + 1] ?? null, index: i + 1, total: ids.length };
}
