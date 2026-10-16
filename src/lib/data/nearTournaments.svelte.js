// @ts-check
// The next tournaments near home for the previews (Play! hub, Home): downloads the morning's
// list when needed and picks the three to show. Call during component init.
import { settings } from '../stores/settings.svelte.js';
import { liveTournaments, refreshTournaments } from './tournaments.js';
import { highlights, nearby, upcoming, within } from '../domain/ics.js';

export function nearTournaments() {
  const saved = liveTournaments();
  /** @type {import('./tournaments.js').TournamentsFile | null} */
  let file = $state(null);
  $effect(() => {
    const sub = saved.subscribe((v) => (file = v ?? null));
    return () => sub.unsubscribe();
  });

  // At most every few hours (refreshTournaments keeps track).
  $effect(() => {
    if (settings.homePlace) refreshTournaments(settings.homePlace.country || 'IT').catch(() => {});
  });

  const next = $derived.by(() => {
    // Another country's automatic list (home moved abroad) is not "near".
    const country = (settings.homePlace?.country || 'IT').toUpperCase();
    if (!file || (file.source === 'auto' && file.country !== country)) return [];
    const now = Date.now();
    return highlights(within(nearby(upcoming(file.events, now), settings.homePlace, settings.eventRadius), now, 14), 3);
  });

  return {
    /** The three to show: Challenge, Cup and Prerelease first, by date. */
    get next() {
      return next;
    },
  };
}
