// @ts-check
// Hash routes of the app and a pure matcher, so routing can be unit tested.

/**
 * @typedef {'home' | 'collection' | 'search' | 'quick' | 'scan' | 'deck' | 'deckImport' | 'deckDetail' | 'deckEdit' | 'profile' | 'csv' | 'play' | 'deckPrint' | 'album' | 'set' | 'card' | 'notFound'} RouteName
 * @typedef {{ name: RouteName, params: Record<string, string>, query: Record<string, string> }} Route
 */

/** Patterns in priority order. `:name` segments become params. */
export const ROUTES = /** @type {const} */ ([
  ['home', '/home'],
  ['collection', '/collection'],
  ['search', '/search'],
  ['quick', '/quick'],
  ['scan', '/scan'],
  ['deck', '/deck'],
  ['deckImport', '/deck/import'],
  ['deckDetail', '/deck/:id'],
  ['deckEdit', '/deck/:id/edit'],
  ['deckPrint', '/deck/:id/print'],
  ['profile', '/profile'],
  ['csv', '/profile/csv'],
  ['play', '/profile/play'],
  ['set', '/set/:id'],
  ['album', '/album/:id'],
  ['card', '/card/:lang/:id'],
]);

/** Routes shown full screen, without the navigation bar. */
export const FULL_SCREEN = new Set(['scan']);

/** Navigation bar item highlighted for each route. */
export const NAV_SECTION = /** @type {Record<RouteName, string>} */ ({
  home: 'home',
  collection: 'collection',
  search: 'collection',
  quick: 'collection',
  set: 'collection',
  album: 'collection',
  card: 'collection',
  scan: 'scan',
  deck: 'deck',
  deckImport: 'deck',
  deckDetail: 'deck',
  deckEdit: 'deck',
  deckPrint: 'deck',
  profile: 'profile',
  csv: 'profile',
  play: 'profile',
  notFound: '',
});

/**
 * Maps a location hash ("#/card/it/sv03.5-025") to a route.
 * An empty hash is the home page; unknown paths give `notFound`.
 * @param {string} hash
 * @returns {Route}
 */
export function matchRoute(hash) {
  const [rawPath, rawQuery = ''] = hash.replace(/^#/, '').split('?');
  const query = Object.fromEntries(new URLSearchParams(rawQuery));
  const parts = (rawPath || '/home').split('/').filter(Boolean);
  if (!parts.length) return { name: 'home', params: {}, query };
  for (const [name, pattern] of ROUTES) {
    const segs = pattern.split('/').filter(Boolean);
    if (segs.length !== parts.length) continue;
    /** @type {Record<string, string>} */
    const params = {};
    const ok = segs.every((seg, i) => {
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(parts[i]);
        return true;
      }
      return seg === parts[i];
    });
    if (ok) return { name, params, query };
  }
  return { name: 'notFound', params: {}, query };
}

/**
 * Builds a hash for a route, encoding params and an optional query.
 * @param {RouteName} name
 * @param {Record<string, string>} [params]
 * @param {Record<string, string | undefined | null>} [query] empty values are left out
 */
export function hrefFor(name, params = {}, query = {}) {
  const pattern = ROUTES.find(([n]) => n === name)?.[1] ?? '/home';
  const path = pattern.replace(/:(\w+)/g, (_, key) => encodeURIComponent(params[key] ?? ''));
  const qs = new URLSearchParams(
    /** @type {[string, string][]} */ (Object.entries(query).filter(([, v]) => v != null && v !== '')),
  ).toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}
