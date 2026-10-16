// @ts-check
// Play! Pokémon players saved in the app (the user and, e.g., a child): name, Player ID,
// birth year, age division and the check-in QR code.

/** @typedef {{ id: string, name: string, playerId: string, birthYear: number, avatar?: string | null }} Player avatar: small JPEG data URL */

/** How long a generated check-in code stays valid, like the official app (10 days). */
export const QR_VALID_DAYS = 10;

/** @param {Date} d */
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Content of the check-in QR code. The official Pokémon app shows a QR with this JSON in
 * base64, keys in this order (decoded from a real code on 15/10/2026):
 * {"pi":"4359311","fn":"Alessio","li":"C","by":"2015","e":"2026-10-25"}
 * pi = Player ID, fn = first name, li = last-name initial, by = birth year, e = expiry date.
 * @param {Player} p
 * @param {number} now
 */
export function playerQrText(p, now) {
  const words = p.name.trim().split(/\s+/);
  const first = words.length > 1 ? words.slice(0, -1).join(' ') : (words[0] ?? '');
  const initial = words.length > 1 ? (words.at(-1)?.[0] ?? '').toUpperCase() : '';
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + QR_VALID_DAYS);
  const json = JSON.stringify({ pi: String(p.playerId), fn: first, li: initial, by: String(p.birthYear), e: isoDay(expiry) });
  const bytes = new TextEncoder().encode(json);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Play! Pokémon season a date belongs to, named after the year it ends (the 2027 season
 * starts in summer 2026). Assumption: the new season and its divisions start on 1 July.
 * @param {number} now
 */
export function seasonYear(now) {
  const d = new Date(now);
  return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
}

/**
 * Age division from the birth year: in the season ending in year E, Juniors are born in
 * E−12 or later, Seniors in E−16 … E−13, Masters in E−17 or earlier (2026 season: Junior
 * 2014+, Senior 2010–2013, Master 2009 and before).
 * @param {number} birthYear
 * @param {number} now
 * @returns {'Junior' | 'Senior' | 'Master' | null}
 */
export function ageDivision(birthYear, now) {
  if (!Number.isInteger(birthYear) || birthYear < 1900) return null;
  const e = seasonYear(now);
  if (birthYear >= e - 12) return 'Junior';
  if (birthYear >= e - 16) return 'Senior';
  return 'Master';
}

/** Player IDs are numbers (usually 7 digits). @param {string} id */
export const validPlayerId = (id) => /^\d{4,10}$/.test(id.trim());

/**
 * Championship Points leaderboard of a player on pokedata.ovh (it reads the official Play!
 * Pokémon leaderboards and keeps their history). The site can't be read by the app (no
 * CORS), so this is a link, already filtered by season, region, division and name.
 * @param {Player} p
 * @param {number} now
 * @param {string} [region] e.g. "Europe"
 */
export function pointsUrl(p, now, region = 'Europe') {
  const division = { Junior: 'Juniors', Senior: 'Seniors', Master: 'Masters' }[ageDivision(p.birthYear, now) ?? 'Master'];
  const params = new URLSearchParams({ game: 'TCG', region, division, search: p.name.trim() });
  return `https://pokedata.ovh/${seasonYear(now)}/?${params}`;
}

/** @typedef {{ name: string, country: string, lat: number, lng: number }} HomePlace */

/** Event types of the trading card game on pokedata.ovh (League Cup, Challenge, Prerelease, friendly). */
const TCG_EVENT_TYPES = ['cups', 'challenges', 'prerelease', 'friendly'];

/**
 * Tournaments near home on pokedata.ovh's event map (built on the official Play! Pokémon
 * events). Their data can't be read by the app (CORS limited to their site), so this is a
 * link with the map already centred, radius set and only TCG events.
 * @param {HomePlace} place
 * @param {number} radiusKm
 */
export function nearbyEventsUrl(place, radiusKm) {
  const params = new URLSearchParams({
    spatialMode: 'radius',
    lat: place.lat.toFixed(5),
    lng: place.lng.toFixed(5),
    radius: String(radiusKm),
    unit: 'km',
    country: place.country.toUpperCase(),
    tcgTypes: TCG_EVENT_TYPES.join(','),
  });
  return `https://pokedata.ovh/events2/?${params}`;
}

/** Official Play! Pokémon event locator (TCG, within `radiusKm`), as a fallback. @param {number} radiusKm */
export const officialEventsUrl = (radiusKm) =>
  `https://events.pokemon.com/EventLocator/?locale=it-IT&range=${radiusKm}&iskm=true&filters=tcg`;
