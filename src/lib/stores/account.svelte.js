// @ts-check
// Account and backup state shared by the whole app (Nav dot, Profile, first run).

/**
 * @typedef {{ email: string, name: string, givenName: string, picture: string | null }} User
 * @typedef {import('../domain/backup.js').BackupSummary} Summary
 * @typedef {{ local: Summary, remote: Summary, remoteFile: import('../sync/drive.js').DriveFile, reason: 'first-sign-in' | 'newer-on-drive' }} Choice
 */

export const account = $state({
  /** Settings loaded from Dexie. */
  ready: false,
  /** @type {User | null} */
  user: null,
  /** The first-run screen was answered (signed in or "continue without account"). */
  firstRunDone: false,
  online: navigator.onLine,
  /** Google needs a tap to renew access ("Continua"). */
  needsAuth: false,
  /** Changes not yet on Drive. */
  pending: false,
  saving: false,
  /** @type {number | null} */
  lastBackupAt: null,
  /** @type {string | null} */
  error: null,
  /** Sign-in in progress: waiting for Drive access, checking or restoring the backup. */
  /** @type {null | { step: 'drive' | 'checking' | 'restoring' | 'done', progress: number, remote?: Summary & { modifiedTime: string } }} */
  signIn: null,
  /** Two copies with data: the user must choose which one to keep. */
  /** @type {Choice | null} */
  choice: null,
});
