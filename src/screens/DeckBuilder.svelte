<script>
  // @ts-check
  // Deck List Creator (docs/mockups/DeckBuilder.html): grid with owned / other version /
  // missing, warning about other versions, missing cards to the wishlist, count out of 60.
  import { liveQuery } from 'dexie';
  import { Add01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { changeDeckCard, deckRows, missingToWishlist, ownedMap, resolveDecklist, updateDeck } from '../lib/data/decks.js';
  import { pasteErrorText, readListFromClipboard } from '../lib/data/pasteList.js';
  import { parseDecklist, suggestDeckName } from '../lib/domain/decklist.js';
  import { DECK_SIZE, MAX_COPIES, deckSummary } from '../lib/domain/deck.js';
  import { euro } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { replace } from '../lib/router.svelte.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import Segmented from '../lib/ui/Segmented.svelte';
  import Icon from '../lib/ui/Icon.svelte';

  /** @type {{ id: string, query: Record<string, string> }} */
  let { id, query } = $props();

  const deck = $derived(liveQuery(() => db.decks.get(id)));
  const owned = liveQuery(ownedMap);

  /** @type {import('../lib/data/decks.js').DeckRow[] | null} */
  let rows = $state(null);
  $effect(() => {
    const d = $deck;
    const own = $owned;
    if (d && own) deckRows(d, own).then((r) => (rows = r));
  });
  const summary = $derived(rows ? deckSummary(rows) : null);
  const tab = $derived(['Trainer', 'Energy'].includes(query.tab) ? query.tab : 'Pokémon');
  const shown = $derived((rows ?? []).filter((r) => r.section === tab));
  const others = $derived((rows ?? []).filter((r) => r.state === 'other'));
  let showOthers = $state(false);

  // Empty deck: fill it from a list copied from Limitless or Pokémon TCG Live.
  let pasting = $state(false);
  async function pasteList() {
    const r = await readListFromClipboard();
    if ('error' in r) return showToast(pasteErrorText(r.error));
    pasting = true;
    try {
      const res = await resolveDecklist(r.text, () => {});
      const patch = { cards: res.cards.map((c) => ({ cardId: c.cardId, qty: c.qty })) };
      if (!name.trim() || name === 'Nuovo deck') name = suggestDeckName(parseDecklist(r.text).lines) || name;
      await updateDeck(id, { ...patch, name: name.trim() || 'Nuovo deck' });
      const n = res.cards.reduce((s, c) => s + c.qty, 0);
      showToast(res.unresolved.length ? `${n} carte importate · ${res.unresolved.length} righe non trovate` : `${n} carte importate`);
    } finally {
      pasting = false;
    }
  }

  /** @type {string} */
  let name = $state('');
  $effect(() => {
    if ($deck && !name) name = $deck.name;
  });

  /** Basic Energy cards are exempt from the 4-copies rule. */
  /** @param {import('../lib/data/decks.js').DeckRow} r */
  const isBasicEnergy = (r) => r.section === 'Energy' && /basic|base/i.test(`${r.card?.energyType ?? ''} ${r.card?.name ?? ''}`) && r.card?.energyType !== 'Special';

  async function toWishlist() {
    if (!rows) return;
    const n = await missingToWishlist(rows);
    showToast(n ? `${n} ${n === 1 ? 'carta aggiunta' : 'carte aggiunte'} ai desideri` : 'Le mancanti sono già nei desideri');
  }

  const STATE_LABEL = { owned: 'Posseduta', other: 'Altra versione', missing: 'Mancante' };
</script>

<BackHeader fallback={hrefFor('deckDetail', { id })}>
  <a class="round add" href={hrefFor('search', {}, { deck: id })} aria-label="Aggiungi carte al deck"><Icon icon={Add01Icon} /></a>
</BackHeader>

{#if $deck}
  <div class="pad">
    <label class="visually-hidden" for="deck-name">Nome del deck</label>
    <input
      id="deck-name"
      class="name"
      bind:value={name}
      onchange={() => updateDeck(id, { name: name.trim() || 'Nuovo deck' })}
      onblur={() => updateDeck(id, { name: name.trim() || 'Nuovo deck' })}
    />

    {#if $deck.cards.length === 0}
      <section class="paste card">
        <strong>Hai una lista pronta?</strong>
        <span class="muted">Copiala su Limitless con “Copy to Clipboard” (o da Pokémon TCG Live) e incollala qui.</span>
        <button class="btn primary" disabled={pasting} onclick={pasteList}>{pasting ? 'Cerco le carte…' : 'Incolla lista'}</button>
      </section>
    {/if}

    {#if others.length}
      <div class="notice">
        <span>
          <strong>{others.reduce((n, r) => n + r.qty, 0)} carte: hai un’altra versione</strong>
          <span class="muted">Stesso nome ed effetto, puoi giocarle comunque</span>
        </span>
        <button class="btn small" onclick={() => (showOthers = !showOthers)}>{showOthers ? 'Nascondi' : 'Vedi'}</button>
      </div>
      {#if showOthers}
        <ul class="others">
          {#each others as r (r.cardId)}<li>×{r.qty} {r.card?.name} · ne hai {r.equivalent} in un’altra stampa</li>{/each}
        </ul>
      {/if}
    {/if}

    <Segmented
      label="Sezione"
      value={tab}
      options={[
        { value: 'Pokémon', label: `Pokémon ${summary?.pokemon ?? 0}` },
        { value: 'Trainer', label: `Allenatori ${summary?.trainer ?? 0}` },
        { value: 'Energy', label: `Energie ${summary?.energy ?? 0}` },
      ]}
      onchange={(v) => replace(hrefFor('deckEdit', { id }, { tab: v === 'Pokémon' ? null : v }))}
    />

    <div class="legend" aria-hidden="true">
      <span><i class="dot owned"></i>Posseduta</span>
      <span><i class="dot other"></i>Altra versione</span>
      <span><i class="dot missing"></i>Mancante</span>
    </div>
  </div>

  {#if !rows}
    <p class="pad muted">Controllo la collezione…</p>
  {:else if shown.length === 0}
    <section class="empty card">
      <p>Nessuna carta in questa sezione.</p>
      <a class="btn" href={hrefFor('search', {}, { deck: id })}>Aggiungi carte</a>
    </section>
  {:else}
    <div class="grid">
      {#each shown as r (r.cardId)}
        <div class="tile {r.state}">
          <a class="art" href={hrefFor('card', { lang: 'en', id: r.cardId })} aria-label={`${r.card?.name}, ${STATE_LABEL[r.state]}`}>
            {#if r.card?.image}
              <img src={`${r.card.image}/low.webp`} alt="" loading="lazy" />
            {:else}
              <span class="ph">{r.card?.name ?? r.cardId}</span>
            {/if}
            <span class="qty num">×{r.qty}</span>
            {#if r.state !== 'owned'}<span class="badge {r.state}">{r.state === 'other' ? 'Altra versione' : `Manca ${r.missing}`}</span>{/if}
          </a>
          <span class="cname">{r.card?.name ?? ''}</span>
          <span class="steps">
            <button aria-label={`Togli una copia di ${r.card?.name}`} onclick={() => changeDeckCard(id, r.cardId, -1)}>−</button>
            <button
              aria-label={`Aggiungi una copia di ${r.card?.name}`}
              disabled={r.qty >= MAX_COPIES && !isBasicEnergy(r)}
              onclick={() => changeDeckCard(id, r.cardId, 1)}>+</button
            >
          </span>
        </div>
      {/each}
    </div>
  {/if}

  {#if summary}
    <section class="footer card">
      <span class="txt">
        <strong class="num" class:over={summary.total > DECK_SIZE}>{summary.total}/{DECK_SIZE} carte</strong>
        <span class="muted num">
          {summary.missing ? `${summary.missing} mancanti · circa ${euro(summary.missingCost)} su Cardmarket` : 'Hai tutte le carte'}
        </span>
      </span>
      {#if summary.missing}<button class="btn primary" onclick={toWishlist}>Ai desideri</button>{/if}
    </section>
  {/if}
{/if}

<style>
  .paste {
    padding: 16px;
    border-radius: var(--r-card);
    background: var(--surface);
    border: 1px dashed var(--line-2);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pad {
    padding: 8px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .muted {
    color: var(--muted);
    font-size: 13px;
    margin: 0;
  }

  .round {
    width: 48px;
    height: 48px;
    border-radius: var(--r-card);
    background: var(--text);
    color: var(--on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .name {
    min-height: 52px;
    padding: 0 4px;
    border: 0;
    border-bottom: 1px solid var(--line-2);
    background: transparent;
    color: var(--text);
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 800;
  }

  .notice {
    padding: 12px 12px 12px 16px;
    border-radius: var(--r-control);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .notice > span {
    flex: 1;
    display: flex;
    flex-direction: column;
    font-size: 14px;
  }

  .btn.small {
    min-height: 44px;
    padding: 0 14px;
    font-size: 13px;
  }

  .others {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    color: var(--muted);
  }

  .legend {
    display: flex;
    gap: 14px;
    font-size: 12px;
    color: var(--muted);
  }

  .legend span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    display: inline-block;
  }

  .dot.owned {
    background: var(--line-2);
  }

  .dot.other {
    background: var(--accent);
  }

  .dot.missing {
    border: 1.5px dashed var(--muted);
  }

  .grid {
    padding: 14px 16px 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px 10px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .art {
    position: relative;
    aspect-ratio: 63 / 88;
    border-radius: 10px;
    background: var(--surface-2);
    overflow: hidden;
    display: block;
  }

  .tile.missing .art {
    outline: 1.5px dashed var(--muted);
    outline-offset: -1.5px;
  }

  .tile.missing img {
    filter: grayscale(1);
    opacity: 0.4;
  }

  .tile.other .art {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .ph {
    position: absolute;
    inset: 0;
    padding: 6px;
    font-size: 11px;
    color: var(--muted);
  }

  .qty {
    position: absolute;
    top: 5px;
    right: 5px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
  }

  .badge {
    position: absolute;
    left: 4px;
    right: 4px;
    bottom: 4px;
    min-height: 18px;
    padding: 1px 4px;
    border-radius: 8px;
    background: var(--bg);
    font-size: 9px;
    font-weight: 700;
    text-align: center;
  }

  .badge.other {
    color: var(--accent);
  }

  .badge.missing {
    color: var(--danger);
  }

  .cname {
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .steps {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .steps button {
    min-height: 40px;
    border: 0;
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    position: relative;
  }

  .steps button::after {
    content: '';
    position: absolute;
    inset: -4px 0;
  }

  .steps button:disabled {
    opacity: 0.35;
  }

  .empty {
    margin: 16px;
    padding: 20px;
    border-radius: var(--r-section);
    background: var(--surface);
    text-align: center;
    color: var(--muted);
  }

  .footer {
    position: sticky;
    bottom: calc(var(--nav-height) + var(--nav-gap) * 2 + var(--safe-bottom));
    margin: 16px 16px 0;
    padding: 12px 12px 12px 18px;
    border-radius: var(--r-card);
    background: var(--surface-2);
    border: 1px solid var(--line-2);
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.4);
  }

  .footer .txt {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .footer strong {
    font-size: 16px;
  }

  .over {
    color: var(--danger);
  }
</style>
