// @ts-check
// From what OCR read (number, total, set code, name text) to TCGdex cards (SPEC § 4.1).
// Every request goes through the app's TCGdex client, so sets are cached in Dexie.
import { getSet, getSets, searchCards } from '../api/tcgdex.js';
import { confusableNumbers, nameSimilarity, setCodeMatches } from '../domain/recognize.js';
import { CLASSIC_COLLECTION_SETS } from '../domain/variants.js';

/**
 * @typedef {{ id: string, localId: string, name: string, image?: string, setId: string, setName: string,
 *   setCode: string | null, official: number, releaseDate: string, lang: string, nameScore: number,
 *   codeMatch: boolean, reprint?: boolean }} Candidate
 * @typedef {{ number: number, total: number, lang: string, nameText: string, setCode?: string | null }} Query
 */

/** Name score above which a candidate is trusted without trying other numbers. */
const NAME_OK = 0.7;

/** @param {string} lang */
const setList = (lang) =>
  getSets(lang)
    .then((r) => /** @type {any[]} */ (r.data))
    .catch(() => []);

/**
 * Official card counts of all known sets, to reject readings like "22/25" when no set has 25 cards.
 * @param {string} lang
 */
export async function knownTotals(lang) {
  const lists = await Promise.all([setList(lang), lang === 'en' ? [] : setList('en')]);
  return new Set(lists.flat().map((s) => s.cardCount?.official));
}

/**
 * Cards numbered `number` in sets with `total` official cards, best first: set code match,
 * then name similarity with the OCR text, then newest set.
 * @param {Query} q
 * @returns {Promise<Candidate[]>}
 */
export async function findCandidates({ number, total, lang, nameText, setCode = null }) {
  // Sets not translated into `lang` are missing from its list: fall back to English.
  const langs = lang === 'en' ? ['en'] : [lang, 'en'];
  /** @type {Candidate[]} */
  const out = [];
  const seen = new Set();
  for (const l of langs) {
    const matching = (await setList(l)).filter((s) => s.cardCount?.official === total);
    const sets = await Promise.all(matching.map((s) => getSet(l, s.id).then((r) => r.data).catch(() => null)));
    for (const set of sets) {
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
          official: set.cardCount?.official ?? total,
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
    (a, b) => Number(b.codeMatch) - Number(a.codeMatch) || b.nameScore - a.nameScore || b.releaseDate.localeCompare(a.releaseDate),
  );
}

/**
 * Like findCandidates, but when no name matches it retries numbers that differ by one
 * commonly confused digit (only totals that exist as sets), accepting a correction only with
 * a convincing name or set code.
 * @param {Query} q
 * @returns {Promise<{ candidates: Candidate[], corrected: string | null }>}
 */
export async function findWithCorrections(q) {
  const first = await findCandidates(q);
  if (first[0]?.codeMatch || first[0]?.nameScore >= NAME_OK || !q.nameText.trim()) return { candidates: first, corrected: null };
  const totals = await knownTotals(q.lang);
  const pairs = [
    ...confusableNumbers(q.total).filter((t) => totals.has(t)).map((total) => ({ number: q.number, total })),
    ...confusableNumbers(q.number).map((number) => ({ number, total: q.total })),
  ];
  for (const p of pairs) {
    const found = await findCandidates({ ...q, ...p });
    if (found[0]?.codeMatch || found[0]?.nameScore >= NAME_OK) return { candidates: found, corrected: `${p.number}/${p.total}` };
  }
  return { candidates: first, corrected: null };
}

/**
 * Same-name cards in classic-collection reprint sets (they print the original number).
 * @param {string[]} names
 * @param {string} lang
 * @param {string} nameText
 * @returns {Promise<Candidate[]>}
 */
export async function findReprints(names, lang, nameText) {
  /** @type {Candidate[]} */
  const out = [];
  for (const name of new Set(names)) {
    const hits = await searchCards(lang, { name })
      .then((r) => /** @type {any[]} */ (r.data))
      .catch(() => []);
    for (const hit of hits) {
      const setId = CLASSIC_COLLECTION_SETS.find((id) => hit.id.startsWith(`${id}-`));
      if (!setId || hit.name !== name) continue;
      const set = await getSet(lang, setId)
        .then((r) => r.data)
        .catch(() => null);
      out.push({
        id: hit.id,
        localId: hit.localId,
        name: hit.name,
        image: hit.image,
        setId,
        setName: set?.name ?? setId,
        setCode: set?.abbreviation?.official ?? null,
        official: set?.cardCount?.official ?? 0,
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

/**
 * Full lookup: candidates by number (with corrections), plus classic-collection reprints.
 * @param {Query} q
 */
export async function matchCard(q) {
  const { candidates, corrected } = await findWithCorrections(q);
  const names = candidates.filter((c) => c.nameScore >= NAME_OK).slice(0, 3).map((c) => c.name);
  const reprints = await findReprints(names, candidates[0]?.lang ?? q.lang, q.nameText).catch(() => []);
  return { candidates: [...candidates, ...reprints.filter((r) => !candidates.some((c) => c.id === r.id))], corrected };
}

/**
 * "Da verificare" (SPEC § 4.1.8): no candidate, or the best one is not confirmed by the set
 * code or the name, or two candidates are equally plausible.
 * @param {Candidate[]} c
 */
export function isUncertain(c) {
  if (!c.length) return true;
  // Classic-collection reprints are offered as alternatives but don't make a match by
  // number doubtful: they print another card's number.
  const [best, second] = c.filter((x) => !x.reprint).length ? c.filter((x) => !x.reprint) : c;
  if (!best.codeMatch && best.nameScore < 0.6) return true;
  if (second && !best.codeMatch && Math.abs(best.nameScore - second.nameScore) < 0.15) return true;
  return false;
}
