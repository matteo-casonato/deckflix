<script>
  // @ts-check
  // Play! › Tornei vicino a te: the tournaments of the next two weeks within the radius (city,
  // distance from home, type), by date or by city, filtered by type; then the map, the calendar
  // subscription and the official locator. The list downloads by itself (the site publishes the
  // country's tournaments every morning); only countries without it need pasting pokedata's list.
  import { settings } from '../../lib/stores/settings.svelte.js';
  import Flag from '../../lib/ui/Flag.svelte';
  import { nearbyEventsCalendar, nearbyEventsUrl, officialEventsUrl } from '../../lib/domain/players.js';
  import { liveTournaments, refreshTournaments } from '../../lib/data/tournaments.js';
  import { TOURNAMENT_TYPES, eventPageUrl, nearby, upcoming, within } from '../../lib/domain/ics.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import TournamentMark from './TournamentMark.svelte';
  import UpdateTournaments from './UpdateTournaments.svelte';

  /** @typedef {import('../../lib/domain/ics.js').Tournament & { km: number | null }} Row */

  const saved = liveTournaments();
  /** The saved list, unless it is another country's automatic one (home moved abroad). */
  const tournaments = $derived(
    $saved && !($saved.source === 'auto' && $saved.country !== (settings.homePlace?.country || 'IT').toUpperCase()) ? $saved : null,
  );
  let typeFilter = $state('all');
  let view = $state('date');
  let later = $state(false);
  let updating = $state(false);
  /** Automatic list: downloading, there, no file for this country, or failed (offline). */
  let auto = $state(/** @type {'loading' | 'ok' | 'none' | 'error'} */ ('loading'));

  /** @param {boolean} [force] */
  function refresh(force = false) {
    const country = settings.homePlace?.country || 'IT';
    auto = 'loading';
    refreshTournaments(country, force)
      .then((ok) => (auto = ok ? 'ok' : 'none'))
      .catch(() => (auto = 'error'));
  }
  $effect(() => {
    if (settings.homePlace) refresh();
  });

  const DAYS = 14;
  const now = Date.now();
  /** Upcoming tournaments within the radius, with their distance. */
  const all = $derived(
    tournaments ? /** @type {Row[]} */ (nearby(upcoming(tournaments.events, now), settings.homePlace, settings.eventRadius)) : [],
  );
  const rows = $derived((later ? all : within(all, now, DAYS)).filter((t) => typeFilter === 'all' || t.type === typeFilter));
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

  const staleDays = $derived(tournaments ? Math.max(0, Math.floor((Date.now() - tournaments.importedAt) / 86_400_000)) : 0);
  const isAuto = $derived(tournaments?.source === 'auto');

  /** Line under the title: the shop (when the title is something else), city, distance. @param {Row} t */
  const subline = (t) =>
    [t.title ? t.place : '', t.city ?? '', t.km != null ? `${Math.round(t.km)} km` : ''].filter(Boolean).join(' · ');

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
  {#if tournaments}
    <div class="tools">
      <div class="update">
        <span class="muted">
          {isAuto ? 'Si aggiornano da soli · ' : 'Importati '}{staleDays === 0 ? 'oggi' : staleDays === 1 ? 'ieri' : `${staleDays} giorni fa`}{auto === 'error' ? ' · offline' : ''}
        </span>
        {#if isAuto}
          <button class="link-btn small" onclick={() => refresh(true)} disabled={auto === 'loading'}>{auto === 'loading' ? 'Aggiorno…' : 'Aggiorna'}</button>
        {:else if auto === 'none'}
          <button class="btn small" class:primary={staleDays > 7} onclick={() => (updating = true)}>Aggiorna i tornei</button>
        {/if}
      </div>
      {#if !hasCities && !isAuto}
        <p class="warn">
          Mancano città e distanza: hai importato il calendario (.ics). Tocca <strong>Aggiorna i tornei</strong> e importa
          l’elenco.
        </p>
      {/if}
      <div class="chips" role="group" aria-label="Tipo di torneo">
        <button class="chip" aria-pressed={typeFilter === 'all'} onclick={() => (typeFilter = 'all')}>Tutti</button>
        {#each TOURNAMENT_TYPES as [key, label] (key)}
          <button class="chip" aria-pressed={typeFilter === key} disabled={!counts[key] && typeFilter !== key} onclick={() => (typeFilter = key)}>
            {label} <span class="num">{counts[key]}</span>
          </button>
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
                  <TournamentMark type={t.type} title={t.title} start={t.start} />
                  <span class="ttxt">
                    <strong>{t.title || t.place}</strong>
                    {#if subline(t)}<span class="muted">{subline(t)}</span>{/if}
                  </span>
                  <span class="when num">
                    {#if view === 'city'}<span class="d">{shortDay(t.start)}</span>{/if}
                    <span class="h">{t.start.slice(11, 16)}</span>
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
  {:else}
    <section class="intro card">
      {#if auto === 'loading'}
        <strong>Carico i tornei…</strong>
        <span class="muted">Ogni mattina il sito di Deckflix raccoglie i tornei ufficiali Play! Pokémon.</span>
      {:else if auto === 'error'}
        <strong>Non riesco a scaricare i tornei</strong>
        <span class="muted">Controlla la connessione e riprova.</span>
        <button class="btn primary" onclick={() => refresh(true)}>Riprova</button>
      {:else}
        <strong>Vedi i tornei qui nell’app</strong>
        <span class="muted">Per il tuo paese l’elenco automatico non c’è: copia l’elenco di pokedata e incollalo qui.</span>
        <button class="btn primary" onclick={() => (updating = true)}>Importa i tornei</button>
      {/if}
    </section>
  {/if}

  <section class="more card">
    <a class="btn primary" href={officialEventsUrl(settings.eventRadius)} target="_blank" rel="noopener noreferrer">Apri l’Event Locator ufficiale</a>
    <a class="btn" href={cal.google} target="_blank" rel="noopener noreferrer">Aggiungi a Google Calendar</a>
    <p class="muted note">Nel calendario i tornei si aggiornano da soli. Con un altro calendario usa <a href={cal.webcal}>questo collegamento</a>.</p>
    <a class="place" href={hrefFor('settings', { key: 'tornei' })}>
      <Flag country={settings.homePlace.country} width={18} />
      <span class="pname">{settings.homePlace.name} · {settings.eventRadius} km</span>
      <span class="change">Cambia</span>
    </a>
  </section>
{:else}
  <section class="intro card">
    <strong>Trova i tornei della tua zona</strong>
    <span class="muted">Imposta la tua città una volta: qui vedrai i tornei vicini con distanza e tipo.</span>
    <a class="btn" href={hrefFor('settings', { key: 'tornei' })}>Imposta la città</a>
  </section>
{/if}

<UpdateTournaments open={updating} onclose={() => (updating = false)} />

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
    margin-left: auto;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
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

  .ttxt strong {
    font-size: 14px;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .update {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .link-btn.small {
    margin: 0;
    padding: 0 4px;
  }

  .btn.small {
    min-height: 44px;
    padding: 0 16px;
    font-size: 14px;
  }

  .warn {
    margin: 0;
    padding: 10px 12px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
    font-size: 13px;
    line-height: 1.4;
  }

  .chip:disabled {
    opacity: 0.45;
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

  .note a {
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

  /* Home city on one line: name cut with "…" if long, "Cambia" always visible. */
  .place {
    min-height: 44px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--muted);
    text-decoration: none;
  }

  .pname {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .change {
    flex-shrink: 0;
    color: var(--accent);
    font-weight: 700;
  }
</style>
