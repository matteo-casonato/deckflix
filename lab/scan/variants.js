// @ts-check
// Print variants (finish, stamps, special foils) from TCGdex `variants_detailed`.
// Pure helpers: they will move to src/lib/domain/ in Phase 3.

/**
 * Reprint sets whose cards keep the number of the original print ("69/132"),
 * so they can only be found by name.
 */
export const CLASSIC_COLLECTION_SETS = ['cel25cc', '30th-c'];

/** Stamp keys as returned by TCGdex (some are already localised in the Italian API). */
const STAMP_LABELS = /** @type {Record<string, string>} */ ({
  '30th-anniversary': '30° anniversario',
  '30th-pokeday': 'Pokémon Day 30°',
  'player-rewards-program': 'Play! Pokémon',
  'set-logo': 'Logo set',
  staff: 'Staff',
  snowflake: 'Fiocco di neve',
  'pokemon-together': 'Pokémon Together',
  prerelease: 'Prerelease',
});

const FOIL_LABELS = /** @type {Record<string, string>} */ ({
  cosmos: 'Cosmo',
  gold: 'Oro',
  rainbow: 'Arcobaleno',
  league: 'Lega',
});

const TYPE_LABELS = /** @type {Record<string, string>} */ ({
  normal: 'Normale',
  reverse: 'Reverse',
  holo: 'Olografica',
  metal: 'Metallica',
});

/** `type` comes localised in each API language: map it back to one key. */
const FINISH_ALIASES = /** @type {Record<string, string>} */ ({
  normale: 'normal',
  basico: 'normal',
  olografica: 'holo',
  holografica: 'holo',
  holographique: 'holo',
  metallica: 'metal',
  reverso: 'reverse',
  reversa: 'reverse',
});

/** @param {string} s */
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** @param {string} s */
const humanize = (s) => s.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * @typedef {{
 *   key: string,
 *   label: string,
 *   finish: string,
 *   stamps: string[],
 *   foil: string | null,
 *   price: number | null,
 * }} VariantOption
 */

/**
 * Price of one variant: holo and reverse prints sharing the base product use the
 * `-holo` fields, prints with their own product (stamps, special foils) use `trend`.
 * @param {any} v variants_detailed entry
 * @param {'trend' | 'avg' | 'low'} [field]
 */
export function variantPrice(v, field = 'trend') {
  const cm = v?.pricing?.cardmarket;
  if (!cm) return null;
  const holo = cm[`${field}-holo`];
  const base = cm[field];
  const isFoil = /^(reverse|holo|olografica)$/i.test(v.type ?? '');
  const value = isFoil && holo > 0 ? holo : base > 0 ? base : holo > 0 ? holo : null;
  return typeof value === 'number' ? value : null;
}

/**
 * Normalises TCGdex `variants_detailed` (falling back to the boolean `variants`)
 * into a list the user can pick from. `key` is stable across languages and is what
 * the collection stores next to cardId and lang.
 * @param {any} card full TCGdex card
 * @returns {VariantOption[]}
 */
export function listVariants(card) {
  const detailed = Array.isArray(card?.variants_detailed) ? card.variants_detailed : [];
  if (detailed.length) {
    return detailed.map((/** @type {any} */ v) => {
      const finish = slug(v.type ?? 'normal');
      const finishKey = FINISH_ALIASES[finish] ?? finish;
      const stamps = (v.stamp ?? []).map((/** @type {string} */ s) => slug(s));
      const foil = v.foil ? slug(v.foil) : null;
      const parts = [
        TYPE_LABELS[finishKey] ?? humanize(v.type ?? 'Normale'),
        ...(foil ? [`foil ${FOIL_LABELS[foil] ?? humanize(foil)}`] : []),
        ...stamps.map((/** @type {string} */ s) => `timbro ${STAMP_LABELS[s] ?? humanize(s)}`),
      ];
      return {
        key: [finishKey, ...(foil ? [`foil-${foil}`] : []), ...stamps.map((/** @type {string} */ s) => `stamp-${s}`)].join('+'),
        label: parts.join(' · '),
        finish: finishKey,
        stamps,
        foil,
        price: variantPrice(v),
      };
    });
  }
  const flags = card?.variants ?? {};
  return ['normal', 'reverse', 'holo', 'firstEdition']
    .filter((k) => flags[k])
    .map((k) => ({
      key: k,
      label: k === 'firstEdition' ? 'Prima edizione' : TYPE_LABELS[k],
      finish: k,
      stamps: [],
      foil: null,
      price: null,
    }));
}

/** Printed words that reveal a stamp. Most stamps are logos and need the user's tap. */
const STAMP_HINTS = /** @type {[RegExp, string][]} */ ([
  [/\bSTAFF\b/i, 'staff'],
  [/\bPRE-?RELEASE\b/i, 'prerelease'],
]);

/**
 * Picks the variant to preselect: the only one, one whose stamp words appear in the
 * OCR text, or the plain normal print. Returns null when the user must choose.
 * @param {VariantOption[]} options
 * @param {string} ocrText
 * @returns {string | null}
 */
export function guessVariant(options, ocrText) {
  if (options.length === 1) return options[0].key;
  const hinted = STAMP_HINTS.filter(([re]) => re.test(ocrText)).map(([, stamp]) => stamp);
  if (hinted.length) {
    const match = options.find((o) => hinted.every((h) => o.stamps.includes(h)));
    if (match) return match.key;
  }
  return options.find((o) => o.key === 'normal')?.key ?? null;
}

/** Manual entry for stamped prints TCGdex doesn't list yet (e.g. sv10-010 with Play! stamp). */
export const UNLISTED_STAMP = /** @type {VariantOption} */ ({
  key: 'normal+stamp-unlisted',
  label: 'Con timbro non in elenco',
  finish: 'normal',
  stamps: ['unlisted'],
  foil: null,
  price: null,
});

/**
 * Manual entry for a detected stamp that TCGdex doesn't list for this card.
 * @param {string} stamp e.g. 'player-rewards-program'
 * @returns {VariantOption}
 */
export function unlistedStamp(stamp) {
  return {
    key: `normal+stamp-${stamp}`,
    label: `Normale · timbro ${STAMP_LABELS[stamp] ?? humanize(stamp)} (non in elenco)`,
    finish: 'normal',
    stamps: [stamp],
    foil: null,
    price: null,
  };
}

/**
 * Adds the manual entries and, when a stamp was detected on the photo, preselects and
 * highlights the prints carrying it. With several such prints (e.g. Normale and Olografica
 * Cosmo, both with Play!) the first one is preselected and all are highlighted.
 * @param {VariantOption[]} options
 * @param {string | null} current preselected key
 * @param {string | null} detected stamp key found on the photo, or null
 * @returns {{ options: VariantOption[], preselect: string | null, highlighted: string[] }}
 */
export function applyStampSuggestion(options, current, detected) {
  if (!detected) return { options: [...options, UNLISTED_STAMP], preselect: current, highlighted: [] };
  const stamped = options.filter((o) => o.stamps.includes(detected));
  if (!stamped.length) {
    const manual = unlistedStamp(detected);
    return { options: [...options, manual, UNLISTED_STAMP], preselect: manual.key, highlighted: [manual.key] };
  }
  const keys = stamped.map((o) => o.key);
  return {
    options: [...options, UNLISTED_STAMP],
    preselect: current && keys.includes(current) ? current : keys[0],
    highlighted: keys,
  };
}
