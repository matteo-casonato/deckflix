// @ts-check
// Free-text card search (SPEC § 4.2): "Charizard 11/78", "Charizard svi", "svi 25",
// "Pikachu 025". Splits the text into name, number, set size and candidate set codes;
// the codes are resolved against TCGdex by the caller.

/** Words that are part of card names, never set codes. */
const NAME_SUFFIXES = new Set(['ex', 'v', 'gx', 'vmax', 'vstar', 'break', 'lv', 'prime', 'star', 'δ']);

/**
 * @typedef {{ name: string, number: string | null, total: number | null, codes: string[] }} SearchQuery
 * name: words left for the name filter; codes: tokens that may be a set code (SVI) or set id (sv03.5).
 */

/** @param {string} text @returns {SearchQuery} */
export function parseSearchQuery(text) {
  const tokens = text
    .trim()
    .replace(/\s*\/\s*/g, '/')
    .split(/\s+/)
    .filter(Boolean);
  /** @type {string[]} */
  const name = [];
  /** @type {string[]} */
  const codes = [];
  let number = null;
  let total = null;
  for (const t of tokens) {
    const frac = t.match(/^#?([a-z]{0,3}\d{1,3}[a-z]?)\/([a-z]{0,3}\d{1,3})$/i);
    if (frac && number == null) {
      number = frac[1];
      const n = Number(frac[2]);
      total = Number.isFinite(n) ? n : null;
    } else if (/^#?\d{1,3}[a-z]?$/i.test(t) && number == null) {
      number = t.replace('#', '');
    } else if (!NAME_SUFFIXES.has(t.toLowerCase()) && /^(?=.*[a-z])[a-z0-9.]{2,7}$/i.test(t)) {
      codes.push(t);
      name.push(t);
    } else {
      name.push(t);
    }
  }
  return { name: name.join(' '), number, total, codes };
}

/** "011" → "11", "TG05" → "TG5", "gg41" → "GG41": numbers compare without leading zeros. */
/** @param {string} n */
export const normalizeNumber = (n) => n.toUpperCase().replace(/^([A-Z]*)0*(\d)/, '$1$2');

/**
 * Removes the tokens recognised as set codes from the name. A code is used only when
 * something else narrows the search (another name word or a number), so "mew" alone
 * stays a name and doesn't open the whole "MEW" set (151).
 * @param {SearchQuery} q
 * @param {string[]} setCodes the codes that matched a set
 */
export function withSets(q, setCodes) {
  const used = setCodes.map((c) => c.toLowerCase());
  let number = q.number;
  let words = q.name.split(' ').filter(Boolean);
  // "GG41", "TG05", "SV107": letters + digits that are not a set are a card number.
  if (number == null) {
    const alnum = words.find((w) => /^[a-z]{1,3}\d{1,3}$/i.test(w) && !used.includes(w.toLowerCase()));
    if (alnum) {
      number = alnum;
      words = words.filter((w) => w !== alnum);
    }
  }
  const rest = words.filter((w) => !used.includes(w.toLowerCase()));
  const narrows = rest.some((w) => !NAME_SUFFIXES.has(w.toLowerCase())) || number != null;
  if (!used.length || !narrows) return { name: words.join(' '), useSets: false, number };
  return { name: rest.join(' '), useSets: true, number };
}
