<script>
  // @ts-check
  // Play!: without a section, the hub (like Cards) with three tiles — Deck, Giocatori, Tornei
  // vicino a te. With ?tab=decks|players|events: that section.
  import { liveQuery } from 'dexie';
  import { db } from '../lib/db.js';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { cardImage, getCard } from '../lib/api/tcgdex.js';
  import { ageDivision } from '../lib/domain/players.js';
  import { liveTournaments, refreshTournaments } from '../lib/data/tournaments.js';
  import { nearby, upcoming, within } from '../lib/domain/ics.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import CardStack from '../lib/ui/CardStack.svelte';
  import Decks from './Decks.svelte';
  import Players from './play/Players.svelte';
  import Events from './play/Events.svelte';
  import TournamentMark from './play/TournamentMark.svelte';

  /** @type {{ query: Record<string, string> }} */
  let { query } = $props();

  const section = $derived(['decks', 'players', 'events'].includes(query.tab) ? query.tab : 'hub');

  const decks = liveQuery(() => db.decks.orderBy('updatedAt').reverse().toArray());
  // Deck tile: the cover of the two decks touched last (their chosen cover, else the first card).
  /** @type {(string | null)[]} */
  let deckCovers = $state([]);
  $effect(() => {
    const list = ($decks ?? []).slice(0, 2);
    Promise.all(
      list.map((d) => {
        const id = d.cover ?? d.cards[0]?.cardId;
        return id ? getCard('en', id).then((r) => cardImage(r.data)).catch(() => null) : Promise.resolve(null);
      }),
    ).then((imgs) => (deckCovers = imgs));
  });

  const saved = liveTournaments();
  /** The saved list, unless it is another country's automatic one (home moved abroad). */
  const tournaments = $derived(
    $saved && !($saved.source === 'auto' && $saved.country !== (settings.homePlace?.country || 'IT').toUpperCase()) ? $saved : null,
  );
  // Downloads the morning's tournaments when needed (at most every few hours).
  $effect(() => {
    if (settings.homePlace) refreshTournaments(settings.homePlace.country || 'IT').catch(() => {});
  });
  // Tournaments tile: the next three within the radius, Challenge/Cup/Prerelease first among
  // those of the next two weeks (they need booking), then the others.
  const nextThree = $derived.by(() => {
    if (!tournaments) return [];
    const list = within(nearby(upcoming(tournaments.events, Date.now()), settings.homePlace, settings.eventRadius), Date.now(), 14);
    const big = list.filter((t) => t.type && t.type !== 'league').slice(0, 3);
    return (big.length >= 3 ? big : [...big, ...list.filter((t) => !big.includes(t))].slice(0, 3)).sort((a, b) => a.start.localeCompare(b.start));
  });
  /** @param {string} start */
  function dayText(start) {
    const d = new Date(`${start.slice(0, 10)}T12:00`);
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
    const day = diff === 0 ? 'Oggi' : diff === 1 ? 'Domani' : d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${day} ${start.slice(11, 16)}`;
  }
  /** @param {{ km: number | null }} t */
  const km = (t) => (t.km != null ? Math.round(t.km) : null);

  const initials = (/** @type {string} */ name) =>
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const TITLES = /** @type {Record<string, string>} */ ({ players: 'Giocatori', events: 'Tornei vicino a te' });
</script>

{#if section === 'hub'}
  <header class="top"><h1>Play!</h1></header>
  <nav class="hub" aria-label="Sezioni di Play!">
    <a class="tile big card" href={hrefFor('deck', {}, { tab: 'decks' })}>
      <span class="txt">
        <strong>Deck</strong>
        <span class="num">{$decks?.length ?? 0} deck{$decks?.[0] ? ` · ultimo: ${$decks[0].name}` : ''}</span>
      </span>
      <CardStack images={deckCovers} width={70} />
    </a>

    <a class="tile card row" href={hrefFor('deck', {}, { tab: 'players' })}>
      <span class="txt">
        <strong>Giocatori</strong>
        <span class="num">
          {settings.players.length
            ? settings.players.map((p) => `${p.name.split(' ')[0]}${ageDivision(p.birthYear, Date.now()) ? ` (${ageDivision(p.birthYear, Date.now())})` : ''}`).join(', ')
            : 'ID giocatore e codice QR'}
        </span>
      </span>
      <span class="faces" aria-hidden="true">
        {#each settings.players.slice(0, 3) as p (p.id)}
          <span class="face">{#if p.avatar}<img src={p.avatar} alt="" />{:else}{initials(p.name)}{/if}</span>
        {:else}
          <span class="face empty">+</span>
        {/each}
      </span>
    </a>

    <a class="tile card events" href={hrefFor('deck', {}, { tab: 'events' })}>
      <span class="txt">
        <strong>Tornei</strong>
        <span class="num">{settings.homePlace ? `${settings.homePlace.name} · entro ${settings.eventRadius} km` : 'Imposta la tua città'}</span>
      </span>
      {#if nextThree.length}
        <ul class="preview">
          {#each nextThree as t (t.id)}
            <li>
              <TournamentMark type={t.type} size={30} title={t.title} start={t.start} />
              <span class="pv-txt">
                <strong>{t.title || t.place}</strong>
                <span class="num">{dayText(t.start)}{t.city ? ` · ${t.city}` : ''}{km(t) != null ? ` · ${km(t)} km` : ''}</span>
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <span class="next none">{settings.homePlace ? 'Importa i tornei per vederli qui, oppure apri la mappa' : 'Trova i tornei della tua zona'}</span>
      {/if}
    </a>
  </nav>
{:else if section === 'decks'}
  <Decks />
{:else}
  <BackHeader title={TITLES[section]} big fallback={hrefFor('deck')} />
  {#if section === 'players'}
    <div class="section"><Players /></div>
  {:else}
    <div class="section"><Events /></div>
  {/if}
{/if}

<style>
  .top {
    padding: 20px 16px 4px;
  }

  h1 {
    font-size: 28px;
  }

  .hub {
    padding: 14px 16px 24px;
    display: grid;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tile {
    position: relative;
    min-height: 170px;
    padding: 16px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }

  .tile.big,
  .tile.row {
    min-height: 0;
    flex-direction: row;
    align-items: center;
  }

  .tile.big {
    min-height: 170px;
  }

  .tile.events {
    min-height: 0;
  }

  .preview {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .preview li {
    padding: 10px 12px;
    border-radius: 16px;
    background: var(--bg);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pv-txt {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .pv-txt strong {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pv-txt span {
    font-size: 12px;
    color: var(--muted);
  }


  .txt {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .txt strong {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 800;
  }

  .big .txt strong {
    font-size: 28px;
  }

  .txt span {
    font-size: 12px;
    color: var(--muted);
  }

  .faces {
    display: flex;
  }

  .face {
    width: 44px;
    height: 44px;
    margin-right: -10px;
    border-radius: 50%;
    border: 2px solid var(--surface);
    background: var(--surface-2);
    overflow: hidden;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .face img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .face.empty {
    color: var(--muted);
    border-style: dashed;
    border-color: var(--line-2);
  }

  .next {
    padding: 8px 10px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.3;
  }

  .next.none {
    background: var(--surface-2);
    color: var(--muted);
    font-weight: 500;
  }

  .section {
    padding-bottom: 24px;
  }
</style>
