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

/**
 * Code printed at the bottom of a card, as tournament lists want it: "BRS 048/172 F"
 * (set abbreviation, number / cards in the set, regulation mark). Missing parts are left out.
 * @param {any} card English TCGdex card
 * @param {any} [set] its set details (for `abbreviation.official`)
 */
export function printedCode(card, set) {
  const code = set?.abbreviation?.official ?? '';
  const total = set?.cardCount?.official ?? card?.set?.cardCount?.official;
  // TCGdex keeps the number as printed: "048" on modern cards, "16" on old ones.
  const number = total && /^\d+$/.test(card.localId) ? `${card.localId}/${total}` : card.localId;
  return [code, number, card.regulationMark ?? ''].filter(Boolean).join(' ');
}

/**
 * Rows of a tournament deck list (the sheet printed from RK9 Labs for judges): Pokémon one
 * row per print with set code, number and regulation mark; Trainers and Energy by name,
 * copies of different prints added together. Names in English, as on Pokémon TCG Live.
 * @param {{ qty: number, section: string, card: any, cardId: string }[]} rows
 * @param {Map<string, any>} sets set details by id (for `abbreviation.official`)
 */
export function tournamentSheet(rows, sets) {
  /** @param {string} section */
  const byName = (section) => {
    /** @type {Map<string, { qty: number, name: string }>} */
    const m = new Map();
    for (const r of rows.filter((x) => x.section === section)) {
      const name = r.card?.name ?? r.cardId;
      m.set(name, { name, qty: (m.get(name)?.qty ?? 0) + r.qty });
    }
    return [...m.values()];
  };
  const pokemon = rows
    .filter((r) => r.section === 'Pokémon')
    .map((r) => ({
      qty: r.qty,
      name: r.card?.name ?? r.cardId,
      set: sets.get(r.card?.set?.id)?.abbreviation?.official ?? r.card?.set?.id ?? '',
      number: r.card?.localId ?? r.cardId.split('-').pop() ?? '',
      reg: r.card?.regulationMark ?? '',
    }));
  const trainer = byName('Trainer');
  const energy = byName('Energy');
  const sum = (/** @type {{ qty: number }[]} */ l) => l.reduce((n, x) => n + x.qty, 0);
  return { pokemon, trainer, energy, totals: { pokemon: sum(pokemon), trainer: sum(trainer), energy: sum(energy), all: sum(pokemon) + sum(trainer) + sum(energy) } };
}

/** Basic Energy can be played in any number (English data: energyType "Normal"). @param {{ section: string, card: any }} r */
export const isBasicEnergy = (r) =>
  r.section === 'Energy' && r.card?.energyType !== 'Special' && (r.card?.energyType === 'Normal' || /\bbasic\b/i.test(r.card?.name ?? ''));

/**
 * Deck status for the list tags: "In costruzione" under 60 cards, "Valido" at exactly 60 with
 * at most 4 copies of a name (basic Energy excluded) and at least one Basic Pokémon,
 * otherwise "Non valido"; and whether every card is legal in Standard (TCGdex `legal`).
 * Cards whose data is not loaded yet are not counted against Standard.
 * @param {{ qty: number, section: string, card: any, cardId: string }[]} rows
 */
export function deckCheck(rows) {
  const total = rows.reduce((n, r) => n + r.qty, 0);
  /** @type {Map<string, number>} */
  const byName = new Map();
  for (const r of rows) if (!isBasicEnergy(r)) byName.set(r.card?.name ?? r.cardId, (byName.get(r.card?.name ?? r.cardId) ?? 0) + r.qty);
  const tooMany = [...byName.entries()].filter(([, n]) => n > MAX_COPIES).map(([name]) => name);
  const hasBasic = rows.some((r) => r.section === 'Pokémon' && r.card?.stage === 'Basic');
  const notStandard = rows.filter((r) => r.card && r.card.legal?.standard === false).map((r) => r.card.name);
  /** @type {'building' | 'valid' | 'invalid'} */
  const status = total < DECK_SIZE ? 'building' : total === DECK_SIZE && !tooMany.length && hasBasic ? 'valid' : 'invalid';
  return { total, status, standard: notStandard.length === 0, notStandard, tooMany, hasBasic };
}

const RULE_BOX = /\b(ex|EX|V|VSTAR|VMAX|GX)$/;

/**
 * Cards shown as the deck's cover, the main one first: the card chosen by the user (long
 * press, stored as `deck.cover`), otherwise the rule-box Pokémon (ex, V…) among the four
 * most played Pokémon, otherwise the most played Pokémon. Then up to two more Pokémon.
 * Only cards with an image (`hasImage`) can be shown.
 * @param {{ cardId: string, qty: number, section: string, card: any }[]} rows
 * @param {string | null | undefined} cover
 * @param {(r: { card: any }) => boolean} hasImage
 * @param {number} [count]
 */
export function coverCards(rows, cover, hasImage, count = 3) {
  const pokemon = rows.filter((r) => r.section === 'Pokémon' && hasImage(r)).sort((a, b) => b.qty - a.qty || a.cardId.localeCompare(b.cardId));
  const top4 = pokemon.slice(0, 4);
  const chosen = rows.find((r) => r.cardId === cover && hasImage(r));
  const main = chosen ?? top4.find((r) => RULE_BOX.test(r.card?.name ?? '')) ?? pokemon[0];
  if (!main) return [];
  const rest = pokemon.filter((r) => r !== main).sort((a, b) => Number(RULE_BOX.test(b.card?.name ?? '')) - Number(RULE_BOX.test(a.card?.name ?? '')) || b.qty - a.qty);
  return [main, ...rest].slice(0, count).map((r) => r.cardId);
}
