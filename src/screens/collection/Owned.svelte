<script>
  // @ts-check
  // "Edizioni": owned cards by set (default), all, recent, statistics.
  import { liveQuery } from 'dexie';
  import { Search01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../../lib/db.js';
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { prefetchCards, setDetails, setsMap, liveCards } from '../../lib/data/catalog.js';
  import { copyPrice, euro, setIdOf, setProgress, variantBadge } from '../../lib/domain/cards.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import { replace } from '../../lib/router.svelte.js';
  import Icon from '../../lib/ui/Icon.svelte';
  import CardTile from '../../lib/ui/CardTile.svelte';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import Stats from './Stats.svelte';

  /** @type {{ query: Record<string, string>, copies: number }} */
  let { query, copies } = $props();

  const view = $derived(['all', 'recent', 'stats'].includes(query.view) ? query.view : 'sets');
  const entries = liveQuery(() => db.collection.toArray());
  const ids = $derived([...new Set(($entries ?? []).map((e) => e.cardId))].sort());
  const cards = $derived(liveCards(ids, settings.cardLang));

  /** @type {Map<string, any>} */
  let sets = $state(new Map());
  $effect(() => {
    setsMap(settings.cardLang).then((m) => (sets = m));
  });
  $effect(() => {
    if (ids.length) prefetchCards(ids, settings.cardLang);
  });

  /** Details of the owned sets: abbreviation (MEW) and serie name. */
  /** @type {Map<string, any>} */
  let details = $state(new Map());
  const ownedSetIds = $derived([...new Set(ids.map(setIdOf))].sort().join(','));
  $effect(() => {
    if (ownedSetIds) setDetails(ownedSetIds.split(','), settings.cardLang).then((m) => (details = m));
  });

  /** @param {import('../../lib/db.js').CollectionEntry} e */
  const price = (e) => copyPrice($cards?.get(e.cardId), e.variant);

  /** One tile per card: total copies, badge only when all copies share a special print. */
  const byCard = $derived.by(() => {
    /** @type {Map<string, { cardId: string, qty: number, variants: Set<string>, value: number, updatedAt: number }>} */
    const map = new Map();
    for (const e of $entries ?? []) {
      const t = map.get(e.cardId) ?? { cardId: e.cardId, qty: 0, variants: new Set(), value: 0, updatedAt: 0 };
      t.qty += e.qty;
      t.variants.add(e.variant);
      t.value += (price(e) ?? 0) * e.qty;
      t.updatedAt = Math.max(t.updatedAt, e.updatedAt);
      map.set(e.cardId, t);
    }
    return [...map.values()];
  });

  const groups = $derived.by(() => {
    /** @type {Map<string, typeof byCard>} */
    const bySet = new Map();
    for (const t of byCard) bySet.set(setIdOf(t.cardId), [...(bySet.get(setIdOf(t.cardId)) ?? []), t]);
    return [...bySet.entries()]
      .map(([setId, tiles]) => {
        const set = details.get(setId) ?? sets.get(setId);
        const official = set?.cardCount?.official ?? 0;
        return {
          setId,
          name: set?.name ?? setId,
          serie: set?.serie?.name ?? '',
          code: set?.abbreviation?.official ?? setId.toUpperCase().slice(0, 4),
          progress: setProgress({ official }, ($entries ?? []).filter((e) => e.setId === setId)),
          value: tiles.reduce((s, t) => s + t.value, 0),
          tiles: [...tiles].sort((a, b) => b.value - a.value),
          updatedAt: Math.max(...tiles.map((t) => t.updatedAt)),
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  });

  const allTiles = $derived(
    view === 'recent'
      ? [...byCard].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 60)
      : [...byCard].sort((a, b) => a.cardId.localeCompare(b.cardId, 'it', { numeric: true })),
  );

  /** @param {typeof byCard[number]} t */
  const tileProps = (t) => {
    const card = $cards?.get(t.cardId);
    const only = t.variants.size === 1 ? [...t.variants][0] : null;
    return {
      name: card?.name ?? t.cardId,
      localId: card?.localId ?? t.cardId.slice(setIdOf(t.cardId).length + 1),
      image: card?.image ?? null,
      qty: t.qty,
      badge: only ? variantBadge(only) : null,
      price: t.value > 0 ? euro(t.value) : null,
      href: hrefFor('card', { lang: settings.cardLang, id: t.cardId }),
    };
  };

  /** @param {string | null} v */
  const setView = (v) => replace(hrefFor('collection', {}, { tab: 'owned', view: v }));
</script>

<div class="pad">
  <a class="search" href={hrefFor('search', {}, { mine: '1' })}>
    <Icon icon={Search01Icon} size={20} />
    <span>{copies === 1 ? 'Cerca nella tua carta' : `Cerca nelle mie ${copies} carte`}</span>
  </a>
  <div class="chips" role="group" aria-label="Vista">
    <button class="chip" aria-pressed={view === 'sets'} onclick={() => setView(null)}>Per edizione</button>
    <button class="chip" aria-pressed={view === 'all'} onclick={() => setView('all')}>Tutte</button>
    <button class="chip" aria-pressed={view === 'recent'} onclick={() => setView('recent')}>Recenti</button>
    <button class="chip" aria-pressed={view === 'stats'} onclick={() => setView('stats')}>Statistiche</button>
  </div>
</div>

{#if $entries && $entries.length === 0}
  <EmptyState title="Nessuna carta ancora" text="Scansiona le tue carte o inseriscile per numero.">
    <a class="btn light" href={hrefFor('scan')}>Scansiona</a>
    <a class="btn" href={hrefFor('quick')}>Inserimento rapido</a>
  </EmptyState>
{:else if view === 'stats'}
  <Stats {query} />
{:else if view === 'sets'}
  <div class="sets">
    {#each groups as g, i (g.setId)}
      <section class="set card">
        <a class="head" href={hrefFor('set', { id: g.setId })}>
          <span class="code">{g.code}</span>
          <span class="name">
            <strong>{g.name}</strong>
            <span class="num">{g.serie ? `${g.serie} · ` : ''}{g.progress.owned}/{g.progress.total || '?'}</span>
          </span>
          <span class="value num">{g.value > 0 ? euro(g.value) : ''}</span>
        </a>
        <span class="progress" aria-label={`${g.progress.percent}% dell'edizione`}>
          <span class="bar"><span style:width="{g.progress.percent}%"></span></span>
          <span class="num pct">{g.progress.percent}%</span>
        </span>
        {#if i === 0}
          <div class="grid3">
            {#each g.tiles.slice(0, 6) as t (t.cardId)}
              <CardTile {...tileProps(t)} />
            {/each}
          </div>
          <a class="btn open" href={hrefFor('set', { id: g.setId })}>Apri l’edizione</a>
        {/if}
      </section>
    {/each}
  </div>
{:else}
  <div class="grid3 loose">
    {#each allTiles as t (t.cardId)}
      <CardTile {...tileProps(t)} />
    {/each}
  </div>
{/if}

<style>
  .pad {
    padding: 12px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    font-size: 15px;
    text-decoration: none;
  }

  .sets {
    padding: 14px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .set {
    padding: 16px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }

  .code {
    width: 44px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 12px;
    background: var(--bg);
    border: 1px solid var(--line-2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
  }

  .name {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }

  .name strong {
    font-size: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name span,
  .pct {
    font-size: 12px;
    color: var(--muted);
  }

  .value {
    font-size: 14px;
    font-weight: 700;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .bar {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: var(--bg);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
  }

  .grid3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 10px;
  }

  .grid3.loose {
    padding: 14px 16px 0;
  }

  .open {
    width: 100%;
  }
</style>
