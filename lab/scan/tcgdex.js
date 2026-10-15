// @ts-check
// Minimal TCGdex client for the scan prototype (in-memory + sessionStorage cache).
import { confusableNumbers, nameSimilarity, setCodeMatches } from '../../src/lib/domain/recognize.js';
import { CLASSIC_COLLECTION_SETS } from '../../src/lib/domain/variants.js';

const BASE = 'https://api.tcgdex.net/v2';

/** @type {Map<string, Promise<any>>} */
const memory = new Map();

/** @param {string} path */
async function get(path) {
  if (memory.has(path)) return memory.get(path);
  const promise = (async () => {
    try {
      const cached = sessionStorage.getItem(path);
      if (cached) return JSON.parse(cached);
    } catch {}
    const res = await fetch(BASE + path);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`TCGdex ${res.status} su ${path}`);
    const data = await res.json();
    try {
      sessionStorage.setItem(path, JSON.stringify(data));
    } catch {}
    return data;
  })();
  memory.set(path, promise);
  promise.catch(() => memory.delete(path));
  return promise;
}

/**
 * @typedef {{ id: string, localId: string, name: string, image?: string, setId: string, setName: string, setCode: string | null, releaseDate: string, lang: string, nameScore: number, codeMatch: boolean, reprint?: boolean }} Candidate
 */

/**
 * Finds cards whose set has `total` official cards and whose number is `number`.
 * Candidates are sorted by set code match, then by how well their name matches the OCR text
 * of the top strip, then newest set first.
 * @param {{ number: number, total: number, lang: string, nameText: string, setCode?: string | null }} q
 * @returns {Promise<Candidate[]>}
 */
export async function findCandidates({ number, total, lang, nameText, setCode = null }) {
  // Sets not translated into `lang` are missing from its list: fall back to English.
  const langs = lang === 'en' ? ['en'] : [lang, 'en'];
  /** @type {Candidate[]} */
  const out = [];
  const seen = new Set();

  for (const l of langs) {
    const sets = (await get(`/${l}/sets`)) ?? [];
    const matching = sets.filter((/** @type {any} */ s) => s.cardCount?.official === total);
    const details = await Promise.all(matching.map((/** @type {any} */ s) => get(`/${l}/sets/${s.id}`)));
    for (const set of details) {
      if (!set) continue;
      for (const card of set.cards ?? []) {
        if (Number.parseInt(card.localId, 10) !== number || seen.has(card.id)) continue;
        seen.add(card.id);
        out.push({
          id: card.id,
          localId: card.localId,
          name: card.name,
          image: card.image,
          setId: set.id,
          setName: set.name,
          setCode: set.abbreviation?.official ?? null,
          releaseDate: set.releaseDate ?? '',
          lang: l,
          nameScore: nameSimilarity(card.name, nameText),
          codeMatch: setCodeMatches(setCode, set.abbreviation?.official),
        });
      }
    }
    if (out.length) break;
  }

  return out.sort(
    (a, b) =>
      Number(b.codeMatch) - Number(a.codeMatch) ||
      b.nameScore - a.nameScore ||
      b.releaseDate.localeCompare(a.releaseDate),
  );
}

/**
 * Official card counts of all known sets, to reject OCR readings like "22/25"
 * when no set has 25 cards.
 * @param {string} lang
 * @returns {Promise<Set<number>>}
 */
export async function knownTotals(lang) {
  const lists = await Promise.all([get(`/${lang}/sets`), get('/en/sets')]);
  return new Set(lists.flatMap((l) => l ?? []).map((/** @type {any} */ s) => s.cardCount?.official));
}

/** Name score above which a candidate is trusted without trying other numbers. */
const NAME_OK = 0.7;

/**
 * Like findCandidates, but when no candidate's name matches the OCR text it retries with
 * numbers that differ by one commonly confused digit (only totals that exist as sets).
 * @param {{ number: number, total: number, lang: string, nameText: string, setCode?: string | null }} q
 * @returns {Promise<Candidate[] & { corrected?: string }>}
 */
export async function findWithCorrections(q) {
  const first = await findCandidates(q);
  if (first[0]?.codeMatch || first[0]?.nameScore >= NAME_OK || !q.nameText.trim()) return first;

  const totals = await knownTotals(q.lang);
  const pairs = [
    ...confusableNumbers(q.total).filter((t) => totals.has(t)).map((total) => ({ number: q.number, total })),
    ...confusableNumbers(q.number).map((number) => ({ number, total: q.total })),
  ];

  // Accept a corrected number only with a convincing name or set code match.
  for (const p of pairs) {
    /** @type {Candidate[] & { corrected?: string }} */
    const found = await findCandidates({ ...q, ...p });
    if (found[0]?.codeMatch || found[0]?.nameScore >= NAME_OK) {
      found.corrected = `${p.number}/${p.total}`;
      return found;
    }
  }
  return first;
}

/**
 * Full card (with variants_detailed and prices).
 * @param {string} lang
 * @param {string} id
 */
export function getCard(lang, id) {
  return get(`/${lang}/cards/${encodeURIComponent(id)}`);
}

/**
 * Same-name cards in classic-collection reprint sets (e.g. 30th Classic Collection),
 * which print the number of the original card and cannot be found by number.
 * @param {string[]} names
 * @param {string} lang
 * @param {string} nameText
 * @returns {Promise<Candidate[]>}
 */
export async function findReprints(names, lang, nameText) {
  /** @type {Candidate[]} */
  const out = [];
  for (const name of new Set(names)) {
    const hits = (await get(`/${lang}/cards?name=${encodeURIComponent(name)}`)) ?? [];
    for (const hit of hits) {
      const setId = CLASSIC_COLLECTION_SETS.find((id) => hit.id.startsWith(`${id}-`));
      if (!setId || hit.name !== name) continue;
      const set = await get(`/${lang}/sets/${setId}`);
      out.push({
        id: hit.id,
        localId: hit.localId,
        name: hit.name,
        image: hit.image,
        setId,
        setName: set?.name ?? setId,
        setCode: set?.abbreviation?.official ?? null,
        releaseDate: set?.releaseDate ?? '',
        lang,
        nameScore: nameSimilarity(hit.name, nameText),
        codeMatch: false,
        reprint: true,
      });
    }
  }
  return out;
}
