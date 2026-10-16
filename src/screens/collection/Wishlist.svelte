<script>
  // @ts-check
  // Wishlist (docs/mockups/Desideri.html): total to complete it, sorting, price and trend.
  // "Per deck" arrives with the decks (Phase 6).
  import { liveQuery } from 'dexie';
  import StackRow from '../../lib/ui/StackRow.svelte';
  import { cardImage } from '../../lib/api/tcgdex.js';
  import { Add01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../../lib/db.js';
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { prefetchCards, setsMap, liveCards } from '../../lib/data/catalog.js';
  import { LANG_LABELS, copyPrice, euro, priceTrend, setIdOf } from '../../lib/domain/cards.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import { replace } from '../../lib/router.svelte.js';
  import Icon from '../../lib/ui/Icon.svelte';
  import EmptyState from '../../lib/ui/EmptyState.svelte';

  /** @type {{ query: Record<string, string> }} */
  let { query } = $props();

  const sort = $derived(['recent', 'down'].includes(query.sort) ? query.sort : 'price');
  const items = liveQuery(() => db.wishlist.toArray());
  const ids = $derived(($items ?? []).map((w) => w.cardId).sort());
  const cards = $derived(liveCards(ids, settings.cardLang));

  /** @type {Map<string, any>} */
  let sets = $state(new Map());
  $effect(() => {
    setsMap(settings.cardLang).then((m) => (sets = m));
  });
  $effect(() => {
    if (ids.length) prefetchCards(ids, settings.cardLang);
  });

  const rows = $derived.by(() => {
    const list = ($items ?? []).map((w) => {
      const card = $cards?.get(w.cardId);
      const set = sets.get(setIdOf(w.cardId));
      return {
        ...w,
        card,
        price: copyPrice(card, w.variant ?? 'normal'),
        trend: priceTrend(card),
        subtitle: `${set?.name ?? setIdOf(w.cardId)} · ${card?.localId ?? ''}${set?.cardCount?.official ? `/${set.cardCount.official}` : ''}`,
      };
    });
    if (sort === 'recent') return list.sort((a, b) => b.addedAt - a.addedAt);
    const byPrice = list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    return sort === 'down' ? byPrice.filter((r) => r.trend === 'down') : byPrice;
  });

  const total = $derived(rows.reduce((s, r) => s + (r.price ?? 0), 0));
  const falling = $derived(($items ?? []).filter((w) => priceTrend($cards?.get(w.cardId)) === 'down').length);
  const unpriced = $derived(rows.filter((r) => r.card && r.price == null).length);

  /** @param {string | null} v */
  const setSort = (v) => replace(hrefFor('collection', {}, { tab: 'wishlist', sort: v }));
</script>

{#if $items && $items.length === 0}
  <EmptyState
    title="Nessun desiderio"
    text="Aggiungi le carte che cerchi dalla ricerca, o le mancanti dei tuoi deck con un tocco."
  >
    <a class="btn light" href={hrefFor('search')}>Cerca una carta</a>
  </EmptyState>
{:else if $items}
  <section class="summary card">
    <span class="sum">
      <span class="muted">Per completare la lista</span>
      <strong class="num">{euro(total)}</strong>
      <span class="muted small">
        {falling === 1 ? '1 carta in calo' : `${falling} carte in calo`} (media 7 giorni su 30){unpriced
          ? ` · ${unpriced} senza prezzo`
          : ''}
      </span>
    </span>
    <a class="add" href={hrefFor('search')} aria-label="Aggiungi ai desideri"><Icon icon={Add01Icon} /></a>
  </section>

  <div class="chips pad" role="group" aria-label="Ordina">
    <button class="chip" aria-pressed={sort === 'price'} onclick={() => setSort(null)}>Prezzo ↓</button>
    <button class="chip" aria-pressed={sort === 'recent'} onclick={() => setSort('recent')}>Recenti</button>
    <button class="chip" aria-pressed={sort === 'down'} onclick={() => setSort('down')}>In calo</button>
  </div>

  <ul class="rows">
    {#each rows as r (r.cardId)}
      {@const cm = r.card?.pricing?.cardmarket}
      {@const pct = cm?.avg7 > 0 && cm?.avg30 > 0 ? Math.round((cm.avg7 / cm.avg30 - 1) * 100) : null}
      <li>
        <StackRow
          href={hrefFor('card', { lang: settings.cardLang, id: r.cardId })}
          images={[cardImage(r.card)]}
          title={r.card?.name ?? r.cardId}
          sub={r.subtitle}
          aside={r.price != null ? euro(r.price) : r.card ? 'n.d.' : '…'}
        >
          <!-- For a wish, a falling price is good news. -->
          {#if r.trend === 'down'}<span class="tag ok">In calo{pct != null ? ` ${pct}%` : ''}</span>{/if}
          {#if r.trend === 'up'}<span class="tag bad">In aumento{pct != null ? ` +${pct}%` : ''}</span>{/if}
          {#if r.lang}<span class="tag">{LANG_LABELS[r.lang] ?? r.lang}</span>{/if}
        </StackRow>
      </li>
    {:else}
      <p class="muted none">Nessuna carta in calo in questo momento.</p>
    {/each}
  </ul>
{/if}

<style>
  .rows {
    list-style: none;
    margin: 0;
    padding: 0 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .summary {
    margin: 14px 16px 0;
    padding: 18px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sum {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .sum strong {
    font-family: var(--font-display);
    font-size: 26px;
  }

  .muted {
    color: var(--muted);
    font-size: 13px;
  }

  .small {
    font-size: 12px;
  }

  .add {
    width: 48px;
    height: 48px;
    border-radius: var(--r-card);
    background: var(--text);
    color: var(--on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pad {
    padding: 12px 16px 0;
  }









  .none {
    padding: 14px;
    text-align: center;
  }
</style>
