// @ts-check
// Backup file format and the decisions around it (docs/SPEC.md § 7). Pure functions.

export const BACKUP_FILE = 'deckflix-backup.json';
/** Safety copy: the backup as it was at the end of the previous day it was saved. */
export const BACKUP_PREV_FILE = 'deckflix-backup-prev.json';
/** The version not chosen when this phone and Drive differed: nothing is lost by choosing. */
export const BACKUP_REPLACED_FILE = 'deckflix-backup-replaced.json';
// v2: albums. An older app refuses a v2 backup instead of dropping the albums on its next save.
export const SCHEMA_VERSION = 2;

/** Settings that describe this device or the sync itself: never sent to Drive. */
export const LOCAL_ONLY_SETTINGS = new Set(['account', 'lastBackupAt', 'lastRemoteBackupAt', 'firstRunDone', 'signInReminderUntil', 'lastExportAt', 'tournaments']);

/**
 * @typedef {{ collection: any[], wishlist: any[], decks: any[], albums: any[], priceSnapshots: any[], settings: { key: string, value: any }[] }} BackupTables
 * @typedef {BackupTables & { app: 'deckflix', schemaVersion: number, exportedAt: string, device: string }} BackupFile
 * @typedef {{ cards: number, entries: number, decks: number, wishlist: number, exportedAt: string | null }} BackupSummary
 */

/**
 * @param {BackupTables} tables
 * @param {{ now: Date, device: string }} meta
 * @returns {BackupFile}
 */
export function buildBackup(tables, { now, device }) {
  return {
    app: 'deckflix',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    device,
    collection: tables.collection,
    wishlist: tables.wishlist,
    decks: tables.decks,
    albums: tables.albums,
    priceSnapshots: tables.priceSnapshots,
    settings: tables.settings.filter((s) => !LOCAL_ONLY_SETTINGS.has(s.key)),
  };
}

export class BackupFormatError extends Error {
  /** @param {'not-deckflix' | 'newer' | 'invalid'} kind @param {string} message */
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

/**
 * Validates a downloaded backup and migrates it to the current schema.
 * @param {any} json
 * @returns {BackupFile}
 */
export function parseBackup(json) {
  if (!json || json.app !== 'deckflix') throw new BackupFormatError('not-deckflix', 'Il file non è un backup di Deckflix');
  const version = Number(json.schemaVersion);
  if (!Number.isInteger(version) || version < 1) throw new BackupFormatError('invalid', 'Versione del backup non valida');
  if (version > SCHEMA_VERSION) {
    throw new BackupFormatError('newer', "Il backup è stato creato da una versione più recente dell'app: aggiorna Deckflix");
  }
  for (const key of ['collection', 'wishlist', 'decks', 'albums', 'priceSnapshots', 'settings']) {
    if (json[key] !== undefined && !Array.isArray(json[key])) throw new BackupFormatError('invalid', `Campo ${key} non valido`);
  }
  return {
    app: 'deckflix',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: String(json.exportedAt ?? ''),
    device: String(json.device ?? ''),
    collection: json.collection ?? [],
    wishlist: json.wishlist ?? [],
    decks: json.decks ?? [],
    albums: json.albums ?? [], // v1 backups have none
    priceSnapshots: json.priceSnapshots ?? [],
    settings: (json.settings ?? []).filter((/** @type {any} */ s) => !LOCAL_ONLY_SETTINGS.has(s?.key)),
  };
}

/**
 * Counts shown when choosing between two copies ("248 carte · 3 deck · 12 desideri").
 * @param {Pick<BackupTables, 'collection' | 'wishlist' | 'decks'> & { exportedAt?: string }} data
 * @returns {BackupSummary}
 */
export function summarize(data) {
  return {
    cards: data.collection.reduce((sum, e) => sum + (Number(e.qty) || 0), 0),
    entries: data.collection.length,
    decks: data.decks.length,
    wishlist: data.wishlist.length,
    exportedAt: data.exportedAt ?? null,
  };
}

/** @param {BackupSummary} s */
export const isEmpty = (s) => s.cards === 0 && s.decks === 0 && s.wishlist === 0;

/**
 * What to do right after signing in (SPEC § 7 "Ripristino al primo accesso").
 * - `restore`: Drive has a backup and this phone has no data → import it.
 * - `choose`: both have data → the user picks; never overwrite silently.
 * - `upload`: no backup on Drive → create the first one.
 * @param {{ local: BackupSummary, remoteExists: boolean }} s
 * @returns {'restore' | 'choose' | 'upload'}
 */
export function firstSignInAction({ local, remoteExists }) {
  if (!remoteExists) return 'upload';
  return isEmpty(local) ? 'restore' : 'choose';
}

/**
 * Before overwriting: is the file on Drive newer than the last version this phone wrote
 * or restored? Then another phone saved in between and the user must choose.
 * @param {{ remoteModifiedTime: string | null | undefined, lastRemoteBackupAt: string | null | undefined }} s
 */
export function remoteIsNewer({ remoteModifiedTime, lastRemoteBackupAt }) {
  if (!remoteModifiedTime) return false;
  if (!lastRemoteBackupAt) return true;
  return Date.parse(remoteModifiedTime) > Date.parse(lastRemoteBackupAt);
}

/**
 * Backup state for the dot on the avatar (docs/mockups/StatiBackup.html).
 * - `saved` (green): everything is on Drive.
 * - `pending` (yellow): changes waiting for the next backup, or saving now.
 * - `idle` (grey): offline, sign-in to renew, or a conflict to resolve.
 * - `none`: no account.
 * @param {{ signedIn: boolean, online: boolean, needsAuth: boolean, pending: boolean, conflict: boolean }} s
 * @returns {'saved' | 'pending' | 'idle' | 'none'}
 */
export function backupState({ signedIn, online, needsAuth, pending, conflict }) {
  if (!signedIn) return 'none';
  if (!online || needsAuth || conflict) return 'idle';
  return pending ? 'pending' : 'saved';
}

/**
 * "2 minuti fa", "ieri alle 16:02", "12/10/2026 alle 16:02".
 * @param {number} at
 * @param {number} now
 */
export function relativeTime(at, now) {
  const diff = Math.max(0, now - at);
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'adesso';
  if (min === 1) return '1 minuto fa';
  if (min < 60) return `${min} minuti fa`;
  const hours = Math.round(min / 60);
  if (hours < 6) return hours === 1 ? "1 ora fa" : `${hours} ore fa`;
  const d = new Date(at);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === new Date(now).toDateString()) return `oggi alle ${time}`;
  if (d.toDateString() === new Date(now - 86_400_000).toDateString()) return `ieri alle ${time}`;
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${date} alle ${time}`;
}

/**
 * Decodes the payload of a Google ID token (JWT) for name, email and photo.
 * No signature check: the token comes straight from Google Identity Services and is
 * only used to show who is signed in, never to authorise anything.
 * @param {string} jwt
 * @returns {{ email: string, name: string, givenName: string, picture: string | null }}
 */
export function decodeIdToken(jwt) {
  const part = jwt.split('.')[1];
  if (!part) throw new Error('Token non valido');
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const p = JSON.parse(new TextDecoder().decode(bytes));
  return {
    email: p.email ?? '',
    name: p.name ?? p.email ?? '',
    givenName: p.given_name ?? (p.name ?? '').split(' ')[0] ?? '',
    picture: p.picture ?? null,
  };
}

/**
 * "1 carta · 3 deck · 12 desideri"
 * @param {BackupSummary} s
 */
export function countsLabel(s) {
  return `${s.cards} ${s.cards === 1 ? 'carta' : 'carte'} · ${s.decks} deck · ${s.wishlist} ${s.wishlist === 1 ? 'desiderio' : 'desideri'}`;
}

/**
 * True when the Drive copy was last written on an earlier local day than `now`, so it should
 * be kept as the previous-day copy before being overwritten.
 * @param {string} remoteModifiedTime ISO date from Drive
 * @param {number} now
 */
export function shouldKeepPrevious(remoteModifiedTime, now) {
  const day = (/** @type {number} */ t) => new Date(t).toDateString();
  const t = Date.parse(remoteModifiedTime);
  return Number.isFinite(t) && day(t) !== day(now) && t < now;
}

/**
 * SPEC § 3: without an account and without any export, Home invites to sign in; the invite
 * can be postponed.
 * @param {{ signedIn: boolean, configured: boolean, copies: number, lastExportAt?: number | null, snoozedUntil?: number | null, now: number }} s
 */
export function showSignInReminder({ signedIn, configured, copies, lastExportAt, snoozedUntil, now }) {
  return !signedIn && configured && copies > 0 && !lastExportAt && !(snoozedUntil && snoozedUntil > now);
}

/** How long "Più tardi" hides the sign-in invite. */
export const REMINDER_SNOOZE_MS = 7 * 86_400_000;

/**
 * @typedef {{ collection: any[], wishlist: any[], decks: any[], albums: any[] }} ComparableData
 */

/** Copies per collection key. @param {any[]} collection */
const copiesByKey = (collection) => {
  /** @type {Map<string, number>} */
  const m = new Map();
  for (const e of collection) m.set(e.key, (m.get(e.key) ?? 0) + (Number(e.qty) || 0));
  return m;
};

/** Stable text of a list of decks or albums (name and cards), whatever the order. @param {any[]} list */
const listsText = (list) =>
  JSON.stringify(
    list
      .map((x) => [x.id, x.name ?? '', (x.cards ?? []).map((/** @type {any} */ c) => `${c.cardId}:${c.qty ?? 1}`).sort()])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );

/**
 * How two versions of the data differ: copies only on one side (per card, language, print and
 * condition), and whether decks, wishlist or albums differ. `same` when nothing the user sees
 * changes (dates and price history don't count).
 * @param {ComparableData} local
 * @param {ComparableData} remote
 */
export function compareData(local, remote) {
  const a = copiesByKey(local.collection);
  const b = copiesByKey(remote.collection);
  let onlyLocal = 0;
  let onlyRemote = 0;
  for (const [key, qty] of a) onlyLocal += Math.max(0, qty - (b.get(key) ?? 0));
  for (const [key, qty] of b) onlyRemote += Math.max(0, qty - (a.get(key) ?? 0));
  const wish = (/** @type {any[]} */ w) => JSON.stringify(w.map((x) => x.cardId).sort());
  const decks = listsText(local.decks) !== listsText(remote.decks);
  const wishlist = wish(local.wishlist) !== wish(remote.wishlist);
  const albums = listsText(local.albums ?? []) !== listsText(remote.albums ?? []);
  return { same: !onlyLocal && !onlyRemote && !decks && !wishlist && !albums, onlyLocal, onlyRemote, decks, wishlist, albums };
}

/**
 * The version to suggest: the one that has everything the other has and more cards. Null when
 * each has cards the other lacks, or only decks and lists differ (the user knows better).
 * @param {ReturnType<typeof compareData>} diff
 * @returns {'local' | 'remote' | null}
 */
export function suggestedVersion(diff) {
  if (diff.onlyLocal > 0 && diff.onlyRemote === 0) return 'local';
  if (diff.onlyRemote > 0 && diff.onlyLocal === 0) return 'remote';
  return null;
}
