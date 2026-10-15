// @ts-check
// Hash routes of the app and a pure matcher, so routing can be unit tested.

/**
 * @typedef {'home' | 'collection' | 'scan' | 'deck' | 'profile' | 'set' | 'card' | 'notFound'} RouteName
 * @typedef {{ name: RouteName, params: Record<string, string> }} Route
 */

/** Patterns in priority order. `:name` segments become params. */
export const ROUTES = /** @type {const} */ ([
  ['home', '/home'],
  ['collection', '/collection'],
  ['scan', '/scan'],
  ['deck', '/deck'],
  ['profile', '/profile'],
  ['set', '/set/:id'],
  ['card', '/card/:lang/:id'],
]);

/** Routes shown full screen, without the navigation bar. */
export const FULL_SCREEN = new Set(['scan']);

/**
 * Maps a location hash ("#/card/it/sv03.5-025") to a route.
 * An empty hash is the home page; unknown paths give `notFound`.
 * @param {string} hash
 * @returns {Route}
 */
export function matchRoute(hash) {
  const path = hash.replace(/^#/, '').split('?')[0] || '/home';
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return { name: 'home', params: {} };
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
    if (ok) return { name, params };
  }
  return { name: 'notFound', params: {} };
}

/**
 * Builds a hash for a route, encoding params.
 * @param {RouteName} name
 * @param {Record<string, string>} [params]
 */
export function hrefFor(name, params = {}) {
  const pattern = ROUTES.find(([n]) => n === name)?.[1] ?? '/home';
  return `#${pattern.replace(/:(\w+)/g, (_, key) => encodeURIComponent(params[key] ?? ''))}`;
}
