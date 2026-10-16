<script>
  // @ts-check
  // Play! › Tornei vicino a te: the tournaments imported from the .ics file, the map centred
  // on the home city, the calendar subscription and the official locator.
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { nearbyEventsCalendar, nearbyEventsUrl, officialEventsUrl } from '../../lib/domain/players.js';
  import { liveTournaments } from '../../lib/data/tournaments.js';
  import { eventPageUrl, upcoming } from '../../lib/domain/ics.js';
  import { hrefFor } from '../../lib/domain/routes.js';

  // Tournaments imported from the .ics file (Profilo › Tornei vicino a te), grouped by day.
  const tournaments = liveTournaments();
  let showAllEvents = $state(false);
  const nextEvents = $derived($tournaments ? upcoming($tournaments.events, Date.now()) : []);
  const eventDays = $derived.by(() => {
    /** @type {Map<string, typeof nextEvents>} */
    const days = new Map();
    for (const t of showAllEvents ? nextEvents : nextEvents.slice(0, 6)) days.set(t.start.slice(0, 10), [...(days.get(t.start.slice(0, 10)) ?? []), t]);
    return [...days.entries()];
  });
  const staleDays = $derived($tournaments ? Math.floor((Date.now() - $tournaments.importedAt) / 86_400_000) : 0);
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
</script>

<section class="events card">
  {#if settings.homePlace}
    <span class="ev-txt">
      <strong>{settings.homePlace.name}</strong>
      <span class="muted">League Cup, Challenge, Prerelease e amichevoli entro {settings.eventRadius} km</span>
    </span>
    {@const cal = nearbyEventsCalendar(settings.homePlace, settings.eventRadius)}
    {#if nextEvents.length}
      <div class="tlist">
        {#each eventDays as [day, list] (day)}
          <h3 class="tday">{dayLabel(day)}</h3>
          <ul>
            {#each list as t (t.id)}
              <li>
                <a href={t.code ? eventPageUrl(t.code) : nearbyEventsUrl(settings.homePlace, settings.eventRadius)} target="_blank" rel="noopener noreferrer">
                  <span class="ttime num">{t.start.slice(11, 16)}</span>
                  <span class="ttxt">
                    <strong>{t.title || t.place}</strong>
                    {#if t.title}<span class="muted">{t.place}</span>{/if}
                  </span>
                </a>
              </li>
            {/each}
          </ul>
        {/each}
        {#if nextEvents.length > 6}
          <button class="link-btn" onclick={() => (showAllEvents = !showAllEvents)}>
            {showAllEvents ? 'Mostra meno' : `Mostra tutti i ${nextEvents.length} tornei`}
          </button>
        {/if}
        <p class="muted cal-note">
          Importati {staleDays === 0 ? 'oggi' : staleDays === 1 ? 'ieri' : `${staleDays} giorni fa`}{staleDays > 7 ? ': aggiornali dalla pagina Tornei vicino a te' : ''}.
        </p>
      </div>
    {:else if $tournaments}
      <p class="muted cal-note">Nessun torneo in arrivo nel file importato: scaricane uno nuovo da Tornei vicino a te.</p>
    {/if}
    <a class="btn primary" href={nearbyEventsUrl(settings.homePlace, settings.eventRadius)} target="_blank" rel="noopener noreferrer">Apri la mappa dei tornei</a>
    <a class="btn" href={cal.google} target="_blank" rel="noopener noreferrer">Aggiungi i tornei a Google Calendar</a>
    <p class="muted cal-note">
      I tornei compaiono nel calendario e si aggiornano da soli. Con un altro calendario usa
      <a href={cal.webcal}>questo collegamento</a>.
    </p>
    <div class="ev-links">
      <a href={officialEventsUrl(settings.eventRadius)} target="_blank" rel="noopener noreferrer">Event Locator ufficiale</a>
      <a href={hrefFor('settings', { key: 'tornei' })}>Cambia città</a>
    </div>
  {:else}
    <span class="ev-txt">
      <strong>Trova i tornei della tua zona</strong>
      <span class="muted">Imposta la tua città una volta e da qui apri la mappa dei tornei vicini.</span>
    </span>
    <a class="btn" href={hrefFor('settings', { key: 'tornei' })}>Imposta la città</a>
  {/if}
</section>

<style>
  .events {
    margin: 0 16px;
    padding: 16px;
    border-radius: var(--r-card);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ev-txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ev-txt strong {
    font-size: 16px;
  }

  .cal-note {
    margin: -4px 4px 0;
    font-size: 12px;
  }

  .cal-note a {
    color: var(--accent);
  }

  .tlist ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .tday {
    margin: 6px 0 4px;
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .tlist a {
    min-height: 52px;
    padding: 6px 0;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--line);
    color: var(--text);
    text-decoration: none;
  }

  .ttime {
    width: 44px;
    flex-shrink: 0;
    font-weight: 800;
    color: var(--accent);
  }

  .ttxt {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .ttxt strong {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ttxt span {
    font-size: 12px;
  }

  .link-btn {
    min-height: 44px;
    margin-top: 4px;
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
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
    color: var(--accent);
  }

  .muted {
    color: var(--muted);
    font-size: 13px;
  }
</style>
