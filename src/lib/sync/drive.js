// @ts-check
// Google Drive API v3 over fetch, limited to the app's hidden appDataFolder
// (scope drive.appdata: the app cannot see the user's other files).

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export class DriveError extends Error {
  /**
   * @param {'auth' | 'offline' | 'not-found' | 'http'} kind
   * @param {string} message
   * @param {number} [status]
   */
  constructor(kind, message, status) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

/** @typedef {{ id: string, name: string, modifiedTime: string, size?: string }} DriveFile */

/**
 * @param {{ getToken: () => Promise<string>, fetchFn?: typeof fetch }} deps
 */
export function createDrive({ getToken, fetchFn = (...a) => fetch(...a) }) {
  /**
   * @param {string} url
   * @param {RequestInit} [init]
   */
  async function call(url, init = {}) {
    const token = await getToken();
    let res;
    try {
      res = await fetchFn(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
    } catch {
      throw new DriveError('offline', 'Connessione non disponibile');
    }
    if (res.status === 401 || res.status === 403) throw new DriveError('auth', 'Accesso a Google Drive da rinnovare', res.status);
    if (res.status === 404) throw new DriveError('not-found', 'File non trovato su Drive', 404);
    if (!res.ok) throw new DriveError('http', `Google Drive ha risposto ${res.status}`, res.status);
    return res;
  }

  return {
    /**
     * Newest file with this name in appDataFolder, or null.
     * @param {string} name
     * @returns {Promise<DriveFile | null>}
     */
    async findFile(name) {
      const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and trashed = false`);
      const url = `${API}/files?spaces=appDataFolder&q=${q}&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id,name,modifiedTime,size)`;
      const data = await (await call(url)).json();
      return data.files?.[0] ?? null;
    },

    /**
     * @param {string} id
     * @returns {Promise<any>}
     */
    async download(id) {
      return (await call(`${API}/files/${encodeURIComponent(id)}?alt=media`)).json();
    },

    /**
     * Creates the file in appDataFolder, or overwrites it when `id` is given (multipart upload).
     * @param {string} name
     * @param {unknown} content
     * @param {string | null} [id]
     * @returns {Promise<DriveFile>}
     */
    async upload(name, content, id = null) {
      const boundary = `deckflix-${Math.random().toString(36).slice(2)}`;
      const metadata = id ? { name } : { name, parents: ['appDataFolder'], mimeType: 'application/json' };
      const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(content),
        `--${boundary}--`,
        '',
      ].join('\r\n');
      const fields = 'fields=id,name,modifiedTime,size';
      const url = id
        ? `${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=multipart&${fields}`
        : `${UPLOAD}/files?uploadType=multipart&${fields}`;
      const res = await call(url, {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
      return res.json();
    },
  };
}
