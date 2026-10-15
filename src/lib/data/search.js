// @ts-check
// Smart card search over all of TCGdex: name in the card language or in English ("Iono" finds
// Kissara), number ("025", "11/78") and set code or id ("svi", "sv03.5").
import { NUMBER_PAGE_SIZE, PAGE_SIZE, cardsByNumber, findSetsByCode, getCard, getSet, searchCards } from '../api/tcgdex.js';
import { setIdOf } from '../domain/cards.js';
import { normalizeNumber, parseSearchQuery, withSets } from '../domain/searchQuery.js';

/** Pages fetched when results are filtered locally by number or set size. */
const MAX_FILTER_PAGES = 4;
/** English-name matches translated to the card language, at most. */
const MAX_TRANSLATED = 40;

/**
 * @typedef {{ id: string, localId: string, name: string, image?: string }} Brief
 * @typedef {{ setId: string, type: string, rarity: string, standard: boolean }} Filters
 * @typedef {{ results: Brief[], more: boolean, understood: { sets: string[], number: string | null, total: number | null, english: number } }} SearchResult
 */

/**
 * Set ids for the code-like words of the query: set ids ("sv03.5") or printed codes ("SVI").
 * @param {string[]} codes
 * @param {Map<string, any>} sets
 */
async function resolveCodes(codes, sets) {
  /** @type {Map<string, string[]>} code → set ids */
  const found = new Map();
  await Promise.all(
    codes.map(async (code) => {
      const lower = code.toLowerCase();
      if (sets.has(lower)) return found.set(code, [lower]);
      if (!/^[a-z]{2,5}$/i.test(code)) return;
      const r = await findSetsByCode(code.toUpperCase()).catch(() => null);
      const ids = (r?.data ?? []).map((/** @type {any} */ s) => s.id);
      if (ids.length) found.set(code, ids);
    }),
  );
  return found;
}

/**
 * Pages of a name search, merged. `pages` > 1 when results are filtered afterwards.
 * @param {string} lang @param {any} params @param {number} page @param {number} pages
 */
async function namePages(lang, params, page, pages) {
  /** @type {Brief[]} */
  let all = [];
  let more = false;
  for (let p = page; p < page + pages; p++) {
    const res = await searchCards(lang, { ...params, page: p });
    all = all.concat(res.data);
    more = res.data.length === PAGE_SIZE;
    if (!more) break;
  }
  return { list: all, more };
}

/**
 * Cards with this number in any set. Numbers with letters are asked as
 * printed ("TG05"), and also with two digits ("tg5" → "TG05").
 * @param {string} lang @param {string} raw @param {(c: Brief) => boolean} keep @param {number} page
 */
async function byNumber(lang, raw, keep, page) {
  const up = raw.toUpperCase();
  const m = up.match(/^([A-Z]+)0*(\d+)$/);
  const variants = m ? [...new Set([up, `${m[1]}${m[2].padStart(2, '0')}`, `${m[1]}${m[2]}`])] : [up];
  const pages = await Promise.all(variants.map((v) => cardsByNumber(lang, v, page).then((r) => r.data).catch(() => [])));
  const seen = new Set();
  const results = pages
    .flat()
    .filter((c) => !seen.has(c.id) && seen.add(c.id) && keep(c));
  return { results, more: pages.some((p) => p.length === NUMBER_PAGE_SIZE) };
}

/**
 * @param {string} lang
 * @param {string} text
 * @param {Filters} filters
 * @param {Map<string, any>} sets setsMap(lang)
 * @param {number} page
 * @returns {Promise<SearchResult>}
 */
export async function smartSearch(lang, text, filters, sets, page = 1) {
  const q = parseSearchQuery(text);
  const resolved = await resolveCodes(q.codes, sets);
  const { name, useSets, number: rawNumber } = withSets(q, [...resolved.keys()]);
  let setIds = useSets ? [...new Set([...resolved.values()].flat())] : [];
  if (filters.setId) setIds = [filters.setId];
  const number = rawNumber ? normalizeNumber(rawNumber) : null;
  const total = q.total;

  /** @param {Brief} c */
  const keep = (c) =>
    (!number || normalizeNumber(String(c.localId)) === number) &&
    (!total || sets.get(setIdOf(c.id))?.cardCount?.official === total) &&
    (!setIds.length || setIds.includes(setIdOf(c.id)));

  const understood = { sets: setIds.map((id) => sets.get(id)?.name ?? id), number: rawNumber, total, english: 0 };
  const local = Boolean(number || total || setIds.length > 1);
  const params = { type: filters.type, rarity: filters.rarity, standard: filters.standard, setId: setIds.length === 1 ? setIds[0] : '' };

  // No name: browse the set(s), or the sets of that size, by number.
  if (!name.trim()) {
    const ids = setIds.length ? setIds : total ? [...sets.values()].filter((s) => s.cardCount?.official === total).map((s) => s.id).slice(0, 8) : [];
    // Only a number ("tg05", "025"): that number in every set.
    if (!ids.length && rawNumber) return { ...(await byNumber(lang, rawNumber, keep, page)), understood };
    if (!ids.length) return { results: [], more: false, understood };
    if (ids.length === 1 && !number) {
      const { list, more } = await namePages(lang, params, page, 1);
      return { results: list, more, understood };
    }
    const lists = await Promise.all(
      ids.map((id) =>
        getSet(lang, id)
          .catch(() => getSet('en', id))
          .then((r) => (r.data.cards ?? []).map((/** @type {any} */ c) => ({ ...c, id: c.id })))
          .catch(() => []),
      ),
    );
    return { results: lists.flat().filter(keep), more: false, understood };
  }

  // Name in the card language and, in parallel, in English.
  const pages = local ? MAX_FILTER_PAGES : 1;
  const [mine, en] = await Promise.all([
    namePages(lang, { ...params, name }, page, pages),
    lang === 'en' || page > 1 ? Promise.resolve({ list: [], more: false }) : namePages('en', { ...params, name }, 1, pages).catch(() => ({ list: [], more: false })),
  ]);
  const seen = new Set(mine.list.map((c) => c.id));
  const needle = name.trim().toLowerCase();
  // The card itself first ("Iono" before "Iono's Voltorb"), then names starting with the text.
  const rank = (/** @type {Brief} */ c) => (c.name.toLowerCase() === needle ? 0 : c.name.toLowerCase().startsWith(needle) ? 1 : 2);
  const extra = en.list
    .filter((c) => !seen.has(c.id) && keep(c))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, MAX_TRANSLATED);
  // Show English-name matches with their name and image in the card language when available.
  const translated = await Promise.all(
    extra.map((c) =>
      getCard(lang, c.id)
        .then((r) => ({ id: r.data.id, localId: r.data.localId, name: r.data.name, image: r.data.image ?? c.image }))
        .catch(() => c),
    ),
  );
  // Only cards whose name in the card language is different: the others are already among the
  // local results (on this page or the next ones).
  const english = translated.filter((c) => !c.name.toLowerCase().includes(needle));
  understood.english = english.length;
  const results = [...mine.list.filter(keep), ...english].sort((a, b) => rank(a) - rank(b));
  return { results, more: !local && mine.more, understood };
}

/**
 * The same query over a list of cards already on the phone ("Solo le mie", offline):
 * name in the card language or English, number, set size and set code.
 * @param {Brief[]} cards cards in the card language
 * @param {Map<string, any>} english English cards by id (for "Iono" → Kissara)
 * @param {string} text
 * @param {Map<string, any>} sets
 */
export async function filterByQuery(cards, english, text, sets) {
  const q = parseSearchQuery(text);
  const resolved = await resolveCodes(q.codes, sets);
  const { name, useSets, number: rawNumber } = withSets(q, [...resolved.keys()]);
  const setIds = useSets ? [...new Set([...resolved.values()].flat())] : [];
  const number = rawNumber ? normalizeNumber(rawNumber) : null;
  const needle = name.trim().toLowerCase();
  return cards.filter(
    (c) =>
      (!needle || c.name.toLowerCase().includes(needle) || String(english.get(c.id)?.name ?? '').toLowerCase().includes(needle)) &&
      (!number || normalizeNumber(String(c.localId)) === number) &&
      (!q.total || sets.get(setIdOf(c.id))?.cardCount?.official === q.total) &&
      (!setIds.length || setIds.includes(setIdOf(c.id))),
  );
}
