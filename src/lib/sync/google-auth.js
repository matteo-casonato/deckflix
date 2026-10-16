// @ts-check
// Google Identity Services (GIS): the official "Accedi con Google" button for identity,
// and the token client for a Drive access token (scope drive.appdata).
// The access token lives only in memory (CLAUDE.md): it is never stored.
import { decodeIdToken } from '../domain/backup.js';

const GIS_URL = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata openid email profile';
/** Renew a little before Google's expiry (about one hour). */
const EXPIRY_MARGIN_MS = 60_000;

/** The Client ID is not secret: it comes from the build (VITE_GOOGLE_CLIENT_ID). */
export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const isConfigured = () => CLIENT_ID.length > 0;

export class AuthError extends Error {
  /**
   * @param {'not-configured' | 'popup' | 'denied' | 'interaction-required' | 'load'} kind
   * @param {string} message
   */
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

/** @type {Promise<any> | null} */
let gisLoading = null;

/** Development stand-in (npm run dev:mock); dropped from production builds. */
const MOCK = import.meta.env.VITE_GOOGLE_MOCK === '1';

/** Loads the GIS script once; resolves with `google.accounts`. */
export function loadGis() {
  if (!isConfigured()) return Promise.reject(new AuthError('not-configured', 'Accesso con Google non configurato'));
  if (MOCK) return import('./dev-mock.js').then((m) => m.mockAccounts);
  const w = /** @type {any} */ (window);
  if (w.google?.accounts) return Promise.resolve(w.google.accounts);
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_URL;
    s.async = true;
    s.onload = () => resolve(w.google.accounts);
    s.onerror = () => {
      gisLoading = null;
      reject(new AuthError('load', 'Non riesco a contattare Google: controlla la connessione'));
    };
    document.head.append(s);
  });
  return gisLoading;
}

/**
 * Draws the official Google sign-in button into `el`.
 * @param {HTMLElement} el
 * @param {(user: ReturnType<typeof decodeIdToken>) => void} onSignIn
 */
export async function renderSignInButton(el, onSignIn) {
  const accounts = await loadGis();
  accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (/** @type {{ credential: string }} */ r) => onSignIn(decodeIdToken(r.credential)),
    auto_select: false,
    use_fedcm_for_button: true,
  });
  accounts.id.renderButton(el, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: 'signin_with',
    logo_alignment: 'center',
    locale: 'it',
    width: Math.min(400, Math.max(200, el.clientWidth || 320)),
  });
}

/** @type {{ value: string, expiresAt: number } | null} */
let token = null;
/** How long a silent token request may take before the app asks for a tap. */
const SILENT_TIMEOUT_MS = 10_000;

export const hasValidToken = () => !!token && token.expiresAt - EXPIRY_MARGIN_MS > Date.now();

/**
 * Gets a Drive access token. `interactive: false` tries without any UI (fails if Google
 * needs a click); `interactive: true` must run inside a tap and may open Google's popup.
 * @param {{ interactive: boolean, hint?: string }} o
 * @returns {Promise<string>}
 */
export async function requestToken({ interactive, hint }) {
  const accounts = await loadGis();
  return new Promise((resolve, reject) => {
    // Without UI Google sometimes never answers (mobile browsers, first time after sign-in):
    // give up after a while, so the app asks for a tap ("Continua") instead of waiting forever.
    const timeout = interactive
      ? undefined
      : setTimeout(() => reject(new AuthError('interaction-required', 'Google non ha risposto: serve un tocco per continuare')), SILENT_TIMEOUT_MS);
    const client = accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      hint,
      prompt: interactive ? '' : 'none',
      callback: (/** @type {any} */ r) => {
        clearTimeout(timeout);
        if (r.error) {
          const needsUi = ['interaction_required', 'login_required', 'consent_required'].includes(r.error);
          reject(new AuthError(needsUi ? 'interaction-required' : 'denied', r.error_description ?? r.error));
          return;
        }
        if (!accounts.oauth2.hasGrantedAllScopes(r, 'https://www.googleapis.com/auth/drive.appdata')) {
          reject(new AuthError('denied', "Serve il permesso per la cartella dell'app su Google Drive"));
          return;
        }
        token = { value: r.access_token, expiresAt: Date.now() + Number(r.expires_in ?? 3600) * 1000 };
        resolve(token.value);
      },
      error_callback: (/** @type {{ type: string }} */ e) => {
        clearTimeout(timeout);
        reject(
          new AuthError(
            e.type === 'popup_closed' ? 'denied' : 'popup',
            e.type === 'popup_closed' ? 'Accesso annullato' : 'Il browser ha bloccato la finestra di Google',
          ),
        );
      },
    });
    client.requestAccessToken();
  });
}

/**
 * Current token, renewing it silently when expired.
 * @param {string} [hint] account email
 */
export async function getToken(hint) {
  if (hasValidToken()) return /** @type {{ value: string }} */ (token).value;
  return requestToken({ interactive: false, hint });
}

/** Revokes the token and forgets it (sign-out). */
export async function signOut() {
  const current = token;
  token = null;
  try {
    const accounts = await loadGis();
    accounts.id.disableAutoSelect();
    if (current) await new Promise((resolve) => accounts.oauth2.revoke(current.value, resolve));
  } catch {
    // Offline or not configured: the token is gone from memory anyway.
  }
}
