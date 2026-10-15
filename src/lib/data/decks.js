// @ts-check
// Decks: storage, list import/export and ownership states (SPEC § 4.2, § 4.2 bis).
// Equivalence is computed on the English cards: deck lists are in English and names must
// match exactly, while the collection may hold copies in any language.
import { db } from '../db.js';
import { cardsNamed, findSetsByCode, getCard, getSet } from '../api/tcgdex.js';
import { copyPrice } from '../domain/cards.js';
import { entryState, sameCard, sectionOfCard } from '../domain/deck.js';
import { listName, listNumber, parseDecklist, serializeDecklist } from '../domain/decklist.js';

/** @typedef {import('../db.js').Deck} Deck */

/**
 * @param {string} name
 * @param {{ cardId: string, qty: number }[]} [cards]
 * @returns {Promise<string>} the new deck id
 */
export async function createDeck(name, cards = []) {
  const now = Date.now();
  const id = crypto.randomUUID();
  // Plain copies: callers may pass Svelte state (Proxies), which IndexedDB cannot store.
  const plain = cards.map((c) => ({ cardId: String(c.cardId), qty: Number(c.qty) }));
  await db.decks.put({ id, name: name.trim() || 'Nuovo deck', format: 'standard', cards: plain, createdAt: now, updatedAt: now });
  return id;
}

/**
 * @param {string} id
 * @param {Partial<Pick<Deck, 'name' | 'cards'>>} patch
 */
export function updateDeck(id, patch) {
  const plain = { ...patch, ...(patch.cards ? { cards: patch.cards.map((c) => ({ cardId: String(c.cardId), qty: Number(c.qty) })) } : {}) };
  return db.decks.update(id, { ...plain, updatedAt: Date.now() });
}

/** @param {string} id */
export function deleteDeck(id) {
  return db.decks.delete(id);
}

/**
 * Changes the copies of a card in a deck (0 removes it).
 * @param {string} id
 * @param {string} cardId
 * @param {number} delta
 */
export async function changeDeckCard(id, cardId, delta) {
  await db.transaction('rw', db.decks, async () => {
    const deck = await db.decks.get(id);
    if (!deck) return;
    const cards = deck.cards.map((c) => ({ ...c }));
    const entry = cards.find((c) => c.cardId === cardId);
    if (entry) entry.qty = Math.max(0, entry.qty + delta);
    else if (delta > 0) cards.push({ cardId, qty: delta });
    await db.decks.update(id, { cards: cards.filter((c) => c.qty > 0), updatedAt: Date.now() });
  });
}

// ---------- import ----------

/**
 * Card id for a list line: set code → TCGdex set → card with that number.
 * @param {{ code: string, number: string }} line
 * @returns {Promise<string | null>}
 */
export async function resolveLine({ code, number }) {
  const sets = (await findSetsByCode(code).catch(() => ({ data: [] }))).data ?? [];
  for (const s of sets) {
    const set = await getSet('en', s.id)
      .then((r) => r.data)
      .catch(() => null);
    const card = (set?.cards ?? []).find(
      (/** @type {any} */ c) =>
        c.localId.toLowerCase() === number.toLowerCase() || (/^\d+$/.test(number) && /^\d+$/.test(c.localId) && Number(c.localId) === Number(number)),
    );
    if (card) return card.id;
  }
  return null;
}

/**
 * Parses a pasted list and finds every card. Unresolved lines are returned for correction.
 * @param {string} text
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function resolveDecklist(text, onProgress) {
  const { lines, errors } = parseDecklist(text);
  /** @type {{ line: import('../domain/decklist.js').ListLine, cardId: string }[]} */
  const resolved = [];
  /** @type {{ raw: string, line: number, reason: string }[]} */
  const unresolved = [...errors];
  let done = 0;
  const queue = [...lines];
  const worker = async () => {
    for (let l = queue.shift(); l; l = queue.shift()) {
      const cardId = await resolveLine(l);
      if (cardId) resolved.push({ line: l, cardId });
      else unresolved.push({ raw: l.raw, line: l.line, reason: `Carta non trovata: ${l.code} ${l.number}` });
      onProgress?.(++done, lines.length);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  resolved.sort((a, b) => a.line.line - b.line.line);
  unresolved.sort((a, b) => a.line - b.line);
  /** @type {Map<string, number>} */
  const qty = new Map();
  for (const r of resolved) qty.set(r.cardId, (qty.get(r.cardId) ?? 0) + r.line.qty);
  return { cards: [...qty.entries()].map(([cardId, q]) => ({ cardId, qty: q })), resolved, unresolved, lines: lines.length };
}

// ---------- export ----------

/**
 * The deck as a text list (English names, set codes, numbers), re-importable.
 * @param {Deck} deck
 */
export async function exportDecklist(deck) {
  const rows = await Promise.all(
    deck.cards.map(async (c) => {
      const card = (await getCard('en', c.cardId)).data;
      const set = card.set?.id ? (await getSet('en', card.set.id).catch(() => null))?.data : null;
      const section = sectionOfCard(card);
      return {
        qty: c.qty,
        name: listName(card.name, section),
        code: set?.abbreviation?.official ?? card.set?.id?.toUpperCase() ?? '???',
        number: listNumber(card.localId),
        section,
      };
    }),
  );
  return serializeDecklist(rows);
}

// ---------- ownership ----------

/**
 * @typedef {{ cardId: string, qty: number, card: any, section: 'Pokémon' | 'Trainer' | 'Energy',
 *   state: import('../domain/deck.js').DeckState, have: number, missing: number, exact: number,
 *   equivalent: number, price: number | null }} DeckRow
 */

/**
 * Resolves every deck entry: English card, section, price and state against the collection.
 * @param {Deck} deck
 * @param {Map<string, number>} owned copies per cardId (all languages and variants)
 * @returns {Promise<DeckRow[]>}
 */
export async function deckRows(deck, owned) {
  return Promise.all(
    deck.cards.map(async (c) => {
      const card = await getCard('en', c.cardId)
        .then((r) => r.data)
        .catch(() => null);
      const exact = owned.get(c.cardId) ?? 0;
      let equivalent = 0;
      if (card && exact < c.qty) {
        const prints = (await cardsNamed('en', card.name).catch(() => ({ data: [] }))).data ?? [];
        for (const p of prints) {
          const n = p.id !== c.cardId ? (owned.get(p.id) ?? 0) : 0;
          if (!n) continue;
          const other = await getCard('en', p.id)
            .then((r) => r.data)
            .catch(() => null);
          if (sameCard(card, other)) equivalent += n;
        }
      }
      const s = entryState(c.qty, exact, equivalent);
      return {
        cardId: c.cardId,
        qty: c.qty,
        card,
        section: sectionOfCard(card),
        ...s,
        exact,
        equivalent,
        price: card ? copyPrice(card, 'normal') ?? copyPrice(card, 'holo') : null,
      };
    }),
  );
}

/** Copies owned per cardId, from the collection. */
export async function ownedMap() {
  /** @type {Map<string, number>} */
  const m = new Map();
  for (const e of await db.collection.toArray()) m.set(e.cardId, (m.get(e.cardId) ?? 0) + e.qty);
  return m;
}

/**
 * Adds the missing cards of a deck to the wishlist ("Ai desideri"). Returns how many were added.
 * @param {DeckRow[]} rows
 */
export async function missingToWishlist(rows) {
  const now = Date.now();
  const missing = rows.filter((r) => r.missing > 0);
  const existing = new Set((await db.wishlist.bulkGet(missing.map((r) => r.cardId))).filter(Boolean).map((w) => /** @type {any} */ (w).cardId));
  const add = missing.filter((r) => !existing.has(r.cardId)).map((r) => ({ cardId: r.cardId, lang: 'en', addedAt: now }));
  await db.wishlist.bulkPut(add);
  return add.length;
}
