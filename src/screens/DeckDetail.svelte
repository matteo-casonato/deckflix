<script>
  // @ts-check
  // Deck summary (docs/mockups/DeckDettaglio.html): sections, value, completion, every card
  // with its state; edit, share the list, missing cards to the wishlist, delete.
  import { liveQuery } from 'dexie';
  import { db } from '../lib/db.js';
  import { deckRows, deleteDeck, exportDecklist, missingToWishlist, ownedMap } from '../lib/data/decks.js';
  import { deckSummary } from '../lib/domain/deck.js';
  import { euro } from '../lib/domain/cards.js';
  import { listNumber } from '../lib/domain/decklist.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { navigate } from '../lib/router.svelte.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';

  /** @type {{ id: string }} */
  let { id } = $props();

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

  const SECTIONS = /** @type {const} */ ([
    ['Pokémon', 'Pokémon'],
    ['Trainer', 'Allenatori'],
    ['Energy', 'Energie'],
  ]);
  const STATE = { owned: '', other: 'Altra versione', missing: 'Manca' };

  let confirmDelete = $state(false);

  async function share() {
    if (!$deck) return;
    const text = await exportDecklist($deck);
    if (navigator.share) {
      try {
        await navigator.share({ title: $deck.name, text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Lista copiata negli appunti');
    } catch {
      showToast('Non riesco a copiare la lista');
    }
  }

  async function toWishlist() {
    if (!rows) return;
    const n = await missingToWishlist(rows);
    showToast(n ? `${n} ${n === 1 ? 'carta aggiunta' : 'carte aggiunte'} ai desideri` : 'Le mancanti sono già nei desideri');
  }
</script>

<BackHeader title="Deck" fallback={hrefFor('deck')} />

{#if $deck === undefined}
  <p class="pad muted">Carico…</p>
{:else if !$deck}
  <p class="pad muted">Questo deck non esiste più.</p>
{:else}
  <section class="head card">
    <h1>{$deck.name}</h1>
    {#if summary}
      <p class="muted num">{summary.total} carte · valore deck {euro(summary.value)}</p>
      <div class="split num">
        <span><strong>{summary.pokemon}</strong> Pokémon</span>
        <span><strong>{summary.trainer}</strong> Allenatori</span>
        <span><strong>{summary.energy}</strong> Energie</span>
      </div>
      <div class="progress">
        <span class="pct num">{summary.percent}%</span>
        <span class="facts num">
          <span>{summary.owned} di {summary.total} possedute</span>
          {#if summary.otherVersion}<span>{summary.otherVersion} coperte da un’altra versione</span>{/if}
          {#if summary.missing}<span>{summary.missing} mancanti · circa {euro(summary.missingCost)}</span>{/if}
        </span>
      </div>
      {#if summary.total !== 60}
        <p class="warn">Un deck Standard ha 60 carte: questo ne ha {summary.total}.</p>
      {/if}
    {:else}
      <p class="muted">Controllo la collezione…</p>
    {/if}
    <div class="actions">
      <a class="btn light" href={hrefFor('deckEdit', { id })}>Modifica</a>
      <button class="btn" onclick={share} disabled={!$deck.cards.length}>Condividi lista</button>
    </div>
    {#if summary?.missing}
      <button class="btn subtle" onclick={toWishlist}>Mancanti ai desideri</button>
    {/if}
  </section>

  {#if rows}
    {#each SECTIONS as [key, label] (key)}
      {@const group = rows.filter((r) => r.section === key)}
      {#if group.length}
        <h2 class="section">{label} · <span class="num">{group.reduce((n, r) => n + r.qty, 0)}</span></h2>
        <ul class="lines card">
          {#each group as r (r.cardId)}
            <li>
              <a href={hrefFor('card', { lang: 'en', id: r.cardId })}>
                <span class="qty num">{r.qty}</span>
                <span class="name">
                  <strong>{r.card?.name ?? r.cardId}</strong>
                  <span class="muted num">{r.card?.set?.name ?? ''} {r.card ? listNumber(r.card.localId) : ''}</span>
                </span>
                {#if r.state !== 'owned'}
                  <span class="state {r.state}">{STATE[r.state]}{r.state === 'missing' && r.have ? ` ${r.missing}` : ''}</span>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    {/each}
    {#if !rows.length}
      <p class="pad muted">Il deck è vuoto: tocca Modifica per aggiungere carte.</p>
    {/if}
  {/if}

  <div class="pad"><button class="btn danger-text" onclick={() => (confirmDelete = true)}>Elimina il deck</button></div>

  <ConfirmDialog
    open={confirmDelete}
    title="Eliminare il deck?"
    text={`${$deck.name} verrà eliminato. Le carte della collezione non cambiano.`}
    confirmLabel="Elimina"
    danger
    onconfirm={async () => {
      await deleteDeck(id);
      navigate(hrefFor('deck'));
    }}
    onclose={() => (confirmDelete = false)}
  />
{/if}

<style>
  .pad {
    padding: 12px 16px 0;
  }

  .muted {
    color: var(--muted);
    margin: 0;
    font-size: 13px;
  }

  .head {
    margin: 8px 16px 0;
    padding: 18px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h1 {
    font-size: 26px;
  }

  .split {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .split span {
    padding: 10px;
    border-radius: 16px;
    background: var(--bg);
    font-size: 12px;
    color: var(--muted);
    display: flex;
    flex-direction: column;
  }

  .split strong {
    font-family: var(--font-display);
    font-size: 20px;
    color: var(--text);
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .pct {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 30px;
    color: var(--accent);
  }

  .facts {
    display: flex;
    flex-direction: column;
    font-size: 13px;
    color: var(--muted);
  }

  .warn {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .subtle {
    background: transparent;
    border: 1px solid var(--line-2);
  }

  .section {
    margin: 22px 20px 8px;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .lines {
    list-style: none;
    margin: 0 16px;
    padding: 4px;
    border-radius: var(--r-section);
    background: var(--surface);
  }

  .lines a {
    min-height: 56px;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
    border-radius: 24px;
  }

  .qty {
    width: 26px;
    text-align: right;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 17px;
  }

  .name {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .name strong {
    font-size: 15px;
  }

  .state {
    flex-shrink: 0;
    height: 24px;
    padding: 0 9px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
  }

  .state.other {
    background: color-mix(in srgb, var(--accent) 16%, var(--surface));
    color: var(--accent);
  }

  .state.missing {
    background: color-mix(in srgb, var(--danger) 14%, var(--surface));
    color: var(--danger);
  }

  .danger-text {
    width: 100%;
    background: transparent;
    color: var(--danger);
  }
</style>
