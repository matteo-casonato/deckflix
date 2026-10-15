<script>
  // @ts-check
  // Play! (docs/mockups/Deck.html): the players of this phone with their check-in QR, then the
  // decks with their completion, search, new deck, import.
  import { liveQuery } from 'dexie';
  import { Add01Icon, Search01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { createDeck, deckRows, ownedMap } from '../lib/data/decks.js';
  import { pasteErrorText, readListFromClipboard, setPendingList } from '../lib/data/pasteList.js';
  import { deckCheck, deckSummary } from '../lib/domain/deck.js';
  import { cardImage } from '../lib/api/tcgdex.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { navigate } from '../lib/router.svelte.js';
  import Icon from '../lib/ui/Icon.svelte';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import Players from './play/Players.svelte';

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
        // Preview: rule-box Pokémon first (the deck's stars), then the most played.
        const star = (/** @type {any} */ r) => Number(/\b(ex|V|VSTAR|VMAX|GX)$/.test(r.card?.name ?? ''));
        const fan = rows
          .filter((r) => r.section === 'Pokémon' && cardImage(r.card))
          .sort((a, b) => star(b) - star(a) || b.qty - a.qty)
          .slice(0, 3)
          .map((r) => /** @type {string} */ (cardImage(r.card)));
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

  const R = 20;
  const C = 2 * Math.PI * R;
</script>

<header class="top"><h1>Play!</h1></header>

<h2 class="label">Giocatori</h2>
<Players />

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
        <a class="deck card" href={hrefFor('deckDetail', { id: d.id })}>
          <span class="fan" aria-hidden="true">
            {#each info?.fan ?? [] as src, i (src)}
              <img {src} alt="" loading="lazy" style:--i={i} />
            {:else}
              <span class="ph"></span>
            {/each}
          </span>
          <span class="txt">
            <strong>{d.name}</strong>
            <span class="muted num">
              {#if s}{s.owned} di {s.total} possedute{s.missing ? ` · ${s.missing} mancanti` : ''}{:else}Calcolo…{/if}
            </span>
            {#if info}
              <span class="tags">
                <span class="tag" class:ok={info.check.standard} class:bad={!info.check.standard}>
                  {info.check.standard ? 'Standard' : 'Non standard'}
                </span>
                <span class="tag" class:ok={info.check.status === 'valid'} class:bad={info.check.status === 'invalid'}>
                  {STATUS[info.check.status]}{info.check.status === 'building' ? ` · ${info.check.total}/60` : ''}
                </span>
              </span>
            {/if}
          </span>
          <svg class="ring" viewBox="0 0 48 48" role="img" aria-label={`${s?.percent ?? 0}% posseduto`}>
            <circle cx="24" cy="24" r={R} class="track" />
            <circle cx="24" cy="24" r={R} class="fill" class:done={s?.complete} stroke-dasharray={`${((s?.percent ?? 0) / 100) * C} ${C}`} />
            <text x="24" y="28" text-anchor="middle" class="num">{s?.percent ?? 0}%</text>
          </svg>
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
    margin: 0;
    padding: 0 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .deck {
    min-height: 96px;
    padding: 12px 14px 12px 12px;
    border-radius: var(--r-card);
    background: var(--surface);
    display: flex;
    align-items: center;
    gap: 14px;
    color: var(--text);
    text-decoration: none;
  }

  /* Three cards overlapped and fanned out to the right. */
  .fan {
    position: relative;
    width: 76px;
    height: 72px;
    flex-shrink: 0;
  }

  .fan img,
  .ph {
    position: absolute;
    top: 4px;
    left: calc(var(--i) * 16px);
    width: 46px;
    aspect-ratio: 63 / 88;
    border-radius: 5px;
    object-fit: cover;
    box-shadow: 0 4px 10px rgb(0 0 0 / 0.4);
    transform: rotate(calc((var(--i) - 1) * 7deg));
    transform-origin: 50% 100%;
  }

  .ph {
    --i: 1;
    background: var(--surface-2);
    border: 1.5px dashed var(--line-2);
    box-shadow: none;
  }

  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .txt strong {
    font-family: var(--font-display);
    font-size: 19px;
    font-weight: 800;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .tags {
    margin-top: 3px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag {
    height: 22px;
    padding: 0 9px;
    border-radius: 11px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
  }

  .tag.ok {
    background: color-mix(in srgb, var(--success) 16%, var(--surface));
    color: var(--success);
  }

  .tag.bad {
    background: color-mix(in srgb, var(--danger) 16%, var(--surface));
    color: var(--danger);
  }

  .ring {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }

  .ring text {
    fill: var(--text);
    font-size: 12px;
    font-weight: 800;
  }

  .track,
  .fill {
    fill: none;
    stroke-width: 5;
  }

  .track {
    stroke: var(--surface-2);
  }

  .fill {
    stroke: var(--accent);
    stroke-linecap: round;
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
  }

  .fill.done {
    stroke: var(--success);
  }

  .wide {
    width: 100%;
  }
</style>
