// @ts-check
// Pure helpers about cards, sets and prices used by the collection screens.
import { normalizeNumber } from './searchQuery.js';
import { listVariants } from './variants.js';

/**
 * Set id from a TCGdex card id: "sv03.5-025" → "sv03.5", "30th-c-001" → "30th-c".
 * @param {string} cardId
 */
export function setIdOf(cardId) {
  const i = cardId.lastIndexOf('-');
  return i > 0 ? cardId.slice(0, i) : cardId;
}

/**
 * Number typed in quick add: "25", "025", "25/165", and numbers with letters as printed on
 * gallery and promo cards: "TG25/TG30", "swsh302", "GG41".
 * @param {string} text
 * @returns {{ number: string, total: number | null } | null} number upper case, as typed
 */
export function parseQuickNumber(text) {
  const m = text.trim().match(/^#?([a-z]{0,5}\d{1,4}[a-z]?)\s*(?:\/\s*([a-z]{0,5}\d{1,4}))?$/i);
  if (!m) return null;
  const number = m[1].toUpperCase();
  if (/^\d+$/.test(number) && Number(number) < 1) return null;
  return { number, total: m[2] && /^\d+$/.test(m[2]) ? Number(m[2]) : null };
}

/**
 * Card of a set with this collector number, ignoring leading zeros and case
 * ("25" = "025", "tg5" = "TG05").
 * @template {{ localId: string }} T
 * @param {T[]} cards
 * @param {string | number} number
 */
export function cardByNumber(cards, number) {
  const n = normalizeNumber(String(number));
  return cards.find((c) => normalizeNumber(String(c.localId)) === n) ?? null;
}

/**
 * Completion of a set from the owned collection entries.
 * Cards numbered above the official count (secret rares) count as owned but not towards 100%.
 * @param {{ official: number, cards?: { id: string, localId: string }[] }} set
 * @param {{ cardId: string, qty: number }[]} entries collection entries of this set
 */
export function setProgress(set, entries) {
  /** @type {Map<string, number>} */
  const copies = new Map();
  for (const e of entries) copies.set(e.cardId, (copies.get(e.cardId) ?? 0) + e.qty);
  const inRange = (/** @type {string} */ cardId) => {
    const local = cardId.slice(setIdOf(cardId).length + 1);
    return /^\d+$/.test(local) ? Number(local) <= set.official : false;
  };
  const owned = [...copies.keys()].filter(inRange).length;
  const duplicates = [...copies.values()].reduce((sum, n) => sum + Math.max(0, n - 1), 0);
  const total = Math.max(set.official, 1);
  return {
    owned,
    distinct: copies.size,
    total: set.official,
    missing: Math.max(0, set.official - owned),
    duplicates,
    copies: [...copies.values()].reduce((a, b) => a + b, 0),
    percent: Math.min(100, Math.round((owned / total) * 100)),
  };
}

/**
 * Reference price of one copy (SPEC § 4.3): the price of its print in variants_detailed,
 * falling back to the card's pricing (`-holo` for holo and reverse).
 * @param {any} card full TCGdex card
 * @param {string} variantKey e.g. "normal", "reverse", "holo+stamp-set-logo"
 * @param {'trend' | 'avg' | 'low'} [field]
 * @returns {number | null}
 */
export function copyPrice(card, variantKey, field = 'trend') {
  if (!card) return null;
  const variant = listVariants(card).find((v) => v.key === variantKey);
  if (variant?.price != null && field === 'trend') return variant.price;
  const cm = card.pricing?.cardmarket;
  if (!cm) return null;
  const foil = /^(reverse|holo)/.test(variantKey);
  const value = foil && cm[`${field}-holo`] > 0 ? cm[`${field}-holo`] : cm[field];
  return typeof value === 'number' && value > 0 ? value : null;
}

/**
 * Short trend from Cardmarket averages: 7-day average against the 30-day one.
 * @param {any} card
 * @returns {'up' | 'down' | 'flat' | null}
 */
export function priceTrend(card) {
  const cm = card?.pricing?.cardmarket;
  if (!cm || !(cm.avg7 > 0) || !(cm.avg30 > 0)) return null;
  const ratio = cm.avg7 / cm.avg30;
  if (ratio > 1.05) return 'up';
  if (ratio < 0.95) return 'down';
  return 'flat';
}

/**
 * "Prezzi di oggi" / "Prezzi di ieri" / "Prezzi del 12/10", and whether they are old (> 3 days).
 * @param {string | undefined} updated pricing.cardmarket.updated (ISO)
 * @param {number} now
 */
export function pricesDate(updated, now) {
  if (!updated) return null;
  const t = Date.parse(updated);
  if (Number.isNaN(t)) return null;
  const day = (/** @type {number} */ x) => new Date(x).toDateString();
  const d = new Date(t);
  const label =
    day(t) === day(now)
      ? 'Prezzi di oggi'
      : day(t) === day(now - 86_400_000)
        ? 'Prezzi di ieri'
        : `Prezzi del ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { label, old: now - t > 3 * 86_400_000 };
}

/** Cardmarket language filter ids (SPEC § 2; to be confirmed on a real search). */
const CARDMARKET_LANG = /** @type {Record<string, number>} */ ({ en: 1, fr: 2, de: 3, es: 4, it: 5, pt: 8 });

/**
 * Cardmarket page of the card, filtered by the language of the copy. Prices on TCGdex
 * aggregate all languages, so this is where the real price is. With the product id that
 * TCGdex gives per print (`idProduct`, checked 15/10/2026: Pikachu 151 → 733620) the link
 * opens the card itself; without it, a search by name.
 * @param {{ name: string, pricing?: any } | string} card full TCGdex card (or just a name)
 * @param {string} lang language of the copy
 * @param {number | null} [productId] product of a specific print (variant)
 */
export function cardmarketUrl(card, lang, productId = null) {
  const name = typeof card === 'string' ? card : card.name;
  const id = productId ?? (typeof card === 'string' ? null : card.pricing?.cardmarket?.idProduct ?? null);
  const params = new URLSearchParams(id ? { idProduct: String(id) } : { searchString: name });
  const langId = CARDMARKET_LANG[lang];
  if (langId) params.set('language', String(langId));
  return `https://www.cardmarket.com/it/Pokemon/Products${id ? '' : '/Search'}?${params}`;
}

/**
 * Web search for a card by name and printed number ("Deoxys 16/107"): for old cards it often
 * finds listings and prices more easily than Cardmarket's own search.
 * @param {{ name: string, localId: string }} card
 * @param {number | null | undefined} official cards in the set (the "/107")
 */
export function googleUrl(card, official) {
  const number = official ? `${card.localId}/${official}` : card.localId;
  return `https://www.google.com/search?${new URLSearchParams({ q: `${card.name} ${number} pokemon` })}`;
}

/** TCG Pocket sets (A1, A2b, P-A…) are digital-only: TCGdex ids start with a capital. */
/** @param {string} setId */
export const isPocketSet = (setId) => /^[A-Z]/.test(setId);

/** Italian names of the card languages. */
export const LANG_LABELS = /** @type {Record<string, string>} */ ({
  it: 'Italiano',
  en: 'Inglese',
  es: 'Spagnolo',
  fr: 'Francese',
  de: 'Tedesco',
  pt: 'Portoghese',
});

const euroNumber = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * "€ 168,40" as in the mockups; "—" without a value.
 * @param {number | null | undefined} n
 */
export function euro(n) {
  return typeof n === 'number' && Number.isFinite(n) ? `€ ${euroNumber.format(n)}` : '—';
}

/** Short badge for a variant key in grids: "Rev", "Holo", "Timbro". Null for the normal print. */
/** @param {string} variantKey */
export function variantBadge(variantKey) {
  if (variantKey === 'normal') return null;
  if (variantKey.includes('stamp-')) return 'Timbro';
  if (variantKey.startsWith('reverse')) return 'Rev';
  if (variantKey.startsWith('holo')) return 'Holo';
  if (variantKey === 'firstEdition') return '1ª ed.';
  return '★';
}

// Series folders of TCGdex assets, matched on the start of the set id (longest first).
const SERIES = ['swsh', 'hgss', 'ecard', 'base', 'neo', 'gym', 'pop', 'sv', 'sm', 'xy', 'bw', 'me', 'dp', 'pl', 'ex', 'lc'];
const SERIES_OF_SET = /** @type {Record<string, string>} */ ({ cel25: 'swsh', cel25c: 'swsh', svp: 'sv', mep: 'me' });

/**
 * Best guess of a card's image when TCGdex has none in its data: the asset is often on the
 * server anyway (mep-028), and gallery cards (TG, GG) live in the folder of their main set
 * (swsh12tg-TG20 → swsh/swsh12/TG20); Sun & Moon "half" sets drop the dot (sm7.5 → sm75,
 * checked 15/10/2026), the others keep it (swsh4.5, sv03.5). The tile tries it and falls
 * back to a placeholder.
 * @param {string} cardId
 * @param {string} localId
 * @param {string} [lang]
 */
export function guessImage(cardId, localId, lang = 'en') {
  const setId = setIdOf(cardId);
  const series = SERIES_OF_SET[setId] ?? SERIES.find((s) => setId.startsWith(s));
  if (!series) return null;
  let folder = /^(TG|GG)/.test(localId) ? setId.replace(/(tg|gg)$/, '') : setId;
  if (series === 'sm') folder = folder.replace('.', '');
  return `https://assets.tcgdex.net/${lang}/${series}/${folder}/${localId}`;
}
