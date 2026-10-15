import { describe, expect, it } from 'vitest';
import {
  BackupFormatError,
  SCHEMA_VERSION,
  backupState,
  countsLabel,
  buildBackup,
  decodeIdToken,
  firstSignInAction,
  parseBackup,
  relativeTime,
  remoteIsNewer,
  summarize,
} from '../src/lib/domain/backup.js';

const tables = {
  collection: [
    { key: 'sv03.5-025|it|normal', cardId: 'sv03.5-025', qty: 2 },
    { key: 'sv03.5-025|it|reverse', cardId: 'sv03.5-025', qty: 1 },
  ],
  wishlist: [{ cardId: 'sv01-081' }],
  decks: [{ id: 'd1', name: 'Elettrico veloce', cards: [] }],
  priceSnapshots: [{ date: '2026-10-15', totalValue: 1.2 }],
  settings: [
    { key: 'cardLang', value: 'it' },
    { key: 'account', value: { email: 'a@b.c' } },
    { key: 'lastRemoteBackupAt', value: '2026-10-15T10:00:00.000Z' },
  ],
};

describe('buildBackup / parseBackup', () => {
  it('writes the SPEC format without device-only settings', () => {
    const b = buildBackup(tables, { now: new Date('2026-10-15T10:00:00Z'), device: 'Pixel' });
    expect(b).toMatchObject({ app: 'deckflix', schemaVersion: SCHEMA_VERSION, exportedAt: '2026-10-15T10:00:00.000Z', device: 'Pixel' });
    expect(b.settings).toEqual([{ key: 'cardLang', value: 'it' }]);
    expect(b).not.toHaveProperty('cardCache');
  });

  it('round-trips through JSON', () => {
    const b = buildBackup(tables, { now: new Date(), device: 'x' });
    expect(parseBackup(JSON.parse(JSON.stringify(b)))).toEqual(b);
  });

  it('rejects files that are not Deckflix backups or come from a newer app', () => {
    expect(() => parseBackup({ app: 'other' })).toThrow(BackupFormatError);
    expect(() => parseBackup({ app: 'deckflix', schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/più recente/);
    expect(() => parseBackup({ app: 'deckflix', schemaVersion: 1, decks: 'x' })).toThrow(BackupFormatError);
  });

  it('fills missing lists', () => {
    expect(parseBackup({ app: 'deckflix', schemaVersion: 1 }).collection).toEqual([]);
  });
});

describe('summarize', () => {
  it('counts copies, decks and wishes', () => {
    expect(summarize({ ...tables, exportedAt: 'x' })).toEqual({ cards: 3, entries: 2, decks: 1, wishlist: 1, exportedAt: 'x' });
  });
});

describe('firstSignInAction', () => {
  const empty = { cards: 0, entries: 0, decks: 0, wishlist: 0, exportedAt: null };
  const some = { ...empty, cards: 3, entries: 2 };

  it('restores automatically on an empty phone', () => {
    expect(firstSignInAction({ local: empty, remoteExists: true })).toBe('restore');
  });

  it('asks when both sides have data', () => {
    expect(firstSignInAction({ local: some, remoteExists: true })).toBe('choose');
  });

  it('uploads when Drive has nothing', () => {
    expect(firstSignInAction({ local: some, remoteExists: false })).toBe('upload');
    expect(firstSignInAction({ local: empty, remoteExists: false })).toBe('upload');
  });
});

describe('remoteIsNewer', () => {
  it('detects a save from another phone', () => {
    expect(remoteIsNewer({ remoteModifiedTime: '2026-10-15T10:05:00Z', lastRemoteBackupAt: '2026-10-15T10:00:00Z' })).toBe(true);
    expect(remoteIsNewer({ remoteModifiedTime: '2026-10-15T10:00:00Z', lastRemoteBackupAt: '2026-10-15T10:00:00Z' })).toBe(false);
  });

  it('treats an unknown last backup as a conflict, a missing file as none', () => {
    expect(remoteIsNewer({ remoteModifiedTime: '2026-10-15T10:00:00Z', lastRemoteBackupAt: null })).toBe(true);
    expect(remoteIsNewer({ remoteModifiedTime: null, lastRemoteBackupAt: null })).toBe(false);
  });
});

describe('backupState', () => {
  const base = { signedIn: true, online: true, needsAuth: false, pending: false, conflict: false };
  it('maps to the dot colours', () => {
    expect(backupState(base)).toBe('saved');
    expect(backupState({ ...base, pending: true })).toBe('pending');
    expect(backupState({ ...base, online: false, pending: true })).toBe('idle');
    expect(backupState({ ...base, needsAuth: true })).toBe('idle');
    expect(backupState({ ...base, conflict: true })).toBe('idle');
    expect(backupState({ ...base, signedIn: false })).toBe('none');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-10-15T16:30:00').getTime();
  it('formats in Italian', () => {
    expect(relativeTime(now - 10_000, now)).toBe('adesso');
    expect(relativeTime(now - 2 * 60_000, now)).toBe('2 minuti fa');
    expect(relativeTime(now - 3 * 3600_000, now)).toBe('3 ore fa');
    expect(relativeTime(new Date('2026-10-15T08:05:00').getTime(), now)).toBe('oggi alle 08:05');
    expect(relativeTime(new Date('2026-10-14T16:02:00').getTime(), now)).toBe('ieri alle 16:02');
    expect(relativeTime(new Date('2026-10-12T16:02:00').getTime(), now)).toBe('12/10/2026 alle 16:02');
  });
});

describe('decodeIdToken', () => {
  it('reads name, email and picture, with UTF-8 names', () => {
    const payload = { email: 'matteo@example.com', name: 'Matteo Ròssi', given_name: 'Matteo', picture: 'https://x/y.jpg' };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    expect(decodeIdToken(`h.${b64}.s`)).toEqual({
      email: 'matteo@example.com',
      name: 'Matteo Ròssi',
      givenName: 'Matteo',
      picture: 'https://x/y.jpg',
    });
  });
});

describe('countsLabel', () => {
  it('uses singular and plural', () => {
    const base = { entries: 0, exportedAt: null };
    expect(countsLabel({ ...base, cards: 1, decks: 1, wishlist: 1 })).toBe('1 carta · 1 deck · 1 desiderio');
    expect(countsLabel({ ...base, cards: 248, decks: 3, wishlist: 12 })).toBe('248 carte · 3 deck · 12 desideri');
  });
});
