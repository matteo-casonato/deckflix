<script>
  // @ts-check
  // Play! › Deck (docs/mockups/Deck.html): decks with their completion, search, new deck, import.
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
  import StackRow from '../lib/ui/StackRow.svelte';
  import BackHeader from '../lib/ui/BackHeader.svelte';

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


<BackHeader title="Deck" big fallback={hrefFor('deck')}>
  <button class="round" aria-label="Nuovo deck" onclick={newDeck}><Icon icon={Add01Icon} /></button>
</BackHeader>

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


















  .hint {
    margin: 8px 4px 0;
    font-size: 12px;
    color: var(--muted);
    text-align: center;
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
