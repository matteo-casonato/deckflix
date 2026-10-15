// @ts-check
// Pure parsing helpers for card recognition (app scanner and lab/scan prototype).

/** @typedef {'it' | 'en' | 'de' | 'fr' | 'es' | 'pt'} Lang */

/** @param {string} s */
export const normalize = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Characters OCR commonly confuses with digits.
const DIGIT_FIXES = /** @type {Record<string, string>} */ ({
  O: '0', o: '0', D: '0', Q: '0',
  I: '1', l: '1', i: '1', '|': '1', '!': '1',
  Z: '2', z: '2',
  S: '5', s: '5',
  B: '8',
  G: '6',
});

/** @param {string} token */
const fixDigits = (token) => token.replace(/[OoDQIli|!ZzSsBG]/g, (c) => DIGIT_FIXES[c] ?? c);

/**
 * Finds the collector number ("025/165") in OCR text.
 * Returns the most plausible match: number <= total * 2 and total >= 10.
 * With `totals`, only readings whose total is an existing set size are accepted.
 * @param {string} text
 * @param {Set<number> | null} [totals]
 * @returns {{ number: number, total: number, raw: string } | null}
 */
export function parseCollectorNumber(text, totals = null) {
  // Same line only ([ \t], not \s): OCR puts stray digits on lines above the number.
  // The total may carry one spurious trailing character ("050/1820").
  const re = /([0-9OoDQIli|!ZzSsBG]{1,3})[ \t]*[/\\⁄][ \t]*([0-9OoDQIli|!ZzSsBG]{2,4})/g;
  /** @type {{ number: number, total: number, raw: string, score: number }[]} */
  const found = [];
  for (const m of text.matchAll(re)) {
    const a = fixDigits(m[1]);
    if (!/^\d+$/.test(a)) continue;
    const number = Number(a);
    for (const len of [3, 2]) {
      const rawTotal = m[2].slice(0, len);
      if (rawTotal.length !== len) continue;
      const b = fixDigits(rawTotal);
      if (!/^\d+$/.test(b)) continue;
      const total = Number(b);
      if (total < 10 || number < 1 || number > total * 2) continue;
      if (totals && !totals.has(total)) continue;
      // Prefer readings that needed no fixes, use 3-digit padding and consume the whole token.
      const clean = /^\d+$/.test(m[1]) && /^\d+$/.test(rawTotal);
      const score = (clean ? 2 : 0) + (a.length === 3 ? 1 : 0) + (rawTotal.length === m[2].length ? 1 : 0);
      found.push({ number, total, raw: m[0], score });
    }
  }
  if (!found.length) return null;
  found.sort((x, y) => y.score - x.score);
  const { number, total, raw } = found[0];
  return { number, total, raw };
}

// Word fragments from the bottom row of a card (weakness, resistance, retreat).
// Mid-word fragments survive OCR dropping the first letter ("ebolezza", "uckzug").
/** @type {Record<Lang, { code: string, hp: string, words: RegExp[] }>} */
const LANG_HINTS = {
  it: { code: 'IT', hp: 'PS', words: [/bolezz/, /itirat/, /esistenza/] },
  en: { code: 'EN', hp: 'HP', words: [/eakness/, /etreat/, /esistance/] },
  de: { code: 'DE', hp: 'KP', words: [/chwache/, /uckzug/, /esistenz(?!a)/] },
  fr: { code: 'FR', hp: 'PV', words: [/aiblesse/, /etraite/] },
  es: { code: 'ES', hp: 'PS', words: [/ebilidad/, /etirada/, /esistencia/] },
  pt: { code: 'PT', hp: 'PS', words: [/raqueza/, /recuo/] },
};

/**
 * Guesses the card language from OCR text of the top and bottom strips.
 * Signals: language code printed next to the number (Scarlet & Violet era),
 * the HP abbreviation (PS is shared by it/es/pt) and words such as "Weakness".
 * @param {string} text
 * @returns {{ lang: Lang | null, scores: Record<Lang, number> }}
 */
export function detectLanguage(text) {
  const upper = ` ${text.toUpperCase().replace(/[^A-Z0-9/]+/g, ' ')} `;
  const lower = normalize(text);
  const scores = /** @type {Record<Lang, number>} */ ({ it: 0, en: 0, de: 0, fr: 0, es: 0, pt: 0 });

  for (const [lang, hint] of /** @type {[Lang, typeof LANG_HINTS[Lang]][]} */ (Object.entries(LANG_HINTS))) {
    // "SVI EN 081/198": code followed by the collector number.
    if (new RegExp(`\\b${hint.code}\\s+\\d{1,3}\\s*/`).test(upper)) scores[lang] += 4;
    else if (new RegExp(`\\b[A-Z]{2,4}\\s+${hint.code}\\b`).test(upper)) scores[lang] += 2;
    if (new RegExp(`\\b${hint.hp}\\s*\\d{2,3}\\b|\\b\\d{2,3}\\s*${hint.hp}\\b|\\b${hint.hp}\\b`).test(upper)) scores[lang] += 2;
    for (const word of hint.words) if (word.test(lower)) scores[lang] += 2;
  }

  // "PS" alone favours Italian among it/es/pt (the most common case for this user).
  scores.it += 0.1;

  const best = /** @type {[Lang, number][]} */ (Object.entries(scores)).sort((a, b) => b[1] - a[1])[0];
  return { lang: best[1] >= 1 ? best[0] : null, scores };
}

/**
 * Levenshtein distance between two short strings.
 * @param {string} a
 * @param {string} b
 */
export function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/**
 * How well a card name appears in noisy OCR text, from 0 to 1.
 * Slides a window the length of the name over the text and keeps the best match.
 * @param {string} name
 * @param {string} text
 */
export function nameSimilarity(name, text) {
  const n = normalize(name).replace(/[^a-z0-9]/g, '');
  const t = normalize(text).replace(/[^a-z0-9]/g, '');
  if (!n || !t) return 0;
  if (t.includes(n)) return 1;
  let best = 0;
  for (let len = Math.max(1, n.length - 1); len <= n.length + 1; len++) {
    for (let i = 0; i + len <= t.length; i++) {
      const d = levenshtein(n, t.slice(i, i + len));
      best = Math.max(best, 1 - d / Math.max(n.length, len));
    }
  }
  return best;
}

// Digits OCR tends to swap on small printed fonts.
const DIGIT_CONFUSIONS = /** @type {Record<string, string[]>} */ ({
  0: ['8', '6', '9'],
  1: ['7', '4'],
  3: ['8', '5'],
  4: ['1'],
  5: ['8', '6', '3'],
  6: ['5', '8', '0'],
  7: ['1'],
  8: ['5', '6', '3', '0', '9'],
  9: ['0', '8'],
});

/**
 * Numbers that differ from `n` by one commonly confused digit (e.g. 195 → 198, 165, …).
 * @param {number} n
 * @param {number} [pad] minimum digit count, keeps leading zeros ("051")
 * @returns {number[]}
 */
export function confusableNumbers(n, pad = 3) {
  const s = String(n).padStart(pad, '0');
  const out = new Set();
  for (let i = 0; i < s.length; i++) {
    for (const alt of DIGIT_CONFUSIONS[s[i]] ?? []) {
      const v = Number(s.slice(0, i) + alt + s.slice(i + 1));
      if (v > 0 && v !== n) out.add(v);
    }
  }
  return [...out];
}

const LANG_CODES = new Set(['EN', 'IT', 'DE', 'FR', 'ES', 'PT']);

/**
 * Set abbreviation printed before the number on recent cards ("SVI EN 081/198" → "SVI").
 * Matches TCGdex `set.abbreviation.official`.
 * @param {string} text
 * @returns {string | null}
 */
export function parseSetCode(text) {
  const m = text.toUpperCase().match(/\b([A-Z0-9]{2,6})\s+(?:([A-Z]{2})\s+)?[0-9O]{1,3}\s*\//);
  if (!m || LANG_CODES.has(m[1])) return null;
  if (m[2] && !LANG_CODES.has(m[2])) return null;
  return /[A-Z]/.test(m[1]) ? m[1] : null;
}

/**
 * Whether the set code read by OCR is `abbreviation`. OCR often glues the language
 * code to it ("DRIT" for "DRI IT"), so a longer reading starting with it also matches.
 * @param {string | null} read
 * @param {string | null | undefined} abbreviation
 */
export function setCodeMatches(read, abbreviation) {
  if (!read || !abbreviation) return false;
  return read === abbreviation || (read.length > abbreviation.length && read.length <= abbreviation.length + 2 && read.startsWith(abbreviation));
}
