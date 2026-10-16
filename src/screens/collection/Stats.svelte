<script>
  // @ts-check
  // Statistics (docs/mockups/Statistiche.html): value and change over a period, chart,
  // key numbers, most valuable, rising, by rarity and language.
  import { liveQuery } from 'dexie';
  import { db } from '../../lib/db.js';
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { recordTodaySnapshot, valuedCollection } from '../../lib/data/value.js';
  import { setsMap } from '../../lib/data/catalog.js';
  import { PERIODS, collectionStats, periodChange } from '../../lib/domain/value.js';
  import { LANG_LABELS, euro, pricesDate, printBadge, setIdOf } from '../../lib/domain/cards.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import { replace } from '../../lib/router.svelte.js';
  import ValueChart from '../../lib/ui/ValueChart.svelte';

  /** @type {{ query: Record<string, string> }} */
  let { query } = $props();

  const period = $derived(PERIODS.find(([k]) => k === query.period) ?? PERIODS[1]);
  const snapshots = liveQuery(() => db.priceSnapshots.toArray());
  const change = $derived(periodChange($snapshots ?? [], period[2], Date.now()));

  /** @type {Awaited<ReturnType<typeof valuedCollection>> | null} */
  let data = $state(null);
  const entriesVersion = liveQuery(async () => (await db.collection.toArray()).reduce((s, e) => s + e.qty * 31 + e.updatedAt, 0));
  $effect(() => {
    void $entriesVersion;
    valuedCollection({ refresh: true }).then((d) => {
      data = d;
      recordTodaySnapshot();
    });
  });
  const stats = $derived(data ? collectionStats(data.entries, data.cards, settings.conditionFactors) : null);

  /** @type {Map<string, any>} */
  let sets = $state(new Map());
  $effect(() => {
    setsMap(settings.cardLang).then((m) => (sets = m));
  });

  // Freshness of the prices shown (SPEC § 4.3): the oldest update among the cards.
  const prices = $derived.by(() => {
    if (!data) return null;
    const dates = [...data.cards.values()].map((c) => c.pricing?.cardmarket?.updated).filter(Boolean).sort();
    return pricesDate(dates[0], Date.now());
  });

  /** @param {string} cardId */
  const sub = (cardId) => {
    const card = data?.cards.get(cardId);
    const set = sets.get(setIdOf(cardId));
    return `${set?.name ?? setIdOf(cardId)} · ${card?.localId ?? ''}${set?.cardCount?.official ? `/${set.cardCount.official}` : ''}`;
  };

  const maxOf = (/** @type {[string, number][]} */ list) => Math.max(1, ...list.map(([, n]) => n));
</script>

{#if data && stats}
  <section class="hero card">
    <span class="muted">Valore della collezione</span>
    <strong class="value num">{euro(data.value.total)}</strong>
    {#if change.delta != null}
      <span class="delta num" class:up={change.delta > 0} class:down={change.delta < 0}>
        {change.delta >= 0 ? '+' : '−'}{euro(Math.abs(change.delta))}{change.pct != null
          ? ` · ${change.pct >= 0 ? '+' : '−'}${Math.abs(change.pct).toFixed(1).replace('.', ',')}%`
          : ''} in {period[1] === 'Tutto' ? 'tutto il periodo' : period[1].replace(' g', ' giorni')}
      </span>
    {/if}
    <span class="small muted">
      {prices ? prices.label : ''}{prices?.old ? ' · alcuni prezzi hanno più di 3 giorni' : ''}{data.value.unpriced
        ? ` · ${data.value.unpriced} ${data.value.unpriced === 1 ? 'copia senza prezzo' : 'copie senza prezzo'}, non contate`
        : ''}{data.value.missingData ? ` · ${data.value.missingData} da scaricare` : ''}
    </span>

    <div class="chips" role="group" aria-label="Periodo">
      {#each PERIODS as [key, label] (key)}
        <button class="chip" aria-pressed={period[0] === key} onclick={() => replace(hrefFor('collection', {}, { tab: 'all', view: 'stats', period: key === '30' ? null : key }))}>
          {label}
        </button>
      {/each}
    </div>
    <ValueChart points={change.points} label={`Valore della collezione negli ultimi ${period[1]}`} />
  </section>

  <section class="numbers">
    <span><strong class="num">{stats.copies}</strong> carte</span>
    <span><strong class="num">{stats.unique}</strong> uniche</span>
    <span><strong class="num">{stats.sets}</strong> edizioni</span>
    <span><strong class="num">{stats.duplicates}</strong> doppioni</span>
    <span><strong class="num">{stats.special}</strong> stampe speciali</span>
    <span><strong class="num">{stats.reverse}</strong> reverse</span>
  </section>

  {#if stats.mostValuable.length}
    <h2 class="section">Le più preziose</h2>
    <ol class="list card">
      {#each stats.mostValuable as t, i (t.cardId)}
        <li>
          <a href={hrefFor('card', { lang: settings.cardLang, id: t.cardId })}>
            <span class="rank num">{i + 1}</span>
            <span class="txt">
              <strong>{data.cards.get(t.cardId)?.name ?? t.cardId}</strong>
              <span class="muted num">{sub(t.cardId)}{printBadge(data.cards.get(t.cardId), t.variant) ? ` · ${printBadge(data.cards.get(t.cardId), t.variant)}` : ''}{t.qty > 1 ? ` · ×${t.qty}` : ''}</span>
            </span>
            <span class="price num">{euro(t.unit)}</span>
          </a>
        </li>
      {/each}
    </ol>
  {/if}

  {#if stats.rising.length}
    <h2 class="section">In crescita</h2>
    <ul class="list card">
      {#each stats.rising as t (t.cardId)}
        <li>
          <a href={hrefFor('card', { lang: settings.cardLang, id: t.cardId })}>
            <span class="txt">
              <strong>{data.cards.get(t.cardId)?.name ?? t.cardId}</strong>
              <span class="muted num">{sub(t.cardId)}</span>
            </span>
            <span class="price num">{euro(t.unit)} <span class="up">+{Math.round(t.pct ?? 0)}%</span></span>
          </a>
        </li>
      {/each}
    </ul>
    <p class="note">Media degli ultimi 7 giorni rispetto agli ultimi 30 su Cardmarket.</p>
  {/if}

  <h2 class="section">Per rarità</h2>
  <ul class="bars card">
    {#each stats.byRarity as [name, n] (name)}
      <li>
        <span class="bl">{name}</span>
        <span class="track"><span class="bar" style:width="{(n / maxOf(stats.byRarity)) * 100}%"></span></span>
        <span class="bn num">{n}</span>
      </li>
    {/each}
  </ul>

  <h2 class="section">Per lingua</h2>
  <ul class="bars card">
    {#each stats.byLang as [code, n] (code)}
      <li>
        <span class="bl">{LANG_LABELS[code] ?? code}</span>
        <span class="track"><span class="bar" style:width="{(n / maxOf(stats.byLang)) * 100}%"></span></span>
        <span class="bn num">{n}</span>
      </li>
    {/each}
  </ul>
{:else}
  <p class="loading muted" aria-busy="true">Calcolo il valore con i prezzi Cardmarket…</p>
{/if}

<style>
  .hero {
    margin: 14px 16px 0;
    padding: 18px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .muted {
    color: var(--muted);
    font-size: 13px;
  }

  .small {
    font-size: 12px;
  }

  .value {
    font-family: var(--font-display);
    font-size: 34px;
    font-weight: 800;
  }

  .delta {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }

  .delta.up,
  .up {
    color: var(--success);
  }

  .delta.down {
    color: var(--danger);
  }

  .hero .chips {
    margin: 8px 0 4px;
  }

  .numbers {
    margin: 12px 16px 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .numbers span {
    padding: 12px;
    border-radius: 20px;
    background: var(--surface);
    font-size: 12px;
    color: var(--muted);
    display: flex;
    flex-direction: column;
  }

  .numbers strong {
    font-family: var(--font-display);
    font-size: 20px;
    color: var(--text);
  }

  .section {
    margin: 22px 20px 8px;
    font-size: 17px;
    font-weight: 700;
  }

  .list {
    list-style: none;
    margin: 0 16px;
    padding: 4px;
    border-radius: var(--r-section);
    background: var(--surface);
  }

  .list a {
    min-height: 60px;
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }

  .rank {
    width: 22px;
    font-family: var(--font-display);
    font-weight: 800;
    color: var(--muted);
  }

  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .txt strong {
    font-size: 15px;
  }

  .price {
    font-weight: 700;
    white-space: nowrap;
  }

  .note {
    margin: 6px 20px 0;
    font-size: 12px;
    color: var(--muted);
  }

  .bars {
    list-style: none;
    margin: 0 16px;
    padding: 12px 16px;
    border-radius: var(--r-section);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bars li {
    display: grid;
    grid-template-columns: minmax(90px, 40%) 1fr auto;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .bl {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track {
    height: 10px;
  }

  .bar {
    display: block;
    height: 10px;
    min-width: 4px;
    background: var(--accent);
    border-radius: 0 4px 4px 0;
  }

  .bn {
    min-width: 28px;
    text-align: right;
    color: var(--text);
    font-weight: 700;
  }

  .loading {
    padding: 24px 20px;
    text-align: center;
  }
</style>
