// @ts-check
// Automatic backup to Google Drive (docs/SPEC.md § 7): runs only while the app is open.
// - Any change to collection, wishlist, decks, albums, snapshots or settings marks "to sync".
// - The backup starts 10 s after the last change and when the app goes to background.
// - Offline: no attempt; it retries on the `online` event.
// - Before overwriting, a newer file on Drive (another phone) asks the user to choose.
import { db } from '../db.js';
import { account } from '../stores/account.svelte.js';
import {
  BACKUP_FILE,
  BACKUP_PREV_FILE,
  shouldKeepPrevious,
  LOCAL_ONLY_SETTINGS,
  buildBackup,
  firstSignInAction,
  parseBackup,
  remoteIsNewer,
  summarize,
} from '../domain/backup.js';
import { createDrive } from './drive.js';
import { loadSettings } from '../stores/settings.svelte.js';
import { AuthError, getToken, hasValidToken, isConfigured, requestToken, signOut as revoke } from './google-auth.js';

export const DEBOUNCE_MS = 10_000;
/** Backup delay when the Drive token must be renewed first (see scheduleBackup). */
export const LATE_MS = 5 * 60_000;
/** Retry delays when Drive is unreachable while the browser says "online" (Wi-Fi without internet). */
const RETRY_MS = [30_000, 60_000, 120_000, 300_000];
const DATA_TABLES = /** @type {const} */ (['collection', 'wishlist', 'decks', 'albums', 'priceSnapshots']);

const MOCK = import.meta.env.VITE_GOOGLE_MOCK === '1';
const drive = createDrive({
  getToken: () => getToken(account.user?.email),
  // Development stand-in for the Drive API (npm run dev:mock).
  fetchFn: MOCK ? async (url, init) => (await import('./dev-mock.js')).mockDriveFetch(String(url), init) : undefined,
});

// ---------- settings helpers ----------

/** @param {string} key */
async function getSetting(key) {
  return (await db.settings.get(key))?.value;
}

/**
 * Local-only settings don't mark the data as changed (see LOCAL_ONLY_SETTINGS).
 * @param {string} key
 * @param {any} value
 */
function setSetting(key, value) {
  return db.settings.put({ key, value });
}

// ---------- change tracking ----------

/** While > 0 (restoring), writes don't count as user changes. */
let quiet = 0;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let retryTimer;
let retryCount = 0;

/** No connection to Drive: grey dot, and try again later even if no `online` event comes. */
function networkDown() {
  account.online = false;
  clearTimeout(retryTimer);
  const delay = RETRY_MS[Math.min(retryCount, RETRY_MS.length - 1)];
  retryCount++;
  retryTimer = setTimeout(() => {
    if (account.pending) backupNow();
  }, delay);
}

function networkUp() {
  account.online = true;
  retryCount = 0;
  clearTimeout(retryTimer);
}

/**
 * @param {{ urgent?: boolean }} [o] urgent: false for changes the app makes on its own (the
 *   daily value): they travel with the next backup instead of starting one.
 */
function markDirty({ urgent = true } = {}) {
  if (quiet > 0) return;
  account.pending = true;
  // Hooks run inside the caller's transaction: record the flag right after it.
  setTimeout(() => {
    db.syncQueue.add({ changedAt: Date.now() }).catch(() => {});
  }, 0);
  if (urgent) scheduleBackup();
}

/**
 * Without a valid token, renewing it opens Google's window for an instant (no backend means
 * no refresh token). So the backup waits: it runs when the app goes to the background, or
 * after LATE_MS, instead of 10 seconds after each change. With a valid token: DEBOUNCE_MS.
 */
function scheduleBackup() {
  clearTimeout(timer);
  if (!account.user) return;
  timer = setTimeout(() => backupNow(), hasValidToken() ? DEBOUNCE_MS : LATE_MS);
}

function watchChanges() {
  for (const name of DATA_TABLES) {
    const table = db.table(name);
    const urgent = name !== 'priceSnapshots';
    table.hook('creating', () => void markDirty({ urgent }));
    table.hook('updating', () => void markDirty({ urgent }));
    table.hook('deleting', () => void markDirty({ urgent }));
  }
  /** @param {any} key */
  const settingChanged = (key) => {
    if (!LOCAL_ONLY_SETTINGS.has(String(key))) markDirty();
  };
  db.settings.hook('creating', (key, obj) => void settingChanged(obj?.key ?? key));
  db.settings.hook('updating', (_mods, key) => void settingChanged(key));
  db.settings.hook('deleting', (key) => void settingChanged(key));
}

// ---------- startup ----------

let started = false;

/** Loads the saved account and starts watching changes, network and visibility. */
export async function initSync() {
  if (started) return;
  started = true;
  watchChanges();
  const [user, firstRunDone, lastBackupAt, queued] = await Promise.all([
    getSetting('account'),
    getSetting('firstRunDone'),
    getSetting('lastBackupAt'),
    db.syncQueue.count(),
  ]);
  account.user = user ?? null;
  account.firstRunDone = !!firstRunDone || !!user;
  account.lastBackupAt = lastBackupAt ?? null;
  account.pending = queued > 0;
  account.ready = true;

  window.addEventListener('online', () => {
    networkUp();
    if (account.pending) backupNow();
  });
  window.addEventListener('offline', () => {
    account.online = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && account.pending) backupNow();
  });
  if (account.user && account.pending) scheduleBackup();
}

/** First-run choice: use the app without a Google account. */
export async function continueWithoutAccount() {
  await setSetting('firstRunDone', true);
  account.firstRunDone = true;
}

// ---------- backup ----------

function deviceName() {
  const ua = navigator.userAgent;
  const android = ua.match(/Android [\d.]+; ([^;)]+)/);
  return android ? android[1].trim() : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Browser';
}

async function readTables() {
  const [collection, wishlist, decks, albums, priceSnapshots, settings] = await Promise.all([
    db.collection.toArray(),
    db.wishlist.toArray(),
    db.decks.toArray(),
    db.albums.toArray(),
    db.priceSnapshots.toArray(),
    db.settings.toArray(),
  ]);
  return { collection, wishlist, decks, albums, priceSnapshots, settings };
}

/** @param {unknown} err */
function handleError(err) {
  // Renewing the token while the app is in the background: the browser may block Google's
  // window. Not the user's fault, try again later.
  if (err instanceof AuthError && err.kind === 'popup' && document.visibilityState === 'hidden') {
    scheduleBackup();
    return;
  }
  if (err instanceof AuthError && err.kind !== 'not-configured') {
    account.needsAuth = true;
    account.error = null;
    return;
  }
  if (err && typeof err === 'object' && 'kind' in err && err.kind === 'auth') {
    account.needsAuth = true;
    return;
  }
  if (err && typeof err === 'object' && 'kind' in err && err.kind === 'offline') {
    networkDown();
    return;
  }
  account.error = err instanceof Error ? err.message : String(err);
}

/**
 * First backup of the day: the copy on Drive becomes deckflix-backup-prev.json, so a bad day
 * (wrong restore, mass deletion) can still be undone from yesterday's data. Best effort:
 * the main backup goes ahead even if this copy fails.
 * @param {string} id
 */
async function keepPrevious(id) {
  try {
    const old = await drive.download(id);
    const prev = await drive.findFile(BACKUP_PREV_FILE);
    await drive.upload(BACKUP_PREV_FILE, old, prev?.id ?? null);
  } catch (err) {
    console.warn('Previous-day copy not saved', err);
  }
}

/**
 * Saves everything to Drive now.
 * @param {{ interactive?: boolean, force?: boolean }} [o] interactive: called from a tap
 *   (may show Google's popup); force: overwrite even if Drive has a newer copy.
 */
export async function backupNow({ interactive = false, force = false } = {}) {
  clearTimeout(timer);
  if (!account.user || account.saving || account.choice) return;
  if (!navigator.onLine) {
    account.online = false;
    return;
  }
  account.saving = true;
  account.error = null;
  const startedAt = Date.now();
  try {
    if (interactive) await requestToken({ interactive: true, hint: account.user.email });
    const file = await drive.findFile(BACKUP_FILE);
    const lastRemoteBackupAt = await getSetting('lastRemoteBackupAt');
    if (!force && file && remoteIsNewer({ remoteModifiedTime: file.modifiedTime, lastRemoteBackupAt })) {
      const remote = parseBackup(await drive.download(file.id));
      account.choice = {
        local: summarize({ ...(await readTables()), exportedAt: new Date().toISOString() }),
        remote: summarize(remote),
        remoteFile: file,
        reason: 'newer-on-drive',
      };
      return;
    }
    if (file && shouldKeepPrevious(file.modifiedTime, Date.now())) await keepPrevious(file.id);
    const backup = buildBackup(await readTables(), { now: new Date(), device: deviceName() });
    const saved = await drive.upload(BACKUP_FILE, backup, file?.id ?? null);
    await setSetting('lastRemoteBackupAt', saved.modifiedTime);
    await setSetting('lastBackupAt', startedAt);
    account.lastBackupAt = startedAt;
    // Changes made while uploading stay queued for the next backup.
    await db.syncQueue.where('changedAt').belowOrEqual(startedAt).delete().catch(() => db.syncQueue.clear());
    account.pending = (await db.syncQueue.count()) > 0;
    account.needsAuth = false;
    networkUp();
    if (account.pending) scheduleBackup();
  } catch (err) {
    handleError(err);
  } finally {
    account.saving = false;
  }
}

// ---------- sign-in, restore, choice ----------

/**
 * Called by the official Google button. Then asks for Drive access (may need a tap if
 * the browser blocks Google's popup) and decides between restore, choice and upload.
 * @param {import('../stores/account.svelte.js').User} user
 */
export async function signIn(user) {
  account.user = user;
  account.firstRunDone = true;
  account.error = null;
  await setSetting('account', user);
  await setSetting('firstRunDone', true);
  account.signIn = { step: 'drive', progress: 0 };
  await connectDrive();
}

/** Asks Google for Drive access. From a tap ("Continua") when the popup was blocked. */
export async function connectDrive() {
  if (!account.user) return;
  try {
    await requestToken({ interactive: true, hint: account.user.email });
    account.needsAuth = false;
  } catch (err) {
    account.needsAuth = true;
    account.error = err instanceof AuthError && err.kind === 'denied' ? err.message : null;
    return;
  }
  await afterDriveAccess();
}

async function afterDriveAccess() {
  account.signIn = { step: 'checking', progress: 0.1 };
  try {
    const file = await drive.findFile(BACKUP_FILE);
    const local = summarize(await readTables());
    const action = firstSignInAction({ local, remoteExists: !!file });
    if (action === 'upload' || !file) {
      account.signIn = { step: 'done', progress: 1 };
      account.pending = true;
      await backupNow();
      return;
    }
    const remote = parseBackup(await drive.download(file.id));
    const remoteSummary = { ...summarize(remote), modifiedTime: file.modifiedTime };
    if (action === 'restore') {
      account.signIn = { step: 'restoring', progress: 0.5, remote: remoteSummary };
      await importBackup(remote, file.modifiedTime);
      account.signIn = { step: 'done', progress: 1, remote: remoteSummary };
      return;
    }
    account.signIn = null;
    account.choice = { local, remote: summarize(remote), remoteFile: file, reason: 'first-sign-in' };
  } catch (err) {
    account.signIn = null;
    handleError(err);
  }
}

/**
 * Replaces this phone's data with a backup, in one Dexie transaction.
 * @param {import('../domain/backup.js').BackupFile} backup
 * @param {string} remoteModifiedTime
 */
async function importBackup(backup, remoteModifiedTime) {
  quiet++;
  try {
    await db.transaction('rw', [db.collection, db.wishlist, db.decks, db.albums, db.priceSnapshots, db.settings, db.syncQueue], async () => {
      for (const name of DATA_TABLES) {
        await db.table(name).clear();
        await db.table(name).bulkPut(backup[name]);
      }
      const localOnly = (await db.settings.toArray()).filter((s) => LOCAL_ONLY_SETTINGS.has(s.key));
      await db.settings.clear();
      await db.settings.bulkPut([...backup.settings, ...localOnly]);
      await db.settings.put({ key: 'lastRemoteBackupAt', value: remoteModifiedTime });
      await db.syncQueue.clear();
    });
  } finally {
    quiet--;
  }
  account.pending = false;
  account.lastBackupAt = Date.parse(remoteModifiedTime) || Date.now();
  await setSetting('lastBackupAt', account.lastBackupAt);
  await loadSettings();
}

/**
 * Resolves a choice between this phone and Drive.
 * @param {'local' | 'remote'} keep
 */
export async function resolveChoice(keep) {
  const choice = account.choice;
  if (!choice) return;
  account.choice = null;
  if (keep === 'remote') {
    account.signIn = { step: 'restoring', progress: 0.5 };
    try {
      const remote = parseBackup(await drive.download(choice.remoteFile.id));
      await importBackup(remote, choice.remoteFile.modifiedTime);
      account.signIn = null;
    } catch (err) {
      account.signIn = null;
      handleError(err);
    }
    return;
  }
  account.signIn = null;
  account.pending = true;
  await backupNow({ force: true });
}

/** Explicit "Ripristina da Drive" from the Profile. */
export async function restoreFromDrive() {
  try {
    await requestToken({ interactive: true, hint: account.user?.email });
    const file = await drive.findFile(BACKUP_FILE);
    if (!file) {
      account.error = 'Su Google Drive non c’è ancora un backup';
      return;
    }
    account.signIn = { step: 'restoring', progress: 0.5 };
    await importBackup(parseBackup(await drive.download(file.id)), file.modifiedTime);
    account.signIn = null;
  } catch (err) {
    account.signIn = null;
    handleError(err);
  }
}

/**
 * Sign-out: revokes the token. Data stays on the phone unless `wipe`.
 * @param {{ wipe: boolean }} o
 */
export async function signOut({ wipe }) {
  clearTimeout(timer);
  await revoke();
  quiet++;
  try {
    if (wipe) {
      await db.cardPrices.clear();
      await db.transaction('rw', [db.collection, db.wishlist, db.decks, db.albums, db.priceSnapshots, db.settings, db.syncQueue], async () => {
        for (const name of DATA_TABLES) await db.table(name).clear();
        await db.settings.clear();
        await db.syncQueue.clear();
      });
    } else {
      await db.settings.bulkDelete(['account', 'lastBackupAt', 'lastRemoteBackupAt']);
    }
  } finally {
    quiet--;
  }
  Object.assign(account, {
    user: null,
    needsAuth: false,
    pending: wipe ? false : account.pending,
    lastBackupAt: null,
    error: null,
    choice: null,
    signIn: null,
    firstRunDone: !wipe,
  });
}

export { isConfigured };
