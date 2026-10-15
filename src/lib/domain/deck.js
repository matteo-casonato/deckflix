// @ts-check
// Deck rules (SPEC § 4.2): equivalent cards, owned / other version / missing, summary.

/**
 * Same card for deck building: same name, attacks and abilities (Pokémon); for Trainer and
 * Energy cards the name is enough. Compare cards in the same language.
 * @param {any} a
 * @param {any} b
 */
export function sameCard(a, b) {
  if (!a || !b || a.name !== b.name) return false;
  if (a.category !== 'Pokemon' && a.category !== 'Pokémon') return true;
  const strip = (/** @type {any[] | undefined} */ list) =>
    JSON.stringify((list ?? []).map((x) => ({ name: x.name, cost: x.cost, damage: x.damage, effect: x.effect, type: x.type })));
  return strip(a.attacks) === strip(b.attacks) && strip(a.abilities) === strip(b.abilities);
}

/**
 * @typedef {'owned' | 'other' | 'missing'} DeckState
 * @typedef {{ cardId: string, qty: number }} DeckCard
 */

/**
 * State of one deck entry from the copies owned of that exact print and of equivalent prints.
 * "owned": enough copies of that print; "other": enough counting equivalent prints;
 * "missing": not enough even so.
 * @param {number} need
 * @param {number} exact copies of the same cardId (any language and variant)
 * @param {number} equivalent copies of other prints that are the same card
 * @returns {{ state: DeckState, have: number, missing: number }}
 */
export function entryState(need, exact, equivalent) {
  if (exact >= need) return { state: 'owned', have: need, missing: 0 };
  const have = Math.min(need, exact + equivalent);
  return have >= need ? { state: 'other', have, missing: 0 } : { state: 'missing', have, missing: need - have };
}

/**
 * Category of a TCGdex card for the deck sections.
 * @param {any} card
 * @returns {'Pokémon' | 'Trainer' | 'Energy'}
 */
export function sectionOfCard(card) {
  const c = String(card?.category ?? '').toLowerCase();
  if (c.startsWith('trainer') || c.startsWith('allenat')) return 'Trainer';
  if (c.startsWith('energ')) return 'Energy';
  return 'Pokémon';
}

/**
 * Totals of a deck from its resolved entries.
 * @param {{ qty: number, section: string, state: DeckState, missing: number, price: number | null }[]} rows
 */
export function deckSummary(rows) {
  const count = (/** @type {string} */ s) => rows.filter((r) => r.section === s).reduce((n, r) => n + r.qty, 0);
  const total = rows.reduce((n, r) => n + r.qty, 0);
  const missing = rows.reduce((n, r) => n + r.missing, 0);
  const otherVersion = rows.filter((r) => r.state === 'other').reduce((n, r) => n + r.qty, 0);
  const missingCost = rows.reduce((s, r) => s + (r.price ?? 0) * r.missing, 0);
  const value = rows.reduce((s, r) => s + (r.price ?? 0) * r.qty, 0);
  return {
    total,
    pokemon: count('Pokémon'),
    trainer: count('Trainer'),
    energy: count('Energy'),
    owned: total - missing,
    otherVersion,
    missing,
    missingCost,
    value,
    percent: total ? Math.round(((total - missing) / total) * 100) : 0,
    complete: total > 0 && missing === 0,
  };
}

/** Standard decks have exactly 60 cards and at most 4 copies of a card (basic Energy excluded). */
export const DECK_SIZE = 60;
export const MAX_COPIES = 4;

/** Opening hand size. */
export const HAND_SIZE = 7;

/** Binomial coefficient C(n, k), as a float (exact enough for decks of 60). */
function comb(/** @type {number} */ n, /** @type {number} */ k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/**
 * Deck breakdown like Limitless' builder, from rows with their English TCGdex card
 * (`stage`, `trainerType`, `energyType` are in English there).
 * @param {{ qty: number, section: string, card: any }[]} rows
 */
export function deckBreakdown(rows) {
  const sum = (/** @type {(r: typeof rows[number]) => boolean} */ f) => rows.filter(f).reduce((n, r) => n + r.qty, 0);
  const isBasic = (/** @type {typeof rows[number]} */ r) => r.section === 'Pokémon' && r.card?.stage === 'Basic';
  const trainer = (/** @type {RegExp} */ re) => sum((r) => r.section === 'Trainer' && re.test(String(r.card?.trainerType ?? '')));
  const pokemon = sum((r) => r.section === 'Pokémon');
  const energy = sum((r) => r.section === 'Energy');
  const special = sum((r) => r.section === 'Energy' && r.card?.energyType === 'Special');
  return {
    pokemon: { basic: sum(isBasic), other: pokemon - sum(isBasic), total: pokemon },
    trainer: {
      item: trainer(/^item/i),
      supporter: trainer(/^supporter/i),
      stadium: trainer(/^stadium/i),
      tool: trainer(/tool/i),
      total: sum((r) => r.section === 'Trainer'),
    },
    energy: { basic: energy - special, special, total: energy },
  };
}

/**
 * Opening-hand odds (hypergeometric, 7 cards). Like Limitless, the starter odds are given a
 * hand with at least one Basic (mulligans are redrawn). Forced starter = the only Basic in hand.
 * @param {{ cardId: string, qty: number, section: string, card: any }[]} rows
 */
export function openingHand(rows) {
  const deck = rows.reduce((n, r) => n + r.qty, 0);
  const basics = rows.filter((r) => r.section === 'Pokémon' && r.card?.stage === 'Basic');
  const b = basics.reduce((n, r) => n + r.qty, 0);
  const hands = comb(deck, HAND_SIZE);
  if (deck < HAND_SIZE || !hands) return null;
  const mulligan = comb(deck - b, HAND_SIZE) / hands;
  const valid = 1 - mulligan;
  const one = valid > 0 ? (b * comb(deck - b, HAND_SIZE - 1)) / hands / valid : 0;
  return {
    deck,
    mulligan,
    exactlyOne: one,
    twoOrMore: valid > 0 ? 1 - one : 0,
    starters: basics
      .map((r) => ({
        cardId: r.cardId,
        name: r.card?.name ?? r.cardId,
        possible: valid > 0 ? (1 - comb(deck - r.qty, HAND_SIZE) / hands) / valid : 0,
        forced: valid > 0 ? (comb(deck - b + r.qty, HAND_SIZE) - comb(deck - b, HAND_SIZE)) / hands / valid : 0,
      }))
      .sort((x, y) => y.possible - x.possible),
  };
}
