<script>
  // @ts-check
  // "Deck in evidenza" (docs/mockups/Home.html): the deck touched last, three of its Pokémon
  // fanned out, completion, missing cards with their cost. Without decks: how to start one.
  import { liveQuery } from 'dexie';
  import { db } from '../../lib/db.js';
  import { cardImage } from '../../lib/api/tcgdex.js';
  import { deckRows, missingToWishlist, ownedMap } from '../../lib/data/decks.js';
  import { deckSummary } from '../../lib/domain/deck.js';
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

  // The fan: rule-box Pokémon first (the deck's stars), then the most played.
  const fan = $derived(
    (rows ?? [])
      .filter((r) => r.section === 'Pokémon' && cardImage(r.card))
      .sort((a, b) => Number(/\b(ex|V|VSTAR|VMAX)$/.test(b.card?.name ?? '')) - Number(/\b(ex|V|VSTAR|VMAX)$/.test(a.card?.name ?? '')) || b.qty - a.qty)
      .slice(0, 3)
      .map((r) => cardImage(r.card)),
  );
  // Middle card on top.
  const order = $derived(fan.length === 3 ? [fan[1], fan[0], fan[2]] : fan);

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
    <a class="btn light" href={hrefFor('deck')}>Vai ai deck</a>
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
        <a class="btn" href={hrefFor('deckPrint', { id: $deck.id })}>Foglio torneo</a>
      {/if}
    </div>
  </section>
{/if}

<style>
  .hero {
    position: relative;
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

  .fan {
    position: absolute;
    top: 30px;
    left: 0;
    right: 0;
    height: 170px;
    display: block;
  }

  .fan img {
    position: absolute;
    left: 50%;
    top: 14px;
    width: 104px;
    aspect-ratio: 63 / 88;
    border-radius: 10px;
    object-fit: cover;
    box-shadow: 0 12px 24px rgb(0 0 0 / 0.45);
    transform: translateX(calc(-50% + var(--i) * 57px)) rotate(calc(var(--i) * 12deg));
    transform-origin: 50% 90%;
  }

  .title {
    position: relative;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 28px;
    line-height: 1.1;
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
