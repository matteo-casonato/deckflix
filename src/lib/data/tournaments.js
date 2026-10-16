// @ts-check
// Tournaments imported from the .ics file the user downloaded from pokedata.ovh. Kept on this
// phone only (a local setting, not in the backup): the file is easy to download again.
import { liveQuery } from 'dexie';
import { db } from '../db.js';
import { parseIcs } from '../domain/ics.js';

const KEY = 'tournaments';

/**
 * @typedef {{ importedAt: number, events: import('../domain/ics.js').Tournament[] }} TournamentsFile
 */

/**
 * Reads an .ics file and replaces the saved tournaments. Returns how many were read.
 * @param {File} file
 */
export async function importTournaments(file) {
  const events = parseIcs(await file.text());
  if (!events.length) throw new Error('Il file non contiene tornei: è il calendario scaricato da pokedata?');
  await db.settings.put({ key: KEY, value: /** @type {TournamentsFile} */ ({ importedAt: Date.now(), events }) });
  return events.length;
}

export const clearTournaments = () => db.settings.delete(KEY);

/** Live saved tournaments, or null. */
export const liveTournaments = () =>
  liveQuery(async () => /** @type {TournamentsFile | null} */ ((await db.settings.get(KEY))?.value ?? null));
