import { describe, expect, it } from 'vitest';
import { DriveError, createDrive } from '../src/lib/sync/drive.js';

/** Fake fetch that records calls and answers from a queue. */
function fakeFetch(...responses) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return new Response(r.body === undefined ? '{}' : JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  return { fn, calls };
}

const getToken = async () => 'tok';

describe('drive client', () => {
  it('finds the backup in appDataFolder with the bearer token', async () => {
    const f = fakeFetch({ body: { files: [{ id: 'f1', name: 'deckflix-backup.json', modifiedTime: '2026-10-15T10:00:00Z' }] } });
    const drive = createDrive({ getToken, fetchFn: f.fn });
    expect(await drive.findFile('deckflix-backup.json')).toMatchObject({ id: 'f1' });
    expect(f.calls[0].url).toContain('spaces=appDataFolder');
    expect(decodeURIComponent(f.calls[0].url)).toContain("name = 'deckflix-backup.json'");
    expect(f.calls[0].init.headers.Authorization).toBe('Bearer tok');
  });

  it('returns null when there is no backup', async () => {
    const drive = createDrive({ getToken, fetchFn: fakeFetch({ body: { files: [] } }).fn });
    expect(await drive.findFile('deckflix-backup.json')).toBeNull();
  });

  it('creates the file in appDataFolder, then overwrites it by id', async () => {
    const f = fakeFetch({ body: { id: 'new' } }, { body: { id: 'new' } });
    const drive = createDrive({ getToken, fetchFn: f.fn });
    await drive.upload('deckflix-backup.json', { app: 'deckflix' });
    await drive.upload('deckflix-backup.json', { app: 'deckflix' }, 'new');
    const [create, update] = f.calls;
    expect(create.init.method).toBe('POST');
    expect(create.url).toContain('uploadType=multipart');
    expect(create.init.body).toContain('"parents":["appDataFolder"]');
    expect(create.init.body).toContain('{"app":"deckflix"}');
    expect(create.init.headers['Content-Type']).toMatch(/^multipart\/related; boundary=/);
    expect(update.init.method).toBe('PATCH');
    expect(update.url).toContain('/files/new?');
    expect(update.init.body).not.toContain('parents');
  });

  it('maps failures to error kinds', async () => {
    await expect(createDrive({ getToken, fetchFn: fakeFetch({ status: 401 }).fn }).findFile('x')).rejects.toMatchObject({ kind: 'auth' });
    await expect(createDrive({ getToken, fetchFn: fakeFetch(new TypeError('net')).fn }).findFile('x')).rejects.toMatchObject({ kind: 'offline' });
    await expect(createDrive({ getToken, fetchFn: fakeFetch({ status: 500 }).fn }).download('x')).rejects.toBeInstanceOf(DriveError);
  });
});
