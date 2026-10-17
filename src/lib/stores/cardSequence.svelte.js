// @ts-check
// The list a card was opened from (a set, an album, the collection, search results, the
// wishlist), so the card screen can step to the previous and next card. Set when a card of the
// list is tapped, cleared when the app shows another kind of screen; kept in sessionStorage so a
// reload of the card keeps its arrows.

const KEY = 'deckflix:cardSequence';

/** @returns {string[]} */
function load() {
  try {
    const ids = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export const cardSequence = $state({ ids: load() });

/** @param {string[]} ids */
function save(ids) {
  cardSequence.ids = ids;
  try {
    if (ids.length) sessionStorage.setItem(KEY, JSON.stringify(ids));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Private mode or storage blocked: the arrows last until the next reload.
  }
}

/**
 * Remembers the list of card ids, in the order shown, when one of them is opened.
 * @param {string[]} ids
 */
export const setCardSequence = (ids) => save(ids);

export function clearCardSequence() {
  if (cardSequence.ids.length) save([]);
}
