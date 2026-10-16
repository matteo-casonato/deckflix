// @ts-check
// Albums ("Raccolte", SPEC Phase 9): manual boards of cards chosen by the user and automatic
// ones computed from the collection. Pure: entries, cached cards and albums in.
import { copyPrice, priceTrend } from './cards.js';
import { entryPrice } from './value.js';
import { listVariants } from './variants.js';

/**
 * @typedef {import('../db.js').CollectionEntry} Entry
 * @typedef {import('../db.js').Album} Album
 * @typedef {{ cardId: string, qty: number, unit: number, value: number, variants: string[] }} Tile
 * @typedef {{ title: string, tiles: Tile[] }} Group
 */

/** Automatic albums, in the order shown: [id, title, subtitle]. */
export const AUTO_ALBUMS = /** @type {const} */ ([
  ['top10', 'Le 10 più preziose', 'Per prezzo Cardmarket'],
  ['rising', 'In crescita', 'Media 7 giorni sopra quella a 30'],
  ['fullart', 'Full art e illustrazioni', 'Ultrarare, illustrazioni, iper rare'],
  ['duplicates', 'Doppioni', 'Più di una copia'],
  ['holo', 'Holo e reverse', 'Stampe olografiche'],
  ['pokemon', 'Per Pokémon', 'Stesso Pokémon in più carte'],
  ['artist', 'Per illustratore', 'Stesso artista in più carte'],
]);

/** @param {string} id */
export const isAutoAlbum = (id) => AUTO_ALBUMS.some(([k]) => k === id);

// Full-art rarities in the TCGdex languages the app uses (lowercase; checked 15/10/2026).
const FULL_ART = new Set([
  'ultra rare',
  'full art trainer',
  'illustration rare',
  'special illustration rare',
  'hyper rare',
  'secret rare',
  'mega hyper rare',
  'shiny ultra rare',
  'black white rare',
  'ultrarara',
  "allenatore d'arte completa",
  'rara illustrazione',
  'rara illustrazione speciale',
  'rara iper',
  'segreto rara',
  'mega iper raro',
  'ultrarara cromatica',
  'rara bianco e nero',
]);

/** @param {any} card */
export const isFullArt = (card) => FULL_ART.has(String(card?.rarity ?? '').toLowerCase());

/**
 * Highest price among the prints of a card (for covers of cards the user may not own).
 * @param {any} card
 */
export function bestPrice(card) {
  if (!card) return 0;
  const prices = [copyPrice(card, 'normal'), ...listVariants(card).map((v) => v.price)].filter((p) => p != null);
  return Math.max(0, .../** @type {number[]} */ (prices));
}

/**
 * One tile per owned card: total copies, highest unit price among its copies, total value.
 * @param {Entry[]} entries
 * @param {Map<string, any>} cards
 * @param {Record<string, number>} [factors] condition factors in %
 * @returns {Tile[]}
 */
export function ownedTiles(entries, cards, factors) {
  /** @type {Map<string, Tile>} */
  const map = new Map();
  for (const e of entries) {
    const unit = entryPrice(cards.get(e.cardId), e, factors) ?? 0;
    const t = map.get(e.cardId) ?? { cardId: e.cardId, qty: 0, unit: 0, value: 0, variants: [] };
    t.qty += e.qty;
    t.unit = Math.max(t.unit, unit);
    t.value += unit * e.qty;
    if (!t.variants.includes(e.variant)) t.variants.push(e.variant);
    map.set(e.cardId, t);
  }
  return [...map.values()];
}

const byValue = (/** @type {Tile} */ a, /** @type {Tile} */ b) => b.unit - a.unit || a.cardId.localeCompare(b.cardId);

/**
 * Groups of cards sharing a key, only groups with at least two different cards, biggest first.
 * @param {Tile[]} tiles
 * @param {(t: Tile) => string | null} keyOf
 * @param {(tiles: Tile[], key: string) => string} titleOf
 * @returns {Group[]}
 */
function groupBy(tiles, keyOf, titleOf) {
  /** @type {Map<string, Tile[]>} */
  const m = new Map();
  for (const t of tiles) {
    const k = keyOf(t);
    if (k) m.set(k, [...(m.get(k) ?? []), t]);
  }
  return [...m.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([k, list]) => ({ title: titleOf(list, k), tiles: [...list].sort(byValue) }))
    .sort((a, b) => b.tiles.length - a.tiles.length || a.title.localeCompare(b.title, 'it'));
}

/**
 * Contents of an automatic album. One untitled group for flat albums.
 * @param {string} id
 * @param {Tile[]} tiles
 * @param {Map<string, any>} cards
 * @returns {Group[]}
 */
export function autoAlbum(id, tiles, cards) {
  const flat = (/** @type {Tile[]} */ list) => (list.length ? [{ title: '', tiles: list }] : []);
  const card = (/** @type {Tile} */ t) => cards.get(t.cardId);
  switch (id) {
    case 'top10':
      return flat(tiles.filter((t) => t.unit > 0).sort(byValue).slice(0, 10));
    case 'rising':
      return flat(tiles.filter((t) => priceTrend(card(t)) === 'up').sort(byValue));
    case 'fullart':
      return flat(tiles.filter((t) => isFullArt(card(t))).sort(byValue));
    case 'duplicates':
      return flat(tiles.filter((t) => t.qty > 1).sort((a, b) => b.qty - a.qty || byValue(a, b)));
    case 'holo':
      return flat(tiles.filter((t) => t.variants.some((v) => v.startsWith('holo') || v.startsWith('reverse'))).sort(byValue));
    case 'pokemon':
      // dexId is the same in every language, so "Pikachu" and "Pikachu ex" end up together.
      return groupBy(
        tiles,
        (t) => (card(t)?.dexId?.[0] != null ? String(card(t).dexId[0]) : null),
        (list) => list.map((t) => String(card(t)?.name ?? '')).sort((a, b) => a.length - b.length)[0],
      );
    case 'artist':
      return groupBy(tiles, (t) => card(t)?.illustrator || null, (_, k) => k);
    default:
      return [];
  }
}

/**
 * Cover of a manual album: its most valuable card, else the last added.
 * @param {Album} album
 * @param {Map<string, any>} cards
 * @returns {string | null}
 */
export function albumCover(album, cards) {
  if (!album.cards.length) return null;
  let best = album.cards.at(-1)?.cardId ?? null;
  let top = 0;
  for (const { cardId } of album.cards) {
    const p = bestPrice(cards.get(cardId));
    if (p > top) {
      top = p;
      best = cardId;
    }
  }
  return best;
}

/**
 * Cards for a list preview, the cover first: the one chosen by the user when it is still in
 * the list, otherwise the list order (most valuable first). Only cards with an image.
 * @param {string[]} ordered card ids in preference order
 * @param {string | null | undefined} chosen
 * @param {(cardId: string) => boolean} hasImage
 * @param {number} [count]
 */
export function stackIds(ordered, chosen, hasImage, count = 2) {
  const usable = ordered.filter(hasImage);
  const main = chosen && usable.includes(chosen) ? chosen : usable[0];
  return main ? [main, ...usable.filter((id) => id !== main)].slice(0, count) : [];
}
