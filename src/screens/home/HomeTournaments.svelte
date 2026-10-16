<script>
  // @ts-check
  // Home › Prossimi tornei: the next three near home (Challenge, Cup and Prerelease first), as
  // in the Tornei page; without a city, a line to set it.
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { nearTournaments } from '../../lib/data/nearTournaments.svelte.js';
  import { eventPageUrl } from '../../lib/domain/ics.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import TournamentMark from '../play/TournamentMark.svelte';

  const near = nearTournaments();

  /** @param {string} start */
  function when(start) {
    const d = new Date(`${start.slice(0, 10)}T12:00`);
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
    return diff === 0 ? 'Oggi' : diff === 1 ? 'Domani' : d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
  }
  /** @param {{ title: string, place: string, city?: string, km: number | null }} t */
  const sub = (t) => [t.title ? t.place : '', t.city ?? '', t.km != null ? `${Math.round(t.km)} km` : ''].filter(Boolean).join(' · ');
</script>

{#if !settings.homePlace}
  <a class="setup card" href={hrefFor('settings', { key: 'tornei' })}>
    <span><strong>Tornei vicino a te</strong><span class="muted">Imposta la tua città per vederli qui</span></span>
    <span class="go" aria-hidden="true">›</span>
  </a>
{:else if near.next.length}
  <div class="section-head">
    <h2>Prossimi tornei</h2>
    <a href={hrefFor('deck', {}, { tab: 'events' })}>Tutti</a>
  </div>
  <ul class="list card">
    {#each near.next as t (t.id)}
      <li>
        <a href={t.code ? eventPageUrl(t.code) : hrefFor('deck', {}, { tab: 'events' })} target={t.code ? '_blank' : undefined} rel="noopener noreferrer">
          <TournamentMark type={t.type} size={34} title={t.title} start={t.start} />
          <span class="txt">
            <strong>{t.title || t.place}</strong>
            {#if sub(t)}<span class="muted">{sub(t)}</span>{/if}
          </span>
          <span class="when num"><span>{when(t.start)}</span>{t.start.slice(11, 16)}</span>
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  /* Same heading as the other Home sections. */
  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 22px 20px 10px;
    gap: 12px;
  }

  .section-head h2 {
    font-weight: 600;
    font-size: 19px;
  }

  .section-head a {
    min-height: 48px;
    display: flex;
    align-items: center;
    color: var(--muted);
    font-size: 14px;
    text-decoration: none;
  }

  .list {
    list-style: none;
    margin: 0 16px 24px;
    padding: 2px 12px;
    border-radius: var(--r-card);
    background: var(--surface);
  }

  .list li + li a {
    border-top: 1px solid var(--line);
  }

  .list a {
    min-height: 60px;
    padding: 8px 0;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }

  .txt {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .txt strong {
    font-size: 14px;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .muted {
    font-size: 12px;
    color: var(--muted);
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

  .when span {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
  }

  .setup {
    margin: 22px 16px 24px;
    padding: 14px 18px;
    border-radius: var(--r-card);
    background: var(--surface);
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--text);
    text-decoration: none;
  }

  .setup > span:first-child {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .go {
    font-size: 22px;
    color: var(--muted);
  }
</style>
