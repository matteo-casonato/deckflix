<script>
  // @ts-check
  // "Deck in evidenza" (docs/mockups/Home.html): the deck touched last, three of its Pokémon
  // fanned out, completion, missing cards with their cost. Without decks: how to start one.
  import { liveQuery } from 'dexie';
  import { db } from '../../lib/db.js';
  import { cardImage } from '../../lib/api/tcgdex.js';
  import { deckRows, missingToWishlist, ownedMap } from '../../lib/data/decks.js';
  import { coverCards, deckSummary } from '../../lib/domain/deck.js';
  import { euro } from '../../lib/domain/cards.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import { showToast } from '../../lib/stores/toast.svelte.js';

  const deck = liveQuery(() => db.decks.orderBy('updatedAt').last());
  const owned = liveQuery(ownedMap);

  /** @type {import('../../lib/data/decks.js').DeckRow[] | null} */
  let rows = $state(null);
  $effect(() => {
    const d = $deck;
    const own = $owned;
    if (d && own) deckRows(d, own).then((r) => (rows = r));
  });
  const summary = $derived(rows ? deckSummary(rows) : null);

  // The fan: the cover card in the middle, on top (long press in the deck, or automatic).
  const fanIds = $derived(rows && $deck ? coverCards(rows, $deck.cover, (r) => !!cardImage(r.card)) : []);
  const img = (/** @type {string} */ cid) => /** @type {string} */ (cardImage(rows?.find((r) => r.cardId === cid)?.card));
  const order = $derived(fanIds.length === 3 ? [img(fanIds[1]), img(fanIds[0]), img(fanIds[2])] : fanIds.map(img));

  async function toWishlist() {
    if (!rows) return;
    const n = await missingToWishlist(rows);
    showToast(n ? `${n} ${n === 1 ? 'carta aggiunta' : 'carte aggiunte'} ai desideri` : 'Le mancanti sono già nei desideri');
  }
</script>

{#if $deck === undefined && $owned}
  <section class="hero card empty">
    <span class="tag">Deck</span>
    <strong class="title">Crea il tuo primo deck</strong>
    <span class="sub">Copia una lista su Limitless con “Copy to Clipboard” e incollala, oppure parti da zero.</span>
    <a class="btn light" href={hrefFor('deck', {}, { tab: 'decks' })}>Vai ai deck</a>
  </section>
{:else if $deck}
  <section class="hero card">
    <span class="tag">Deck in evidenza</span>
    <a class="fan" href={hrefFor('deckDetail', { id: $deck.id })} aria-hidden="true" tabindex="-1">
      {#each order as src, i (src)}
        <img {src} alt="" loading="lazy" style:--i={order.length === 3 ? i - 1 : i - (order.length - 1) / 2} style:z-index={order.length === 3 && i === 1 ? 3 : 1} />
      {/each}
    </a>
    <strong class="title">{$deck.name}</strong>
    <span class="sub num">
      {#if summary}
        Standard · {summary.total} carte · {summary.percent}% posseduto
      {:else}
        Controllo la collezione…
      {/if}
    </span>
    <div class="actions">
      <a class="btn light" href={hrefFor('deckDetail', { id: $deck.id })}>Apri deck</a>
      {#if summary?.missing}
        <button class="btn" onclick={toWishlist}>
          <span class="num">{summary.missing} mancanti{summary.missingCost ? ` · ~${euro(summary.missingCost)}` : ''}</span>
        </button>
      {:else if summary}
        <a class="btn" href={hrefFor('deckPrint', { id: $deck.id })}>Stampa</a>
      {/if}
    </div>
  </section>
{/if}

<style>
  .hero {
    position: relative;
    isolation: isolate;
    margin: 14px 16px 0;
    padding: 20px;
    min-height: 330px;
    border-radius: var(--r-section);
    background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--accent) 14%, var(--surface)) 0%, var(--surface) 60%);
    border: 1px solid var(--line);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    text-align: center;
    gap: 4px;
  }

  .hero.empty {
    min-height: 0;
    padding-top: 56px;
    gap: 8px;
  }

  .tag {
    position: absolute;
    top: 16px;
    left: 16px;
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

  /* The cards sit behind the text (z-index 0); a dark fade at the bottom keeps the name,
     the details and the buttons readable on top of them (z-index 1). */
  .fan {
    position: absolute;
    inset: 30px 0 0;
    z-index: 0;
    display: block;
  }

  .fan::after {
    content: '';
    position: absolute;
    inset: 40% 0 0;
    z-index: 5;
    background: linear-gradient(to bottom, transparent, var(--surface) 72%);
    pointer-events: none;
  }

  .tag,
  .title,
  .sub,
  .actions {
    z-index: 1;
  }

  .fan img {
    position: absolute;
    left: 50%;
    top: 14px;
    width: 104px;
    aspect-ratio: 63 / 88;
    border-radius: var(--r-cardimg);
    object-fit: cover;
    box-shadow: 0 12px 24px rgb(0 0 0 / 0.45);
    transform: translateX(calc(-50% + var(--i) * 57px)) rotate(calc(var(--i) * 12deg));
    transform-origin: 50% 90%;
  }

  .title {
    position: relative;
    max-width: 100%;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 26px;
    line-height: 1.15;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .sub {
    position: relative;
    font-size: 13px;
    color: var(--muted);
  }

  .actions {
    position: relative;
    width: 100%;
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .actions > :only-child {
    grid-column: 1 / -1;
  }

  .empty .btn {
    margin-top: 6px;
  }
</style>
