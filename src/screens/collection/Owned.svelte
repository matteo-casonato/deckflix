<script>
  // @ts-check
  // "Edizioni": owned cards by set (default), all, recent, statistics.
  import { liveQuery } from 'dexie';
  import { Search01Icon } from '@hugeicons/core-free-icons';
  import { db } from '../../lib/db.js';
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { prefetchCards, setDetails, setsMap, liveCards } from '../../lib/data/catalog.js';
  import { euro, printBadge, setIdOf, setProgress } from '../../lib/domain/cards.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import { replace } from '../../lib/router.svelte.js';
  import Icon from '../../lib/ui/Icon.svelte';
  import CardTile from '../../lib/ui/CardTile.svelte';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import Stats from './Stats.svelte';
  import { entryPrice } from '../../lib/domain/value.js';
  import StackRow from '../../lib/ui/StackRow.svelte';
  import { stackIds } from '../../lib/domain/albums.js';
  import { cardImage } from '../../lib/api/tcgdex.js';
  import { setLogoUrl } from '../../lib/domain/setSymbols.js';

  /** @type {{ query: Record<string, string>, copies: number, mode: 'sets' | 'cards' }} */
  let { query, copies, mode } = $props();

  // Edizioni: only the set list. "Tutte le mie carte": all, recent, statistics.
  const view = $derived(mode === 'sets' ? 'sets' : ['recent', 'stats'].includes(query.view) ? query.view : 'all');
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
  const price = (e) => entryPrice($cards?.get(e.cardId), e, settings.conditionFactors);

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

  /** Position of each set in TCGdex's list, which goes from the oldest to the newest. */
  const setOrder = $derived(new Map([...sets.keys()].map((id, i) => [id, i])));

  // Newest set first: release date when known, else TCGdex's order.
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
          logo: setLogoUrl(setId, set?.logo),
          serie: set?.serie?.name ?? '',
          code: set?.abbreviation?.official ?? setId.toUpperCase().slice(0, 4),
          progress: setProgress({ official }, ($entries ?? []).filter((e) => e.setId === setId)),
          value: tiles.reduce((s, t) => s + t.value, 0),
          tiles: [...tiles].sort((a, b) => b.value - a.value),
          updatedAt: Math.max(...tiles.map((t) => t.updatedAt)),
          released: set?.releaseDate ?? '',
          order: setOrder.get(setId) ?? -1,
        };
      })
      .sort((a, b) => (a.released && b.released ? b.released.localeCompare(a.released) : 0) || b.order - a.order || a.name.localeCompare(b.name));
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
      badge: only ? printBadge(card, only) : null,
      price: t.value > 0 ? euro(t.value) : null,
      href: hrefFor('card', { lang: settings.cardLang, id: t.cardId }),
    };
  };

  /** @param {string | null} v */
  const setView = (v) => replace(hrefFor('collection', {}, { tab: 'all', view: v }));
</script>

<div class="pad">
  <a class="search" href={hrefFor('search', {}, { mine: '1' })}>
    <Icon icon={Search01Icon} size={20} />
    <span>{copies === 1 ? 'Cerca nella tua carta' : `Cerca nelle mie ${copies} carte`}</span>
  </a>
  {#if mode === 'cards'}
    <div class="chips" role="group" aria-label="Vista">
      <button class="chip" aria-pressed={view === 'all'} onclick={() => setView(null)}>Tutte</button>
      <button class="chip" aria-pressed={view === 'recent'} onclick={() => setView('recent')}>Recenti</button>
      <button class="chip" aria-pressed={view === 'stats'} onclick={() => setView('stats')}>Statistiche</button>
    </div>
  {/if}
</div>

{#if $entries && $entries.length === 0}
  <EmptyState title="Nessuna carta ancora" text="Scansiona le tue carte o inseriscile per numero.">
    <a class="btn light" href={hrefFor('scan')}>Scansiona</a>
    <a class="btn" href={hrefFor('quick')}>Inserimento rapido</a>
  </EmptyState>
{:else if view === 'stats'}
  <Stats {query} />
{:else if view === 'sets'}
  <ul class="sets">
    {#each groups as g (g.setId)}
      <li>
        <StackRow
          href={hrefFor('set', { id: g.setId })}
          images={stackIds(g.tiles.map((t) => t.cardId), settings.covers[`set:${g.setId}`], (cid) => !!$cards?.get(cid)?.image).map((cid) =>
            cardImage($cards?.get(cid)),
          )}
          title={g.name}
          logo={g.logo}
          sub={`${g.serie ? `${g.serie} · ` : ''}${g.progress.owned}/${g.progress.total || '?'}${g.value > 0 ? ` · ${euro(g.value)}` : ''}`}
          percent={g.progress.percent}
          done={g.progress.percent >= 100}
          label={`${g.name}, ${g.progress.owned} di ${g.progress.total || '?'}, ${g.progress.percent}%`}
        >
          <span class="tag accent">{g.code}</span>
          {#if g.progress.duplicates}<span class="tag">{g.progress.duplicates} doppioni</span>{/if}
        </StackRow>
      </li>
    {/each}
  </ul>
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
    list-style: none;
    margin: 14px 0 24px;
    padding: 0 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .grid3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 10px;
  }

  .grid3.loose {
    padding: 14px 16px 0;
  }

</style>
