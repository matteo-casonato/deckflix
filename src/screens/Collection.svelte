<script>
  // @ts-check
  // "Le mie carte". Without a section: the hub (SPEC Phase 9) with search over all cards and
  // three big tiles — Edizioni, Raccolte, Desideri. With ?tab= (or a ?view= of Edizioni):
  // that section.
  import { liveQuery } from 'dexie';
  import { Search01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { prefetchCards, liveCards } from '../lib/data/catalog.js';
  import { albumCover, ownedTiles } from '../lib/domain/albums.js';
  import { cardImage } from '../lib/api/tcgdex.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Owned from './collection/Owned.svelte';
  import Wishlist from './collection/Wishlist.svelte';
  import Albums from './collection/Albums.svelte';

  /** @type {{ query: Record<string, string> }} */
  let { query } = $props();

  const section = $derived(
    // ?view= without a tab (Home links to Recenti and Statistiche) opens "Tutte le mie carte".
    ['owned', 'all', 'wishlist', 'albums'].includes(query.tab) ? query.tab : query.view ? 'all' : 'hub',
  );

  const entries = liveQuery(() => db.collection.toArray());
  const wishlist = liveQuery(async () => (await db.wishlist.toArray()).sort((a, b) => b.addedAt - a.addedAt));
  const albums = liveQuery(() => db.albums.orderBy('updatedAt').reverse().toArray());

  const copies = $derived(($entries ?? []).reduce((n, e) => n + e.qty, 0));
  const setCount = $derived(new Set(($entries ?? []).map((e) => e.setId)).size);

  // Covers: the most valuable owned cards, the latest wishes, the album covers.
  const ownedIds = $derived([...new Set(($entries ?? []).map((e) => e.cardId))]);
  const albumIds = $derived(($albums ?? []).flatMap((a) => a.cards.map((c) => c.cardId)));
  const wishIds = $derived(($wishlist ?? []).slice(0, 3).map((w) => w.cardId));
  const allIds = $derived([...new Set([...ownedIds, ...albumIds, ...wishIds])].sort());
  const cards = $derived(liveCards(allIds, settings.cardLang));
  $effect(() => {
    if (section === 'hub' && allIds.length) prefetchCards(allIds, settings.cardLang);
  });

  /** @param {(string | null | undefined)[]} ids */
  const images = (ids) =>
    ids
      .map((id) => (id ? cardImage($cards?.get(id)) : null))
      .filter(Boolean)
      .slice(0, 3);

  const ownedCovers = $derived(
    $cards
      ? images(
          ownedTiles($entries ?? [], $cards, settings.conditionFactors)
            .sort((a, b) => b.unit - a.unit)
            .map((t) => t.cardId),
        )
      : [],
  );
  // Edizioni: the most valuable card of the three sets touched last.
  const setCovers = $derived.by(() => {
    if (!$cards || !$entries) return [];
    const bySet = new Map();
    for (const t of ownedTiles($entries, $cards, settings.conditionFactors).sort((a, b) => b.unit - a.unit)) {
      const setId = t.cardId.slice(0, t.cardId.lastIndexOf('-'));
      if (!bySet.has(setId) && $cards.get(t.cardId)?.image) bySet.set(setId, t.cardId);
    }
    const last = new Map();
    for (const e of $entries) last.set(e.setId, Math.max(last.get(e.setId) ?? 0, e.updatedAt));
    return images([...bySet.entries()].sort((a, b) => (last.get(b[0]) ?? 0) - (last.get(a[0]) ?? 0)).map(([, id]) => id));
  });
  const albumCovers = $derived($cards ? images(($albums ?? []).map((a) => albumCover(a, $cards))) : []);
  const wishCovers = $derived($cards ? images(wishIds) : []);

  const TITLES = /** @type {Record<string, string>} */ ({ owned: 'Edizioni', all: 'Tutte le mie carte', wishlist: 'Desideri', albums: 'Raccolte' });
</script>

{#if section === 'hub'}
  <header class="top"><h1>Le mie carte</h1></header>

  <div class="pad">
    <a class="search" href={hrefFor('search')}>
      <Icon icon={Search01Icon} size={20} />
      <span>Cerca tra tutte le carte</span>
    </a>
  </div>

  <nav class="hub" aria-label="Sezioni della collezione">
    <a class="tile big card" href={hrefFor('collection', {}, { tab: 'all' })}>
      <span class="txt">
        <strong>Tutte le mie carte</strong>
        <span class="num">{copies} {copies === 1 ? 'carta' : 'carte'} · recenti e statistiche</span>
      </span>
      {@render fan(ownedCovers)}
    </a>
    <a class="tile big card" href={hrefFor('collection', {}, { tab: 'owned' })}>
      <span class="txt">
        <strong>Edizioni</strong>
        <span class="num">{setCount} {setCount === 1 ? 'edizione' : 'edizioni'}</span>
      </span>
      {@render fan(setCovers.length ? setCovers : ownedCovers)}
    </a>
    <a class="tile card" href={hrefFor('collection', {}, { tab: 'albums' })}>
      <span class="txt">
        <strong>Raccolte</strong>
        <span class="num">{($albums?.length ?? 0) + 7} raccolte</span>
      </span>
      {@render fan(albumCovers.length ? albumCovers : ownedCovers.slice(0, 1))}
    </a>
    <a class="tile card" href={hrefFor('collection', {}, { tab: 'wishlist' })}>
      <span class="txt">
        <strong>Desideri</strong>
        <span class="num">{$wishlist?.length ?? 0} {$wishlist?.length === 1 ? 'carta' : 'carte'}</span>
      </span>
      {@render fan(wishCovers)}
    </a>
  </nav>
{:else}
  <BackHeader title={TITLES[section]} big fallback={hrefFor('collection')} />
  {#if section === 'owned'}
    <Owned {query} {copies} mode="sets" />
  {:else if section === 'all'}
    <Owned {query} {copies} mode="cards" />
  {:else if section === 'albums'}
    <Albums />
  {:else}
    <Wishlist {query} />
  {/if}
{/if}

{#snippet fan(/** @type {(string | null)[]} */ list)}
  <span class="fan" aria-hidden="true">
    {#each list as src, i (src)}
      <img {src} alt="" loading="lazy" style:--i={i} style:--n={list.length} style:z-index={10 - Math.abs(i * 2 - (list.length - 1))} />
    {:else}
      <span class="ph"></span>
    {/each}
  </span>
{/snippet}

<style>
  .top {
    padding: 20px 16px 4px;
  }

  h1 {
    font-size: 28px;
  }

  .pad {
    padding: 12px 16px 0;
  }

  .search {
    min-height: 56px;
    padding: 0 18px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 36px;
    background: var(--surface);
    color: var(--muted);
    text-decoration: none;
  }

  .hub {
    padding: 14px 16px 24px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .tile {
    position: relative;
    min-height: 170px;
    padding: 14px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }

  .tile.big {
    grid-column: 1 / -1;
    min-height: 200px;
    padding: 18px;
  }

  .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 1;
  }

  .txt strong {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 800;
    line-height: 1.15;
  }

  .big .txt strong {
    font-size: 28px;
  }

  .txt span {
    font-size: 12px;
    color: var(--muted);
  }

  .big .txt span {
    font-size: 13px;
  }

  .fan {
    position: relative;
    height: 96px;
    display: block;
  }

  .big .fan {
    height: 128px;
  }

  .fan img,
  .ph {
    position: absolute;
    bottom: -30px;
    left: 50%;
    height: 124px;
    aspect-ratio: 63 / 88;
    border-radius: 9px;
    box-shadow: 0 10px 22px rgb(0 0 0 / 0.45);
    transform: translateX(calc(-50% + (var(--i) - (var(--n) - 1) / 2) * 46%)) rotate(calc((var(--i) - (var(--n) - 1) / 2) * 9deg));
    transform-origin: 50% 100%;
    object-fit: cover;
  }

  .big .fan img {
    bottom: -34px;
    height: 160px;
    transform: translateX(calc(-50% + (var(--i) - (var(--n) - 1) / 2) * 62%)) rotate(calc((var(--i) - (var(--n) - 1) / 2) * 8deg));
  }

  .ph {
    --i: 0;
    --n: 1;
    background: var(--surface-2);
    border: 1.5px dashed var(--line-2);
    box-shadow: none;
  }
</style>
