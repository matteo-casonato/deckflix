<script>
  // @ts-check
  // Price trend of a card. TCGdex has no price history, only Cardmarket averages: the last
  // 30 days, 7 days, 1 day and the trend. They are shown as a short recent trend; below,
  // the app's own daily record of this card (owned or wished cards), which grows day by day.
  import { liveQuery } from 'dexie';
  import { db } from '../../lib/db.js';
  import { euro } from '../../lib/domain/cards.js';
  import ValueChart from '../../lib/ui/ValueChart.svelte';

  /** @type {{ cardId: string, cardmarket: any }} */
  let { cardId, cardmarket } = $props();

  const steps = $derived(
    /** @type {[string, number | null][]} */ ([
      ['30 giorni', cardmarket?.avg30 ?? null],
      ['7 giorni', cardmarket?.avg7 ?? null],
      ['Ieri', cardmarket?.avg1 ?? null],
      ['Trend', cardmarket?.trend ?? null],
    ]).filter(([, v]) => typeof v === 'number' && v > 0),
  );
  const max = $derived(Math.max(...steps.map(([, v]) => /** @type {number} */ (v)), 0.01));
  const change = $derived(cardmarket?.avg30 > 0 && cardmarket?.avg7 > 0 ? (cardmarket.avg7 / cardmarket.avg30 - 1) * 100 : null);

  const history = $derived(liveQuery(() => db.cardPrices.where('cardId').equals(cardId).sortBy('date')));
  const points = $derived(($history ?? []).map((r) => ({ date: r.date, totalValue: r.price })));
</script>

{#if steps.length >= 2}
  <div class="trend">
    <div class="head">
      <span class="muted small">Medie Cardmarket</span>
      {#if change != null}
        <span class="chg num" class:up={change > 5} class:down={change < -5}>
          {change >= 0 ? '+' : '−'}{Math.abs(change).toFixed(0)}% in una settimana
        </span>
      {/if}
    </div>
    <ul class="bars" aria-label="Prezzo medio su Cardmarket negli ultimi 30 giorni, 7 giorni, ieri e trend">
      {#each steps as [label, v] (label)}
        <li>
          <span class="val num">{euro(v)}</span>
          <span class="bar" style:height="{Math.max(6, ((v ?? 0) / max) * 64)}px"></span>
          <span class="lbl">{label}</span>
        </li>
      {/each}
    </ul>
  </div>
{/if}

{#if points.length >= 2}
  <div class="history">
    <span class="muted small">Il tuo storico · un prezzo al giorno</span>
    <ValueChart {points} label="Prezzo della carta giorno per giorno" />
  </div>
{:else}
  <p class="muted small note">Lo storico giorno per giorno si riempie da solo per le carte che hai o desideri.</p>
{/if}

<style>
  .trend {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .muted {
    color: var(--muted);
  }

  .small {
    font-size: 12px;
  }

  .chg {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
  }

  .chg.up {
    color: var(--success);
  }

  .chg.down {
    color: var(--danger);
  }

  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 8px;
    align-items: end;
  }

  .bars li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .val {
    font-size: 12px;
    font-weight: 700;
  }

  .bar {
    width: 100%;
    max-width: 44px;
    border-radius: 6px 6px 2px 2px;
    background: color-mix(in srgb, var(--accent) 70%, var(--surface));
  }

  .bars li:last-child .bar {
    background: var(--accent);
  }

  .lbl {
    font-size: 11px;
    color: var(--muted);
  }

  .history {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .note {
    margin: 4px 0 0;
  }
</style>
