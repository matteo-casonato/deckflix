// @ts-check
// The only way the app talks to TCGdex (https://tcgdex.dev). Every response is cached in
// Dexie: cards in `cardCache`, everything else in `apiCache`.
// With VITE_TCGDEX_FIXTURES=1 the responses come from tests/fixtures/tcgdex/ instead of
// the network (offline development, same data as the tests).
import { db } from '../db.js';
import { imageAt } from '../domain/cards.js';
import { kindFilter } from '../domain/kinds.js';
import { CARD_TTL, LIST_TTL, cacheDecision } from '../domain/cache.js';

export const BASE_URL = 'https://api.tcgdex.net/v2';
export const LANGS = /** @type {const} */ (['it', 'en', 'es', 'fr', 'de', 'pt']);

/** @typedef {'network' | 'cache' | 'stale'} Source */
/** @template T @typedef {{ data: T, fetchedAt: number, source: Source }} Result */

export class TcgdexError extends Error {
  /**
   * @param {'offline' | 'not-found' | 'http'} kind
   * @param {string} message
   */
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

const useFixtures = import.meta.env.VITE_TCGDEX_FIXTURES === '1';
// Only bundled in fixture mode: the condition is replaced at build time and the dead
// branch, with its dynamic imports, is dropped from production builds.
const fixtures = useFixtures ? import.meta.glob('/tests/fixtures/tcgdex/**/*.json', { import: 'default' }) : {};

/**
 * GET from TCGdex (or the fixtures). Returns null for 404.
 * @param {string} path e.g. "/it/cards/sv03.5-025"
 */
async function fetchJson(path) {
  if (useFixtures) {
    const load = fixtures[`/tests/fixtures/tcgdex${decodeURIComponent(path.split('?')[0])}.json`];
    if (!load) throw new TcgdexError('offline', `Nessuna fixture per ${path}`);
    return load();
  }
  let res;
  try {
    res = await fetch(BASE_URL + path);
  } catch {
    throw new TcgdexError('offline', 'Connessione non disponibile');
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new TcgdexError('http', `TCGdex ha risposto ${res.status}`);
  return res.json();
}

/**
 * Cache-aware request. Stale copies are used when the network fails.
 * @template T
 * @param {{ get: () => Promise<{ data: T, fetchedAt: number } | undefined>, put: (data: T, fetchedAt: number) => Promise<unknown>, path: string, ttl: number }} o
 * @returns {Promise<Result<T>>}
 */
async function cached({ get, put, path, ttl }) {
  const copy = await get().catch(() => undefined);
  const now = Date.now();
  const decision = cacheDecision(copy, { now, ttl, online: useFixtures || navigator.onLine });
  if (copy && decision === 'cache') return { data: copy.data, fetchedAt: copy.fetchedAt, source: 'cache' };
  if (copy && decision === 'stale') return { data: copy.data, fetchedAt: copy.fetchedAt, source: 'stale' };
  if (decision === 'fail') throw new TcgdexError('offline', 'Sei offline e questi dati non sono salvati sul telefono');
  try {
    const data = await fetchJson(path);
    if (data == null) throw new TcgdexError('not-found', 'Non trovato su TCGdex');
    await put(data, now).catch(() => {});
    return { data, fetchedAt: now, source: 'network' };
  } catch (err) {
    if (copy && err instanceof TcgdexError && err.kind !== 'not-found') {
      return { data: copy.data, fetchedAt: copy.fetchedAt, source: 'stale' };
    }
    throw err;
  }
}

/**
 * Full card, with prices and variants. The id is the same in every language.
 * @param {string} lang
 * @param {string} cardId
 * @returns {Promise<Result<any>>}
 */
export function getCard(lang, cardId) {
  return cached({
    path: `/${lang}/cards/${encodeURIComponent(cardId)}`,
    ttl: CARD_TTL,
    get: () => db.cardCache.get([lang, cardId]),
    put: (data, fetchedAt) => db.cardCache.put({ lang, cardId, data, fetchedAt }),
  });
}

/**
 * Any other endpoint, cached by path.
 * @param {string} path
 * @param {number} [ttl]
 * @returns {Promise<Result<any>>}
 */
function getCachedPath(path, ttl = LIST_TTL) {
  return cached({
    path,
    ttl,
    get: () => db.apiCache.get(path),
    put: (data, fetchedAt) => db.apiCache.put({ path, data, fetchedAt }),
  });
}

/** @param {string} lang */
export const getSets = (lang) => getCachedPath(`/${lang}/sets`);

/** @param {string} lang @param {string} setId */
export const getSet = (lang, setId) => getCachedPath(`/${lang}/sets/${encodeURIComponent(setId)}`);

/** @param {string} lang */
export const getSeries = (lang) => getCachedPath(`/${lang}/series`);

/** Results per page in searches. */
export const PAGE_SIZE = 60;

/**
 * Card search with server-side filters (https://tcgdex.dev/rest/filtering-sorting-pagination):
 * name contains `name`; set, type and rarity are exact. Results are card briefs
 * ({ id, localId, name, image? }).
 * @param {string} lang
 * @param {{ name?: string, setId?: string, type?: string, rarity?: string, kind?: string, standard?: boolean, page?: number }} f
 */
export function searchCards(lang, { name, setId, type, rarity, kind, standard, page = 1 }) {
  const p = new URLSearchParams();
  if (name) p.set('name', name);
  if (standard) p.set('legal.standard', 'true');
  if (setId) p.set('set.id', `eq:${setId}`);
  if (type) p.set('types', type);
  if (rarity) p.set('rarity', `eq:${rarity}`);
  // Kind of card (Pokémon, Aiuto, Energia base…): its field and its name in this language.
  const k = kindFilter(kind, lang);
  if (k) p.set(k[0], `eq:${k[1]}`);
  p.set('pagination:page', String(page));
  p.set('pagination:itemsPerPage', String(PAGE_SIZE));
  return getCachedPath(`/${lang}/cards?${p}`, CARD_TTL);
}

/** Page size of number searches: a number exists in many sets. */
export const NUMBER_PAGE_SIZE = 250;

/**
 * Cards with this number in any set. TCGdex matches `eq:` only on numbers with letters
 * ("TG05", case and zeros as printed); digits need the "contains" filter ("25" also finds
 * "125"), so the caller keeps only exact matches.
 * @param {string} lang
 * @param {string} number
 * @param {number} [page]
 */
export function cardsByNumber(lang, number, page = 1) {
  const p = new URLSearchParams();
  p.set('localId', /^\d+$/.test(number) ? number.replace(/^0+(?=\d)/, '') : `eq:${number}`);
  p.set('pagination:page', String(page));
  p.set('pagination:itemsPerPage', String(NUMBER_PAGE_SIZE));
  return getCachedPath(`/${lang}/cards?${p}`, CARD_TTL);
}

/** @param {string} lang */
export const getTypes = (lang) => getCachedPath(`/${lang}/types`);

/** @param {string} lang */
export const getRarities = (lang) => getCachedPath(`/${lang}/rarities`);

/**
 * Image URL of a card, or null when TCGdex has none (SPEC § 2: fall back to English).
 * @param {{ image?: string } | null | undefined} card
 * @param {'low' | 'high'} [quality]
 */
export function cardImage(card, quality = 'low') {
  return imageAt(card?.image, quality);
}

/**
 * Sets whose official abbreviation is `code` (the "SVI" of deck lists). Usually one;
 * a few codes are shared (e.g. a set and its classic collection).
 * @param {string} code
 */
export const findSetsByCode = (code) => getCachedPath(`/en/sets?abbreviation.official=eq:${encodeURIComponent(code)}`);

/**
 * Every print with exactly this name (for "altra versione" in decks).
 * @param {string} lang
 * @param {string} name
 */
export const cardsNamed = (lang, name) => getCachedPath(`/${lang}/cards?name=eq:${encodeURIComponent(name)}`, CARD_TTL);
