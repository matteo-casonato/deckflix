// @ts-check
// Sets about to come out, for the prerelease tournaments: they happen before the set exists on
// TCGdex or pokesymbols, so their name (English and Italian) and logo are listed by hand.
// Add the next set when its prereleases are announced (logo: The Hobby Bin's set page).

/** @typedef {{ en: string, it: string, release: string, logo: string }} UpcomingSet */

/** @type {UpcomingSet[]} */
export const UPCOMING_SETS = [
  {
    en: 'Delta Reign',
    it: 'Dominio Delta',
    release: '2026-11-06',
    logo: 'https://thehobbybin.com/cdn/shop/files/Delta-Reign-Set-Logo.png?width=240',
  },
];

/** Prereleases run in the three weeks before the release. */
const PRERELEASE_DAYS = 21;

/** @param {string} s */
const norm = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

/**
 * The set a prerelease tournament is for: named in the title (English or Italian), else the
 * set coming out in the following three weeks.
 * @param {string} title
 * @param {string} start "YYYY-MM-DDTHH:MM"
 * @param {UpcomingSet[]} [sets]
 * @returns {UpcomingSet | null}
 */
export function prereleaseSet(title, start, sets = UPCOMING_SETS) {
  const t = ` ${norm(title)} `;
  const named = sets.find((s) => [s.en, s.it].some((n) => t.includes(` ${norm(n).trim()} `)));
  if (named) return named;
  const day = start.slice(0, 10);
  const days = (/** @type {string} */ release) => (Date.parse(release) - Date.parse(day)) / 86_400_000;
  return sets.find((s) => days(s.release) >= 0 && days(s.release) <= PRERELEASE_DAYS) ?? null;
}
