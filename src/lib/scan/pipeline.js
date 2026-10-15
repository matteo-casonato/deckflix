// @ts-check
// From a card image to a proposal the user confirms: OCR, TCGdex lookup, stamp, prints.
import { getCard } from '../api/tcgdex.js';
import { settings } from '../stores/settings.svelte.js';
import { applyStampSuggestion, guessVariant, listVariants } from '../domain/variants.js';
import { readCard } from './ocr.js';
import { isUncertain, knownTotals, matchCard, matchSpecial } from './matcher.js';
import { detectPlayStamp } from './stamp.js';

/**
 * @typedef {import('./matcher.js').Candidate} Candidate
 * @typedef {{
 *   status: 'unread' | 'nomatch' | 'found',
 *   reading: import('./ocr.js').Reading,
 *   lang: string,
 *   candidates: Candidate[],
 *   corrected: string | null,
 *   uncertain: boolean,
 *   stamp: ReturnType<typeof detectPlayStamp> | null,
 *   ms: number,
 * }} Recognition
 */

/** @type {{ lang: string, totals: Promise<Set<number>> } | null} */
let totalsCache = null;

/** @param {string} lang */
function totalsFor(lang) {
  if (totalsCache?.lang !== lang) totalsCache = { lang, totals: knownTotals(lang).catch(() => new Set()) };
  return totalsCache.totals;
}

/**
 * @param {HTMLCanvasElement} card the card under the guide
 * @returns {Promise<Recognition>}
 */
export async function recognize(card) {
  const t0 = performance.now();
  const totals = await totalsFor(settings.cardLang);
  const reading = await readCard(card, totals.size ? totals : null);
  const lang = reading.lang ?? settings.cardLang;
  if (!reading.num && reading.special) {
    const candidates = await matchSpecial(reading.special.code, lang, reading.nameText).catch(() => []);
    let stamp = null;
    try {
      stamp = detectPlayStamp(card);
    } catch {
      // Only a suggestion.
    }
    return {
      status: candidates.length ? 'found' : 'nomatch',
      reading,
      lang,
      candidates,
      corrected: null,
      uncertain: isUncertain(candidates),
      stamp,
      ms: performance.now() - t0,
    };
  }
  if (!reading.num) {
    return { status: 'unread', reading, lang, candidates: [], corrected: null, uncertain: true, stamp: null, ms: performance.now() - t0 };
  }
  const { candidates, corrected } = await matchCard({ ...reading.num, lang, nameText: reading.nameText, setCode: reading.setCode });
  let stamp = null;
  try {
    stamp = detectPlayStamp(card);
  } catch {
    // Canvas or memory issue: the stamp is only a suggestion.
  }
  return {
    status: candidates.length ? 'found' : 'nomatch',
    reading,
    lang,
    candidates,
    corrected,
    uncertain: isUncertain(candidates),
    stamp,
    ms: performance.now() - t0,
  };
}

/**
 * Prints of a candidate and the one to preselect (stamp words in the text, Play! stamp on
 * the photo, otherwise the normal print).
 * @param {Candidate} candidate
 * @param {Recognition} rec
 */
export async function printsFor(candidate, rec) {
  let card = null;
  try {
    card = (await getCard(candidate.lang, candidate.id)).data;
  } catch {
    // Offline and not cached: fall back to the normal print.
  }
  const listed = card ? listVariants(card) : [];
  const r = applyStampSuggestion(listed, guessVariant(listed, rec.reading.text), rec.stamp?.detected ? 'player-rewards-program' : null);
  return { card, options: r.options, preselect: r.preselect ?? listed[0]?.key ?? 'normal', highlighted: r.highlighted };
}
