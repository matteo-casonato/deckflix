// @ts-check
// Tournaments near home. Every morning the deploy workflow publishes the whole country's
// tournaments next to the app (tournaments/IT.json, from pokedata.ovh): the app downloads that
// file by itself and each phone keeps those within its radius. For countries without a file the
// user can still paste or import pokedata's list. Kept on this phone only (a local setting, not
// in the backup): it is downloaded again anyway.
import { liveQuery } from 'dexie';
import { db } from '../db.js';
import { parseEventsJson, parseIcs, tournamentType } from '../domain/ics.js';

const KEY = 'tournaments';

/**
 * @typedef {{ importedAt: number, events: import('../domain/ics.js').Tournament[],
 *   source?: 'auto' | 'manual', country?: string, checkedAt?: number }} TournamentsFile
 * importedAt: when the list was made (the morning file's time, or the manual import).
 */

/** How long a downloaded list is good before asking the site again. */
const FRESH_MS = 3 * 60 * 60 * 1000;
/** @type {Promise<boolean> | null} */
let inflight = null;

/**
 * Downloads this morning's tournaments of the country, unless checked in the last hours.
 * Resolves true when the app has the automatic list, false when the country has no file
 * (the manual import stays). Offline or failing: the saved list stays and it rejects.
 * @param {string} country "IT"
 * @param {boolean} [force]
 */
export function refreshTournaments(country, force = false) {
  inflight ??= (async () => {
    const code = (country || 'IT').toUpperCase();
    /** @type {TournamentsFile | undefined} */
    const saved = (await db.settings.get(KEY))?.value;
    if (!force && saved?.source === 'auto' && saved.country === code && Date.now() - (saved.checkedAt ?? 0) < FRESH_MS) return true;
    const res = await fetch(`${import.meta.env.BASE_URL}tournaments/${code}.json`, { cache: 'no-cache' });
    if (res.status === 404) return false;
    const type = res.headers.get('content-type') ?? '';
    // The app's own fallback page answers HTML for missing files in some setups.
    if (!res.ok || !type.includes('json')) {
      if (res.ok) return false;
      throw new Error(`HTTP ${res.status}`);
    }
    /** @type {{ generatedAt: number, country: string, events: import('../domain/ics.js').Tournament[] }} */
    const data = await res.json();
    if (!Array.isArray(data.events)) throw new Error('Elenco dei tornei non valido');
    const value = /** @type {TournamentsFile} */ ({ importedAt: data.generatedAt, events: data.events, source: 'auto', country: code, checkedAt: Date.now() });
    await db.settings.put({ key: KEY, value });
    return true;
  })().finally(() => (inflight = null));
  return inflight;
}

/**
 * Reads the JSON or .ics file and replaces the saved tournaments. Returns how many were read.
 * @param {File} file
 */
export async function importTournaments(file) {
  return importTournamentsText(await file.text());
}

/**
 * Same as importTournaments, from text pasted from the list page (select all, copy).
 * @param {string} raw
 */
export async function importTournamentsText(raw) {
  // Chrome may add text around a selection; keep from the first "[" to the last "]".
  let text = raw.trim();
  if (!text.startsWith('BEGIN:') && text.includes('[')) text = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
  // The JSON (city, position, type) or the .ics calendar (shop and date only).
  let events = [];
  try {
    events = text.startsWith('[') ? parseEventsJson(text) : parseIcs(text);
  } catch {
    events = [];
  }
  if (!events.length) throw new Error('Non trovo tornei: copia tutto il testo della pagina dell’elenco e riprova');
  await db.settings.put({ key: KEY, value: /** @type {TournamentsFile} */ ({ importedAt: Date.now(), events, source: 'manual' }) });
  return events.length;
}

export const clearTournaments = () => db.settings.delete(KEY);

/** Live saved tournaments, or null. The type is worked out again on reading, so files imported
 * by older versions (no type, or the old Challenge-before-Cup rule) show the right one. */
export const liveTournaments = () =>
  liveQuery(async () => {
    /** @type {TournamentsFile | undefined} */
    const file = (await db.settings.get(KEY))?.value;
    if (!file) return null;
    return { ...file, events: file.events.map((t) => ({ ...t, type: tournamentType(t.type, t.title) })) };
  });
