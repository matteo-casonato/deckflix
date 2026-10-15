// @ts-check
// The only way the app talks to TCGdex (https://tcgdex.dev). Every response is cached in
// Dexie: cards in `cardCache`, everything else in `apiCache`.
// With VITE_TCGDEX_FIXTURES=1 the responses come from tests/fixtures/tcgdex/ instead of
// the network (offline development, same data as the tests).
import { db } from '../db.js';
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

/**
 * Cards whose name contains `name` (TCGdex filter syntax: https://tcgdex.dev/rest/filtering-sorting-pagination).
 * @param {string} lang
 * @param {string} name
 */
export const searchCards = (lang, name) => getCachedPath(`/${lang}/cards?name=${encodeURIComponent(name)}`, CARD_TTL);

/**
 * Image URL of a card, or null when TCGdex has none (SPEC § 2: fall back to English).
 * @param {{ image?: string } | null | undefined} card
 * @param {'low' | 'high'} [quality]
 */
export function cardImage(card, quality = 'low') {
  return card?.image ? `${card.image}/${quality}.webp` : null;
}
