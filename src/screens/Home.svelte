<script>
  // @ts-check
  // Home (docs/mockups/Home.html). Phase 3: recent additions; the value card and the
  // featured deck arrive with Phases 7 and 6.
  import { liveQuery } from 'dexie';
  import { db } from '../lib/db.js';
  import { account } from '../lib/stores/account.svelte.js';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { cachedCards, prefetchCards } from '../lib/data/catalog.js';
  import { setIdOf, variantBadge } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import CardTile from '../lib/ui/CardTile.svelte';

  const recent = liveQuery(() => db.collection.orderBy('updatedAt').reverse().limit(9).toArray());
  const ids = $derived([...new Set(($recent ?? []).map((e) => e.cardId))]);
  const cards = $derived(liveQuery(() => cachedCards(ids, settings.cardLang)));
  $effect(() => {
    if (ids.length) prefetchCards(ids, settings.cardLang);
  });
</script>

<header class="top">
  <h1 class="logo">Deck<span>flix</span></h1>
  {#if account.user}<span class="hello">Ciao, {account.user.givenName || account.user.name}</span>{/if}
</header>

{#if $recent && $recent.length === 0}
  <EmptyState title="Nessuna carta ancora" text="Scansiona le tue carte o inseriscile per numero.">
    <a class="btn light" href={hrefFor('scan')}>Scansiona</a>
    <a class="btn" href={hrefFor('quick')}>Inserimento rapido</a>
  </EmptyState>
{:else if $recent}
  <div class="section-head">
    <h2>Aggiunte di recente</h2>
    <a href={hrefFor('collection', {}, { view: 'recent' })}>Vedi tutte</a>
  </div>
  <div class="grid3">
    {#each $recent as e (e.key)}
      {@const card = $cards?.get(e.cardId)}
      <CardTile
        name={card?.name ?? e.cardId}
        localId={card?.localId ?? e.cardId.slice(setIdOf(e.cardId).length + 1)}
        image={card?.image ?? null}
        qty={e.qty}
        badge={variantBadge(e.variant)}
        href={hrefFor('card', { lang: settings.cardLang, id: e.cardId })}
      />
    {/each}
  </div>
  <div class="actions">
    <a class="btn" href={hrefFor('quick')}>Inserimento rapido</a>
    <a class="btn" href={hrefFor('search')}>Cerca una carta</a>
  </div>
{/if}

<style>
  .top {
    padding: 10px 20px 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo {
    font-size: 28px;
    letter-spacing: -0.5px;
  }

  .logo span {
    color: var(--accent);
  }

  .hello {
    font-size: 13px;
    color: var(--muted);
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 22px 20px 10px;
  }

  .section-head h2 {
    font-weight: 600;
    font-size: 19px;
  }

  .section-head a {
    min-height: 48px;
    display: flex;
    align-items: center;
    color: var(--muted);
    font-size: 14px;
  }

  .grid3 {
    padding: 0 16px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 10px;
  }

  .actions {
    padding: 16px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
</style>
