// @ts-check
// Development-only stand-ins for Google Identity Services and the Drive API
// (npm run dev:mock). They let the sign-in, restore, backup and conflict flows run
// without a Google account. The fake Drive lives in localStorage, so clearing only
// IndexedDB behaves like a second phone with the same account.
// Never bundled in production: imported only when VITE_GOOGLE_MOCK=1.

const DRIVE_KEY = 'deckflix-mock-drive';
const USER = { email: 'prova@example.com', name: 'Utente Prova', given_name: 'Utente', picture: null };

/** @returns {Record<string, { id: string, name: string, modifiedTime: string, content: string }>} */
const readDrive = () => JSON.parse(localStorage.getItem(DRIVE_KEY) ?? '{}');
/** @param {ReturnType<typeof readDrive>} d */
const writeDrive = (d) => localStorage.setItem(DRIVE_KEY, JSON.stringify(d));

const b64url = (/** @type {string} */ s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fakeJwt = () => `x.${b64url(JSON.stringify(USER))}.y`;

/** Mimics the parts of `google.accounts` used by google-auth.js. */
export const mockAccounts = {
  id: {
    initialize(/** @type {any} */ o) {
      this.callback = o.callback;
    },
    /** @type {any} */
    callback: null,
    renderButton(/** @type {HTMLElement} */ el) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn light';
      b.textContent = 'Accedi con Google (simulato)';
      b.onclick = () => this.callback?.({ credential: fakeJwt() });
      el.replaceChildren(b);
    },
    disableAutoSelect() {},
  },
  oauth2: {
    initTokenClient(/** @type {any} */ o) {
      return {
        requestAccessToken() {
          if (localStorage.getItem('deckflix-mock-deny') === '1') {
            setTimeout(() => o.error_callback?.({ type: 'popup_failed_to_open' }), 50);
            return;
          }
          setTimeout(() => o.callback({ access_token: 'mock-token', expires_in: 3600, scope: o.scope }), 50);
        },
      };
    },
    hasGrantedAllScopes: () => true,
    revoke: (/** @type {string} */ _t, /** @type {() => void} */ done) => done(),
  },
};

/**
 * Fake fetch for the Drive endpoints used by drive.js.
 * @param {string} url
 * @param {RequestInit} [init]
 */
export async function mockDriveFetch(url, init = {}) {
  await new Promise((r) => setTimeout(r, 150));
  // 'deckflix-mock-no-internet' = Wi-Fi connected but no internet (navigator.onLine stays true).
  if (!navigator.onLine || localStorage.getItem('deckflix-mock-no-internet') === '1') throw new TypeError('Failed to fetch');
  const drive = readDrive();
  const u = new URL(url);
  const json = (/** @type {any} */ body, status = 200) => new Response(JSON.stringify(body), { status });

  if (u.pathname === '/drive/v3/files' && (!init.method || init.method === 'GET')) {
    const name = /name = '([^']+)'/.exec(u.searchParams.get('q') ?? '')?.[1];
    const files = Object.values(drive)
      .filter((f) => f.name === name)
      .map(({ content, ...meta }) => meta);
    return json({ files });
  }
  const media = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
  if (media && u.searchParams.get('alt') === 'media') {
    const f = drive[decodeURIComponent(media[1])];
    return f ? new Response(f.content) : json({ error: 'not found' }, 404);
  }
  const upload = /^\/upload\/drive\/v3\/files(?:\/([^/]+))?$/.exec(u.pathname);
  if (upload) {
    const parts = String(init.body).split(/\r\n--[^\r\n]+/);
    const meta = JSON.parse(parts[0].split('\r\n\r\n')[1]);
    const content = parts[1].split('\r\n\r\n')[1];
    const id = upload[1] ? decodeURIComponent(upload[1]) : `mock-${Date.now()}`;
    const modifiedTime = new Date().toISOString();
    drive[id] = { id, name: meta.name ?? drive[id]?.name, modifiedTime, content };
    writeDrive(drive);
    return json({ id, name: drive[id].name, modifiedTime });
  }
  return json({ error: 'unsupported' }, 400);
}
