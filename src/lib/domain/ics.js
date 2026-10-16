// @ts-check
// Tournaments from a file downloaded from pokedata.ovh and imported by the user (the app can't
// fetch it: their server only answers their own pages): their JSON (shop, city, position,
// type) or their iCalendar feed (.ics, shop and date only).

/**
 * @typedef {'cup' | 'challenge' | 'prerelease' | 'league'} TournamentType
 * @typedef {{ id: string, start: string, title: string, place: string, code: string | null,
 *   city?: string, type?: TournamentType, lat?: number, lng?: number }} Tournament
 * start: local date and time "YYYY-MM-DDTHH:MM"; place: the shop; code: Play! Pokémon event id
 * (26-08-008035); city, type and position come with the JSON file, not with the .ics.
 */

/** Italian names of the tournament types. */
export const TOURNAMENT_TYPES = /** @type {const} */ ([
  ['challenge', 'Challenge'],
  ['cup', 'Cup'],
  ['prerelease', 'Prerelease'],
  ['league', 'Lega e amichevoli'],
]);

/**
 * Type of a tournament from pokedata's type ("cups", "challenges", "prerelease", "friendly")
 * and its title, in English or Italian (Coppa di Lega, Sfida di Lega); the .ics file has the
 * title only. A title naming both Cup and Challenge is a Cup; no type and no keyword means a league day.
 * @param {string | undefined} raw
 * @param {string} title
 * @returns {TournamentType}
 */
export function tournamentType(raw, title) {
  const t = `${raw ?? ''} ${title}`.toLowerCase();
  if (/pre-?release/.test(t)) return 'prerelease';
  if (/\bcups?\b|\bcopp[ae]\b/.test(t)) return 'cup';
  if (/\bchallenges?\b|\bsfid[ae]\b/.test(t)) return 'challenge';
  return 'league';
}

/** English names pokedata sometimes uses for Italian cities. */
const CITY_NAMES = /** @type {Record<string, string>} */ ({
  Padua: 'Padova', Triest: 'Trieste', Venice: 'Venezia', Milan: 'Milano', Rome: 'Roma', Turin: 'Torino',
  Florence: 'Firenze', Naples: 'Napoli', Genoa: 'Genova', Mantua: 'Mantova', Syracuse: 'Siracusa', Leghorn: 'Livorno',
});

/** "Udine / Udin" → "Udine", "Padua" → "Padova". @param {unknown} raw */
export function cityName(raw) {
  if (!raw) return undefined;
  const name = String(raw).split(' / ')[0].trim();
  return CITY_NAMES[name] ?? name;
}

/**
 * Events of pokedata's JSON (the data behind their map: shop, city, position, type).
 * @param {string} text
 * @returns {Tournament[]}
 */
export function parseEventsJson(text) {
  const rows = JSON.parse(text);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r.when === 'string' && (!r.game || r.game === 'tcg'))
    .map((r) => ({
      id: String(r.id ?? `${r.when}|${r.shopName}`),
      start: r.when.replace(' ', 'T').slice(0, 16),
      title: String(r.title ?? '').trim(),
      place: String(r.shopName ?? '').trim(),
      code: /^\d{2}-\d{2}-\d{6}$/.test(r.pokemon_url ?? '') ? r.pokemon_url : null,
      city: cityName(r.city),
      type: tournamentType(r.type, String(r.title ?? '')),
      lat: typeof r.lat === 'number' ? r.lat : undefined,
      lng: typeof r.lng === 'number' ? r.lng : undefined,
    }))
    .sort((a, b) => a.start.localeCompare(b.start) || a.place.localeCompare(b.place));
}

/**
 * Straight-line distance in km (haversine), enough to tell San Donà from Padova.
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 */
export function distanceKm(a, b) {
  const rad = (/** @type {number} */ d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Tournaments within `radiusKm` of home, each with its distance (null without a position: those
 * come from the .ics, already limited to the area, and are kept).
 * @template {Tournament} T
 * @param {T[]} list
 * @param {{ lat: number, lng: number } | null} home
 * @param {number} radiusKm
 * @returns {(T & { km: number | null })[]}
 */
export function nearby(list, home, radiusKm) {
  return list
    .map((t) => ({ ...t, km: home && t.lat != null && t.lng != null ? distanceKm(home, { lat: t.lat, lng: t.lng }) : null }))
    .filter((t) => t.km == null || t.km <= radiusKm);
}

/**
 * Tournaments in the next `days` days (from today, local date).
 * @param {Tournament[]} list
 * @param {number} now
 * @param {number} days
 */
export function within(list, now, days) {
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  const last = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  return upcoming(list, now).filter((t) => t.start.slice(0, 10) <= last);
}

/** Undoes iCalendar text escaping. @param {string} v */
const unescape = (v) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

/**
 * "20261007T143000", "20261007T1530", "20261007" (floating local time) → "2026-10-07T14:30".
 * @param {string} v
 */
function parseDate(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}`;
}

/**
 * Events of an .ics file, sorted by date. Lines folded per RFC 5545 are joined.
 * @param {string} text
 * @returns {Tournament[]}
 */
export function parseIcs(text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  /** @type {Tournament[]} */
  const out = [];
  /** @type {Record<string, string> | null} */
  let ev = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') ev = {};
    else if (line === 'END:VEVENT' && ev) {
      const start = parseDate(ev.DTSTART ?? '');
      if (start) {
        const code = `${ev.DESCRIPTION ?? ''} ${ev.URL ?? ''}`.match(/\b\d{2}-\d{2}-\d{6}\b/)?.[0] ?? null;
        const title = unescape(ev.SUMMARY ?? '');
        out.push({
          id: ev.UID || `${start}|${ev.LOCATION ?? ''}`,
          start,
          title,
          place: unescape(ev.LOCATION ?? ''),
          code,
          type: tournamentType(undefined, title),
        });
      }
      ev = null;
    } else if (ev) {
      const i = line.indexOf(':');
      if (i > 0) ev[line.slice(0, i).split(';')[0].toUpperCase()] = line.slice(i + 1);
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.place.localeCompare(b.place));
}

/**
 * Tournaments from today on (by local date).
 * @param {Tournament[]} list
 * @param {number} now
 */
export function upcoming(list, now) {
  const d = new Date(now);
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return list.filter((t) => t.start.slice(0, 10) >= today);
}

/** Official page of a Play! Pokémon event. @param {string} code */
export const eventPageUrl = (code) => `https://www.pokemon.com/us/play-pokemon/pokemon-events/${code}/`;
