// @ts-check
// From a card image to a proposal the user confirms: OCR, TCGdex lookup, stamp, prints.
import { getCard, searchCards } from '../api/tcgdex.js';
import { artUncertain, distance, LIKELY, nearest, SAME } from '../domain/fingerprint.js';
import { nameGuesses, nameSimilarity, parseCollectorNumber, parseSetCode, parseSpecialNumber } from '../domain/recognize.js';
import { settings } from '../stores/settings.svelte.js';
import { applyStampSuggestion, guessVariant, listVariants } from '../domain/variants.js';
import { artIndex, mapLimited, photoFingerprint, thumbFingerprint } from './artwork.js';
import { readCard } from './ocr.js';
import { findCandidates, isUncertain, knownTotals, matchCard, matchSpecial } from './matcher.js';
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
    return withArt(card, { status: candidates.length ? 'found' : 'nomatch', reading, lang, candidates, corrected: null, uncertain: isUncertain(candidates), stamp, ms: 0 }, t0);
  }
  if (!reading.num) {
    return withArt(card, { status: 'unread', reading, lang, candidates: [], corrected: null, uncertain: true, stamp: null, ms: 0 }, t0);
  }
  const { candidates, corrected } = await matchCard({ ...reading.num, lang, nameText: reading.nameText, setCode: reading.setCode });
  let stamp = null;
  try {
    stamp = detectPlayStamp(card);
  } catch {
    // Canvas or memory issue: the stamp is only a suggestion.
  }
  return withArt(card, { status: candidates.length ? 'found' : 'nomatch', reading, lang, candidates, corrected, uncertain: isUncertain(candidates), stamp, ms: 0 }, t0);
}

/**
 * The drawing has the last word. A match by number is checked against its thumbnail: a
 * different drawing makes it doubtful, and a misread number is replaced by a card found by
 * drawing. With no number, the drawing alone finds the card: in the weekly index, or among the
 * cards named like the text at the top.
 * @param {HTMLCanvasElement} card
 * @param {Recognition} rec
 * @param {number} t0
 * @returns {Promise<Recognition>}
 */
async function withArt(card, rec, t0) {
  try {
    const fp = photoFingerprint(card);
    if (rec.candidates.length) {
      const best = await checkByArt(fp, rec.candidates);
      if (best != null && best <= SAME) rec.uncertain = false;
      if (best == null || best <= LIKELY) return { ...rec, ms: performance.now() - t0 };
      rec.uncertain = true;
    }
    const found = await findByArt(fp, rec.reading.nameText, rec.lang, rec.candidates.length ? SAME : LIKELY);
    if (found.length) {
      const known = new Set(found.map((c) => c.id));
      return {
        ...rec,
        status: 'found',
        candidates: [...found, ...rec.candidates.filter((c) => !known.has(c.id))],
        uncertain: rec.candidates.length > 0 || artUncertain(found.map((c) => c.artDistance ?? 64)),
        ms: performance.now() - t0,
      };
    }
  } catch {
    // Canvas, network or memory issue: the drawing is only a help.
  }
  return { ...rec, ms: performance.now() - t0 };
}

/**
 * Compares the photo with the first candidates' thumbnails and moves a clearly matching one
 * first. Returns the first candidate's distance, or null when no thumbnail could be read.
 * @param {string} fp
 * @param {Candidate[]} candidates
 */
async function checkByArt(fp, candidates) {
  const h0 = await thumbFingerprint(candidates[0].image);
  if (h0 != null) candidates[0].artDistance = distance(fp, h0);
  if ((candidates[0].artDistance ?? 64) <= LIKELY) return candidates[0].artDistance ?? null;
  // The first one doesn't match: maybe another candidate does (same number, other set).
  const others = candidates.slice(1, 4);
  await mapLimited(others, 3, async (c) => {
    const h = await thumbFingerprint(c.image);
    if (h != null) c.artDistance = distance(fp, h);
  });
  const better = others.filter((c) => c.artDistance != null && c.artDistance <= SAME).sort((a, b) => (a.artDistance ?? 64) - (b.artDistance ?? 64))[0];
  if (better) {
    candidates.splice(candidates.indexOf(better), 1);
    candidates.unshift(better);
    return better.artDistance ?? null;
  }
  return candidates[0].artDistance ?? null;
}

/**
 * Cards found by drawing alone, best first, within `max` bits: the weekly index of all cards,
 * then (when that has no clear match) the few cards named like the words at the top of the photo.
 * @param {string} fp
 * @param {string} nameText
 * @param {string} lang
 * @param {number} max
 * @returns {Promise<Candidate[]>}
 */
async function findByArt(fp, nameText, lang, max) {
  /** @type {Map<string, { d: number, brief?: any }>} */
  const hits = new Map();
  const index = await artIndex();
  // Among ~23,000 drawings, unrelated ones come within LIKELY by chance: the index needs SAME.
  if (index) for (const h of nearest(fp, index, 5)) if (h.d <= Math.min(max, SAME)) hits.set(h.id, { d: h.d });
  if (![...hits.values()].some((h) => h.d <= SAME)) {
    const briefs = new Map();
    for (const word of nameGuesses(nameText)) {
      for (const l of lang === 'en' ? ['en'] : [lang, 'en']) {
        const list = await searchCards(l, { name: word }).then((r) => /** @type {any[]} */ (r.data)).catch(() => []);
        for (const c of list) if (c.image && !briefs.has(c.id)) briefs.set(c.id, c);
        if (list.length) break;
      }
    }
    const likely = [...briefs.values()].sort((a, b) => nameSimilarity(b.name, nameText) - nameSimilarity(a.name, nameText)).slice(0, 8);
    await mapLimited(likely, 4, async (c) => {
      const h = await thumbFingerprint(c.image);
      const d = h == null ? 64 : distance(fp, h);
      if (d <= max && d < (hits.get(c.id)?.d ?? 64)) hits.set(c.id, { d, brief: c });
    });
  }
  const best = [...hits.entries()].sort((a, b) => a[1].d - b[1].d).slice(0, 5);
  const out = await Promise.all(best.map(([id, h]) => toCandidate(id, h.d, lang, nameText)));
  return /** @type {Candidate[]} */ (out.filter(Boolean));
}

/**
 * @param {string} id
 * @param {number} d
 * @param {string} lang
 * @param {string} nameText
 * @returns {Promise<Candidate | null>}
 */
async function toCandidate(id, d, lang, nameText) {
  for (const l of lang === 'en' ? ['en'] : [lang, 'en']) {
    const card = await getCard(l, id).then((r) => r.data).catch(() => null);
    if (!card) continue;
    return {
      id,
      localId: card.localId,
      name: card.name,
      image: card.image,
      setId: card.set?.id ?? id.slice(0, id.lastIndexOf('-')),
      setName: card.set?.name ?? '',
      setCode: null,
      official: card.set?.cardCount?.official ?? 0,
      releaseDate: '',
      lang: l,
      nameScore: nameSimilarity(card.name, nameText),
      codeMatch: false,
      artDistance: d,
    };
  }
  return null;
}

/**
 * A card the scan didn't read, from the number the user types: "25/165", "SVI 25/198",
 * "TG05/TG30", "SWSH302". Null when the text is not a number with its total or a special
 * number (a plain "25" exists in every set). Several matches are left to choose in the review.
 * @param {string} text
 * @param {string} [lang]
 * @returns {Promise<Recognition | null>}
 */
export async function recognizeTyped(text, lang = settings.cardLang) {
  const t0 = performance.now();
  const num = parseCollectorNumber(text);
  const special = num ? null : parseSpecialNumber(text);
  if (!num && !special) return null;
  const setCode = parseSetCode(text);
  const candidates = num
    ? await findCandidates({ number: num.number, total: num.total, lang, nameText: '', setCode })
    : await matchSpecial(/** @type {{ code: string }} */ (special).code, lang, '');
  const reading = /** @type {import('./ocr.js').Reading} */ ({ num, special, setCode, lang: null, nameText: '', text, engine: 'google' });
  return {
    status: candidates.length ? 'found' : 'nomatch',
    reading,
    lang,
    candidates,
    corrected: null,
    // Typed by the user: doubtful only when the number fits several cards.
    uncertain: candidates.length > 1 && !candidates.some((c) => c.codeMatch),
    stamp: null,
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
