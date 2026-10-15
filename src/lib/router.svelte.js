// @ts-check
// Hash router: the current route as reactive state, updated on `hashchange`.
import { matchRoute } from './domain/routes.js';

export const router = $state({ route: matchRoute(location.hash) });

/** Screens visited inside the app since it opened, so "back" never leaves the app. */
let depth = 0;

window.addEventListener('hashchange', () => {
  const previous = router.route;
  router.route = matchRoute(location.hash);
  depth++;
  // Query-only changes (filters, tabs) keep the scroll position.
  if (previous.name !== router.route.name || JSON.stringify(previous.params) !== JSON.stringify(router.route.params)) {
    window.scrollTo(0, 0);
  }
});

/**
 * Navigates to a hash ("#/collection"); the hashchange listener updates the route.
 * @param {string} hash
 */
export function navigate(hash) {
  if (location.hash !== hash) location.hash = hash;
}

/**
 * Updates the query of the current screen without adding a history entry (filters, search text).
 * @param {string} hash
 */
export function replace(hash) {
  history.replaceState(history.state, '', hash);
  router.route = matchRoute(hash);
}

/**
 * Back to the previous screen of the app, or to `fallback` when opened from a link.
 * @param {string} fallback
 */
export function back(fallback) {
  if (depth > 0) {
    depth -= 2; // the hashchange caused by history.back() adds one again
    history.back();
  } else {
    navigate(fallback);
  }
}
