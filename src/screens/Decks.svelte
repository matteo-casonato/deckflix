<script>
  // @ts-check
  // Deck list (docs/mockups/Deck.html): completion of each deck, search, new deck, import.
  import { liveQuery } from 'dexie';
  import { Add01Icon, Search01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { createDeck, deckRows, ownedMap } from '../lib/data/decks.js';
  import { pasteErrorText, readListFromClipboard, setPendingList } from '../lib/data/pasteList.js';
  import { deckSummary } from '../lib/domain/deck.js';
  import { euro } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { navigate } from '../lib/router.svelte.js';
  import Icon from '../lib/ui/Icon.svelte';
  import EmptyState from '../lib/ui/EmptyState.svelte';

  const decks = liveQuery(() => db.decks.orderBy('updatedAt').reverse().toArray());
  const owned = liveQuery(ownedMap);

  /** @type {Map<string, ReturnType<typeof deckSummary>>} */
  let summaries = $state(new Map());
  $effect(() => {
    const list = $decks;
    const own = $owned;
    if (!list || !own) return;
    Promise.all(list.map(async (d) => /** @type {const} */ ([d.id, deckSummary(await deckRows(d, own))]))).then(
      (pairs) => (summaries = new Map(pairs)),
    );
  });

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

  const date = (/** @type {number} */ t) => new Date(t).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  const R = 30;
  const C = 2 * Math.PI * R;
</script>

<header class="top">
  <h1>I miei deck</h1>
  <button class="round" aria-label="Nuovo deck" onclick={newDeck}><Icon icon={Add01Icon} /></button>
</header>

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
  {@const [hero, ...rest] = $decks}
  {@const hs = summaries.get(hero.id)}
  <a class="hero card" href={hrefFor('deckDetail', { id: hero.id })}>
    <span class="tag">{hs?.complete ? 'Pronto a giocare' : 'In costruzione'} · Standard</span>
    <span class="hero-row">
      <span class="txt">
        <strong>{hero.name}</strong>
        {#if hs}
          <span class="muted num">{hs.owned} di {hs.total} possedute{hs.missing ? ` · ${hs.missing} mancanti` : ''}</span>
          {#if hs.otherVersion}<span class="muted num">{hs.otherVersion} con versione alternativa</span>{/if}
        {:else}
          <span class="muted">Calcolo…</span>
        {/if}
      </span>
      <svg class="ring" viewBox="0 0 72 72" aria-label={`${hs?.percent ?? 0}% posseduto`}>
        <circle cx="36" cy="36" r={R} class="track" />
        <circle cx="36" cy="36" r={R} class="fill" stroke-dasharray={`${((hs?.percent ?? 0) / 100) * C} ${C}`} />
        <text x="36" y="41" text-anchor="middle" class="num">{hs?.percent ?? 0}%</text>
      </svg>
    </span>
  </a>

  <ul class="list">
    {#each rest as d (d.id)}
      {@const s = summaries.get(d.id)}
      <li>
        <a class="row card" href={hrefFor('deckDetail', { id: d.id })}>
          <span class="txt">
            <strong>{d.name}</strong>
            <span class="muted num">Standard · creato il {date(d.createdAt)}</span>
            <span class="muted num">
              {s ? (s.complete ? 'Completo' : `${s.missing} mancanti${s.missingCost ? ` · ${euro(s.missingCost)}` : ''}`) : '…'}
            </span>
          </span>
          <span class="pct num" class:done={s?.complete}>{s?.percent ?? 0}%</span>
        </a>
      </li>
    {/each}
  </ul>

  <div class="pad">
    <button class="btn wide" onclick={pasteList}>Incolla una lista</button>
    <p class="hint">Copiata da Limitless (“Copy to Clipboard”) o da Pokémon TCG Live.</p>
  </div>
{/if}

<style>
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

  .hero {
    margin: 14px 16px 0;
    padding: 18px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }

  .tag {
    align-self: flex-start;
    height: 28px;
    padding: 0 12px;
    border-radius: 14px;
    background: var(--bg);
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
  }

  .hero-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hero strong {
    font-family: var(--font-display);
    font-size: 24px;
  }

  .muted {
    color: var(--muted);
    font-size: 13px;
  }

  .ring {
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    transform: rotate(-90deg);
  }

  .ring text {
    transform: rotate(90deg);
    transform-origin: 36px 36px;
    fill: var(--text);
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-body);
  }

  .track,
  .fill {
    fill: none;
    stroke-width: 7;
  }

  .track {
    stroke: var(--bg);
  }

  .fill {
    stroke: var(--accent);
    stroke-linecap: round;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 12px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .row {
    padding: 14px 18px;
    border-radius: var(--r-card);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }

  .row strong {
    font-size: 16px;
  }

  .pct {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 18px;
    color: var(--muted);
  }

  .pct.done {
    color: var(--success);
  }

  .wide {
    width: 100%;
  }
</style>
