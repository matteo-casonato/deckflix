<script>
  // @ts-check
  // Wishlist (docs/mockups/Desideri.html): total to complete it, sorting, price and trend.
  // "Per deck" arrives with the decks (Phase 6).
  import { liveQuery } from 'dexie';
  import { Add01Icon, ArrowDownRight01Icon, ArrowUpRight01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../../lib/db.js';
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { cachedCards, prefetchCards, setsMap } from '../../lib/data/catalog.js';
  import { copyPrice, euro, priceTrend, setIdOf } from '../../lib/domain/cards.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import { replace } from '../../lib/router.svelte.js';
  import Icon from '../../lib/ui/Icon.svelte';
  import EmptyState from '../../lib/ui/EmptyState.svelte';

  /** @type {{ query: Record<string, string> }} */
  let { query } = $props();

  const sort = $derived(['recent', 'down'].includes(query.sort) ? query.sort : 'price');
  const items = liveQuery(() => db.wishlist.toArray());
  const ids = $derived(($items ?? []).map((w) => w.cardId).sort());
  const cards = $derived(liveQuery(() => cachedCards(ids, settings.cardLang)));

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

  <section class="list card">
    {#each rows as r (r.cardId)}
      <a class="row" href={hrefFor('card', { lang: settings.cardLang, id: r.cardId })}>
        {#if r.card?.image}
          <img class="thumb" src={`${r.card.image}/low.webp`} alt="" loading="lazy" />
        {:else}
          <span class="thumb"></span>
        {/if}
        <span class="txt">
          <strong>{r.card?.name ?? r.cardId}</strong>
          <span class="muted">{r.subtitle}</span>
        </span>
        <span class="price">
          <span class="num">{r.price != null ? euro(r.price) : r.card ? 'n.d.' : '…'}</span>
          {#if r.trend === 'up'}<span class="up" title="In crescita"><Icon icon={ArrowUpRight01Icon} size={18} label="In crescita" /></span>{/if}
          {#if r.trend === 'down'}<span class="down" title="In calo"><Icon icon={ArrowDownRight01Icon} size={18} label="In calo" /></span>{/if}
        </span>
      </a>
    {:else}
      <p class="muted none">Nessuna carta in calo in questo momento.</p>
    {/each}
  </section>
{/if}

<style>
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

  .list {
    margin: 12px 16px 0;
    padding: 6px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .row {
    min-height: 72px;
    padding: 7px 14px 7px 7px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 30px;
    background: var(--surface-2);
    color: var(--text);
    text-decoration: none;
  }

  .thumb {
    width: 42px;
    aspect-ratio: 63 / 88;
    border-radius: 8px;
    background: var(--line-2);
    object-fit: cover;
    flex-shrink: 0;
  }

  .txt {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .txt strong {
    font-size: 15px;
  }

  .price {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 700;
  }

  .up {
    color: var(--success);
    display: flex;
  }

  .down {
    color: var(--danger);
    display: flex;
  }

  .none {
    padding: 14px;
    text-align: center;
  }
</style>
