// @ts-check
// Tournaments from an iCalendar (.ics) file: the calendar feed of pokedata.ovh, downloaded by
// the user and imported (the app can't fetch it: their server only answers their own pages).

/**
 * @typedef {{ id: string, start: string, title: string, place: string, code: string | null }} Tournament
 * start: local date and time "YYYY-MM-DDTHH:MM"; code: Play! Pokémon event id (26-08-008035).
 */

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
        out.push({
          id: ev.UID || `${start}|${ev.LOCATION ?? ''}`,
          start,
          title: unescape(ev.SUMMARY ?? ''),
          place: unescape(ev.LOCATION ?? ''),
          code,
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
