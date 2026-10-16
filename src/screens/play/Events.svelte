<script>
  // @ts-check
  // Play! › Tornei vicino a te: the tournaments of the next two weeks from the imported file
  // (city, distance from home, type), by date or by city, filtered by type; then the map,
  // the calendar subscription and the official locator.
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { nearbyEventsCalendar, nearbyEventsUrl, officialEventsUrl } from '../../lib/domain/players.js';
  import { liveTournaments } from '../../lib/data/tournaments.js';
  import { TOURNAMENT_TYPES, distanceKm, eventPageUrl, upcoming, within } from '../../lib/domain/ics.js';
  import { hrefFor } from '../../lib/domain/routes.js';

  /** @typedef {import('../../lib/domain/ics.js').Tournament & { km: number | null }} Row */

  const tournaments = liveTournaments();
  let typeFilter = $state('all');
  let view = $state('date');
  let later = $state(false);

  const DAYS = 14;
  const now = Date.now();
  const all = $derived($tournaments ? upcoming($tournaments.events, now) : []);
  const rows = $derived.by(() => {
    const home = settings.homePlace;
    const list = later ? all : within(all, now, DAYS);
    return /** @type {Row[]} */ (
      list
        .filter((t) => typeFilter === 'all' || t.type === typeFilter)
        .map((t) => ({ ...t, km: home && t.lat != null && t.lng != null ? distanceKm(home, { lat: t.lat, lng: t.lng }) : null }))
    );
  });
  const counts = $derived(
    Object.fromEntries(TOURNAMENT_TYPES.map(([k]) => [k, (later ? all : within(all, now, DAYS)).filter((t) => t.type === k).length])),
  );
  const hasCities = $derived(all.some((t) => t.city));

  /** Groups: by day (date view) or by city, nearest first (city view). */
  const groups = $derived.by(() => {
    /** @type {Map<string, Row[]>} */
    const m = new Map();
    for (const r of rows) {
      const key = view === 'city' ? (r.city ?? r.place) : r.start.slice(0, 10);
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    const list = [...m.entries()];
    if (view === 'city') list.sort((a, b) => (a[1][0].km ?? 999) - (b[1][0].km ?? 999) || a[0].localeCompare(b[0]));
    return list;
  });

  const staleDays = $derived($tournaments ? Math.floor((now - $tournaments.importedAt) / 86_400_000) : 0);
  const TYPE_LABEL = /** @type {Record<string, string>} */ ({ challenge: 'Challenge', cup: 'Cup', prerelease: 'Prerelease', league: 'Lega' });

  /** @param {string} day "YYYY-MM-DD" */
  function dayLabel(day) {
    const d = new Date(`${day}T12:00`);
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
    if (diff === 0) return 'Oggi';
    if (diff === 1) return 'Domani';
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  /** @param {string} start */
  const shortDay = (start) => {
    const label = dayLabel(start.slice(0, 10));
    return label === 'Oggi' || label === 'Domani' ? label : new Date(`${start.slice(0, 10)}T12:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  };
</script>

{#if settings.homePlace}
  {@const cal = nearbyEventsCalendar(settings.homePlace, settings.eventRadius)}
  {#if $tournaments}
    <div class="tools">
      <div class="chips" role="group" aria-label="Tipo di torneo">
        <button class="chip" aria-pressed={typeFilter === 'all'} onclick={() => (typeFilter = 'all')}>Tutti</button>
        {#each TOURNAMENT_TYPES as [key, label] (key)}
          {#if counts[key]}
            <button class="chip" aria-pressed={typeFilter === key} onclick={() => (typeFilter = key)}>{label} <span class="num">{counts[key]}</span></button>
          {/if}
        {/each}
      </div>
      {#if hasCities}
        <div class="chips" role="group" aria-label="Raggruppa">
          <button class="chip" aria-pressed={view === 'date'} onclick={() => (view = 'date')}>Per data</button>
          <button class="chip" aria-pressed={view === 'city'} onclick={() => (view = 'city')}>Per città</button>
        </div>
      {/if}
    </div>

    {#if rows.length}
      <div class="tlist">
        {#each groups as [key, list] (key)}
          <h3 class="tday">
            {view === 'city' ? key : dayLabel(key)}{view === 'city' && list[0].km != null ? ` · ${Math.round(list[0].km)} km` : ''}
          </h3>
          <ul class="card">
            {#each list as t (t.id)}
              <li>
                <a href={t.code ? eventPageUrl(t.code) : nearbyEventsUrl(settings.homePlace, settings.eventRadius)} target="_blank" rel="noopener noreferrer">
                  <span class="when num">
                    {#if view === 'city'}<span class="d">{shortDay(t.start)}</span>{/if}
                    <span class="h">{t.start.slice(11, 16)}</span>
                  </span>
                  <span class="ttxt">
                    <span class="top">
                      <span class="type {t.type}">{TYPE_LABEL[t.type ?? 'league']}</span>
                      <strong>{t.title || t.place}</strong>
                    </span>
                    <span class="muted">
                      {t.title ? `${t.place} · ` : ''}{view === 'date' && t.city ? t.city : ''}{t.km != null ? `${view === 'date' && t.city ? ' · ' : ''}${Math.round(t.km)} km` : ''}
                    </span>
                  </span>
                </a>
              </li>
            {/each}
          </ul>
        {/each}
      </div>
    {:else}
      <p class="muted pad">Nessun torneo {typeFilter === 'all' ? '' : 'di questo tipo '}nelle prossime due settimane.</p>
    {/if}
    {#if !later && all.length > within(all, now, DAYS).length}
      <button class="link-btn" onclick={() => (later = true)}>Mostra anche dopo le 2 settimane</button>
    {/if}
    <p class="muted note">
      Importati {staleDays === 0 ? 'oggi' : staleDays === 1 ? 'ieri' : `${staleDays} giorni fa`}{staleDays > 7 ? ': aggiornali' : ''} ·
      <a href={hrefFor('settings', { key: 'tornei' })}>aggiorna</a>{!hasCities ? ' · scarica l’elenco dalle impostazioni per vedere città e distanza' : ''}.
    </p>
  {:else}
    <section class="intro card">
      <strong>Vedi i tornei qui nell’app</strong>
      <span class="muted">Salva l’elenco dei tornei della tua zona e importalo: due passaggi dalla pagina Tornei vicino a te.</span>
      <a class="btn" href={hrefFor('settings', { key: 'tornei' })}>Importa i tornei</a>
    </section>
  {/if}

  <section class="more card">
    <a class="btn primary" href={nearbyEventsUrl(settings.homePlace, settings.eventRadius)} target="_blank" rel="noopener noreferrer">Apri la mappa dei tornei</a>
    <a class="btn" href={cal.google} target="_blank" rel="noopener noreferrer">Aggiungi i tornei a Google Calendar</a>
    <p class="muted note">Nel calendario i tornei si aggiornano da soli. Con un altro calendario usa <a href={cal.webcal}>questo collegamento</a>.</p>
    <div class="ev-links">
      <a href={officialEventsUrl(settings.eventRadius)} target="_blank" rel="noopener noreferrer">Event Locator ufficiale</a>
      <a href={hrefFor('settings', { key: 'tornei' })}>{settings.homePlace.name} · {settings.eventRadius} km</a>
    </div>
  </section>
{:else}
  <section class="intro card">
    <strong>Trova i tornei della tua zona</strong>
    <span class="muted">Imposta la tua città una volta: qui vedrai i tornei vicini con distanza e tipo.</span>
    <a class="btn" href={hrefFor('settings', { key: 'tornei' })}>Imposta la città</a>
  </section>
{/if}

<style>
  .tools {
    padding: 0 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tools .chips {
    padding: 0;
    flex-wrap: wrap;
  }

  .tlist {
    padding: 4px 16px 0;
  }

  .tday {
    margin: 16px 4px 6px;
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .tlist ul {
    list-style: none;
    margin: 0;
    padding: 2px 12px;
    border-radius: var(--r-card);
    background: var(--surface);
  }

  .tlist li + li a {
    border-top: 1px solid var(--line);
  }

  .tlist a {
    min-height: 60px;
    padding: 8px 0;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }

  .when {
    width: 52px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    font-weight: 800;
    color: var(--accent);
  }

  .when .d {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
  }

  .ttxt {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .top {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .top strong {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .type {
    flex-shrink: 0;
    padding: 1px 7px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 800;
    background: var(--surface-2);
    color: var(--muted);
  }

  .type.challenge {
    background: color-mix(in srgb, var(--accent) 18%, var(--surface));
    color: var(--accent);
  }

  .type.cup {
    background: color-mix(in srgb, var(--danger) 18%, var(--surface));
    color: var(--danger);
  }

  .type.prerelease {
    background: color-mix(in srgb, var(--success) 18%, var(--surface));
    color: var(--success);
  }

  .muted {
    color: var(--muted);
    font-size: 12px;
  }

  .pad {
    padding: 12px 20px 0;
  }

  .note {
    margin: 10px 20px 0;
  }

  .note a,
  .ev-links a {
    color: var(--accent);
  }

  .link-btn {
    min-height: 44px;
    margin: 6px 16px 0;
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .intro,
  .more {
    margin: 16px 16px 0;
    padding: 16px;
    border-radius: var(--r-card);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .more .note {
    margin: -2px 4px 0;
  }

  .ev-links {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
  }

  .ev-links a {
    min-height: 44px;
    display: flex;
    align-items: center;
  }
</style>
