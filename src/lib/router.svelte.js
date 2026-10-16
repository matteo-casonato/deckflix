// @ts-check
// Hash router: the current route as reactive state, updated on `hashchange`.
import { matchRoute } from './domain/routes.js';

export const router = $state({ route: matchRoute(location.hash) });

/** Screens visited inside the app since it opened, so "back" never leaves the app. */
let depth = 0;

// Scroll position of each screen, kept in its history entry: back to a list (from a card) lands
// where it was, a new screen starts at the top. The browser's own restoration is off because
// lists load after the route changes, when it has already given up.
history.scrollRestoration = 'manual';
/** @type {ReturnType<typeof setTimeout> | undefined} */
let saveTimer;
window.addEventListener(
  'scroll',
  () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => history.replaceState({ ...history.state, scroll: window.scrollY }, ''), 150);
  },
  { passive: true },
);

// A tap right after scrolling (on a card) saves the position at once, before the screen changes.
window.addEventListener(
  'pointerdown',
  () => {
    clearTimeout(saveTimer);
    history.replaceState({ ...history.state, scroll: window.scrollY }, '');
  },
  { capture: true, passive: true },
);

/** Scrolls to `y` once the page is tall enough (lists render after their data loads). @param {number} y */
function restoreScroll(y) {
  const until = Date.now() + 2000;
  const tick = () => {
    const reachable = document.documentElement.scrollHeight - window.innerHeight >= y;
    window.scrollTo(0, y);
    if (!reachable && Date.now() < until) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

window.addEventListener('hashchange', () => {
  clearTimeout(saveTimer);
  const previous = router.route;
  router.route = matchRoute(location.hash);
  depth++;
  // Query-only changes (filters, tabs) keep the scroll position.
  if (previous.name !== router.route.name || JSON.stringify(previous.params) !== JSON.stringify(router.route.params)) {
    const saved = history.state?.scroll;
    if (typeof saved === 'number' && saved > 0) restoreScroll(saved);
    else window.scrollTo(0, 0);
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

/**
 * Android back on the first Home screen asks before leaving (SPEC, UI guidelines): a guard
 * entry sits above the first one; the first back shows `onAttempt` and a second back within
 * a few seconds exits, otherwise the guard comes back.
 * @param {() => void} onAttempt
 */
export function guardExit(onAttempt) {
  if (router.route.name !== 'home' || history.state?.guard) return;
  history.replaceState({ ...history.state, root: true }, '');
  history.pushState({ guard: true }, '', location.hash);
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  window.addEventListener('popstate', (e) => {
    if (!e.state?.root || matchRoute(location.hash).name !== 'home') return;
    onAttempt();
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (history.state?.root) history.pushState({ guard: true }, '', location.hash);
    }, 2500);
  });
  window.addEventListener('hashchange', () => clearTimeout(timer));
}
