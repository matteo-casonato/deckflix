<script>
  // @ts-check
  // Play! (docs/mockups/Deck.html): the players of this phone with their check-in QR, then the
  // decks with their completion, search, new deck, import.
  import { liveQuery } from 'dexie';
  import { Add01Icon, Search01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { createDeck, deckRows, ownedMap } from '../lib/data/decks.js';
  import { pasteErrorText, readListFromClipboard, setPendingList } from '../lib/data/pasteList.js';
  import { coverCards, deckCheck, deckSummary } from '../lib/domain/deck.js';
  import { cardImage } from '../lib/api/tcgdex.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { navigate } from '../lib/router.svelte.js';
  import Icon from '../lib/ui/Icon.svelte';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import Players from './play/Players.svelte';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { nearbyEventsCalendar, nearbyEventsUrl, officialEventsUrl } from '../lib/domain/players.js';
  import StackRow from '../lib/ui/StackRow.svelte';

  const decks = liveQuery(() => db.decks.orderBy('updatedAt').reverse().toArray());
  const owned = liveQuery(ownedMap);

  /** @typedef {{ summary: ReturnType<typeof deckSummary>, check: ReturnType<typeof deckCheck>, fan: string[] }} DeckInfo */
  /** @type {Map<string, DeckInfo>} */
  let infos = $state(new Map());
  $effect(() => {
    const list = $decks;
    const own = $owned;
    if (!list || !own) return;
    Promise.all(
      list.map(async (d) => {
        const rows = await deckRows(d, own);
        // Preview: the cover (long press in the deck, or automatic) on top, two more behind.
        const ids = coverCards(rows, d.cover, (r) => !!cardImage(r.card), 2);
        const fan = ids.map((cid) => /** @type {string} */ (cardImage(rows.find((r) => r.cardId === cid)?.card)));
        return /** @type {const} */ ([d.id, { summary: deckSummary(rows), check: deckCheck(rows), fan }]);
      }),
    ).then((pairs) => (infos = new Map(pairs)));
  });

  const STATUS = { building: 'In costruzione', valid: 'Valido', invalid: 'Non valido' };

  async function pasteList() {
    const r = await readListFromClipboard();
    if ('error' in r) showToast(pasteErrorText(r.error));
    else setPendingList(r.text);
    navigate(hrefFor('deckImport'));
  }

  async function newDeck() {
    const id = await createDeck('Nuovo deck');
    navigate(hrefFor('deckEdit', { id }));
  }

</script>

<header class="top"><h1>Play!</h1></header>

<h2 class="label">Giocatori</h2>
<Players />

<h2 class="label">Tornei vicino a te</h2>
<section class="events card">
  {#if settings.homePlace}
    <span class="ev-txt">
      <strong>{settings.homePlace.name}</strong>
      <span class="muted">League Cup, Challenge, Prerelease e amichevoli entro {settings.eventRadius} km</span>
    </span>
    {@const cal = nearbyEventsCalendar(settings.homePlace, settings.eventRadius)}
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

<div class="decks-head">
  <h2 class="label">I miei deck</h2>
  <button class="round" aria-label="Nuovo deck" onclick={newDeck}><Icon icon={Add01Icon} /></button>
</div>

<div class="pad">
  <a class="search" href={hrefFor('search', {}, { standard: '1' })}>
    <Icon icon={Search01Icon} size={20} />
    <span>Cerca carte per i tuoi deck</span>
  </a>
</div>

{#if $decks && $decks.length === 0}
  <EmptyState title="Crea il tuo primo deck" text="Parti da zero o incolla una lista da un sito di tornei o da Pokémon TCG Live.">
    <button class="btn light" onclick={newDeck}>Nuovo deck</button>
    <button class="btn" onclick={pasteList}>Incolla lista</button>
  </EmptyState>
{:else if $decks}
  <ul class="list">
    {#each $decks as d (d.id)}
      {@const info = infos.get(d.id)}
      {@const s = info?.summary}
      <li>
        <StackRow
          href={hrefFor('deckDetail', { id: d.id })}
          images={info?.fan ?? []}
          title={d.name}
          sub={s ? `${s.owned} di ${s.total} possedute${s.missing ? ` · ${s.missing} mancanti` : ''}` : 'Calcolo…'}
          percent={s?.percent ?? 0}
          done={s?.complete}
        >
          {#if info}
            <span class="tag" class:ok={info.check.standard} class:bad={!info.check.standard}>{info.check.standard ? 'Standard' : 'Non standard'}</span>
            <span class="tag" class:ok={info.check.status === 'valid'} class:bad={info.check.status === 'invalid'}>
              {STATUS[info.check.status]}{info.check.status === 'building' ? ` · ${info.check.total}/60` : ''}
            </span>
          {/if}
        </StackRow>
      </li>
    {/each}
  </ul>

  <div class="pad">
    <button class="btn wide" onclick={pasteList}>Incolla una lista</button>
    <p class="hint">Copiata da Limitless (“Copy to Clipboard”) o da Pokémon TCG Live.</p>
  </div>
{/if}

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

  .label {
    margin: 18px 20px 10px;
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .decks-head {
    padding-right: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .decks-head .label {
    margin-top: 26px;
  }

  .hint {
    margin: 8px 4px 0;
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }

  .top {
    padding: 20px 16px 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    font-size: 28px;
  }

  .round {
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: var(--r-card);
    background: var(--text);
    color: var(--on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .pad {
    padding: 12px 16px 0;
  }

  .search {
    min-height: 52px;
    padding: 0 18px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 34px;
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--muted);
    text-decoration: none;
  }

  .list {
    list-style: none;
    margin: 14px 0 0;
    padding: 0 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .wide {
    width: 100%;
  }
</style>
