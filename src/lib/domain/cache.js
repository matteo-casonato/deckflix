// @ts-check
// Cache policy for TCGdex responses. Pure functions: time and connectivity are passed in.

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** Card data includes Cardmarket prices, updated once a day. */
export const CARD_TTL = DAY;
/** Sets and series change rarely (new sets, translations). */
export const LIST_TTL = 7 * DAY;
/** Beyond this age the UI warns that prices may be outdated (SPEC § 4.3). */
export const PRICES_STALE_AFTER = 3 * DAY;

/**
 * What to do with a request given the cached copy.
 * - `cache`: fresh copy, no network.
 * - `network`: no copy, or stale and online; on failure fall back to the stale copy if any.
 * - `stale`: stale copy while offline: use it, don't try the network.
 * - `fail`: offline with nothing cached.
 * @param {{ fetchedAt: number } | undefined | null} cached
 * @param {{ now: number, ttl: number, online: boolean }} ctx
 * @returns {'cache' | 'network' | 'stale' | 'fail'}
 */
export function cacheDecision(cached, { now, ttl, online }) {
  if (cached && now - cached.fetchedAt < ttl) return 'cache';
  if (online) return 'network';
  return cached ? 'stale' : 'fail';
}

/**
 * Italian label for when data was fetched: "oggi", "ieri", "il 12/10".
 * @param {number} fetchedAt
 * @param {number} now
 */
export function freshnessLabel(fetchedAt, now) {
  const day = (/** @type {number} */ t) => new Date(t).toDateString();
  if (day(fetchedAt) === day(now)) return 'oggi';
  if (day(fetchedAt) === day(now - DAY)) return 'ieri';
  const d = new Date(fetchedAt);
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  // "l'1/10", "l'8/10", "l'11/10": the article elides before a vowel sound.
  return [1, 8, 11].includes(d.getDate()) ? `l'${date}` : `il ${date}`;
}
