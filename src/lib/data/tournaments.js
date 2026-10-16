// @ts-check
// Tournaments imported from the file the user downloaded from pokedata.ovh (JSON or .ics). Kept on this
// phone only (a local setting, not in the backup): the file is easy to download again.
import { liveQuery } from 'dexie';
import { db } from '../db.js';
import { parseEventsJson, parseIcs, tournamentType } from '../domain/ics.js';

const KEY = 'tournaments';

/**
 * @typedef {{ importedAt: number, events: import('../domain/ics.js').Tournament[] }} TournamentsFile
 */

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
  await db.settings.put({ key: KEY, value: /** @type {TournamentsFile} */ ({ importedAt: Date.now(), events }) });
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
