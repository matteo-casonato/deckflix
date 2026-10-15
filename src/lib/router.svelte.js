// @ts-check
// Hash router: the current route as reactive state, updated on `hashchange`.
import { matchRoute } from './domain/routes.js';

export const router = $state({ route: matchRoute(location.hash) });

window.addEventListener('hashchange', () => {
  router.route = matchRoute(location.hash);
  window.scrollTo(0, 0);
});

/**
 * Navigates to a hash ("#/collection"); the hashchange listener updates the route.
 * @param {string} hash
 */
export function navigate(hash) {
  if (location.hash !== hash) location.hash = hash;
}
