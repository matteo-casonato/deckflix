// @ts-check
// Collection rules (docs/SPEC.md § 3): same card + same language + same variant = same entry.

/**
 * @param {string} cardId
 * @param {string} lang
 * @param {string} variant
 */
export const collectionKey = (cardId, lang, variant) => `${cardId}|${lang}|${variant}`;

/**
 * Entry after adding `delta` copies (negative to remove). Null means "delete the entry"
 * (qty 0 is the same as not owning the card).
 * @param {import('../db.js').CollectionEntry | undefined} current
 * @param {{ cardId: string, setId: string, lang: string, variant: string }} card
 * @param {number} delta
 * @param {number} now
 * @returns {import('../db.js').CollectionEntry | null}
 */
export function addCopies(current, card, delta, now) {
  const qty = Math.max(0, (current?.qty ?? 0) + delta);
  if (qty === 0) return null;
  return {
    ...(current ?? { addedAt: now }),
    key: collectionKey(card.cardId, card.lang, card.variant),
    cardId: card.cardId,
    setId: card.setId,
    lang: card.lang,
    variant: card.variant,
    qty,
    updatedAt: now,
  };
}

/** Card conditions as on Cardmarket, best first: [code, Italian label]. */
export const CONDITIONS = /** @type {const} */ ([
  ['MT', 'Mint'],
  ['NM', 'Near Mint'],
  ['EX', 'Excellent'],
  ['GD', 'Good'],
  ['LP', 'Light Played'],
  ['PL', 'Played'],
  ['PO', 'Poor'],
]);

/** Copies without a condition are Near Mint (the usual state of a card from a pack). */
export const DEFAULT_CONDITION = 'NM';

/** @param {string | undefined | null} code */
export const conditionLabel = (code) => CONDITIONS.find(([c]) => c === (code || DEFAULT_CONDITION))?.[1] ?? 'Near Mint';
