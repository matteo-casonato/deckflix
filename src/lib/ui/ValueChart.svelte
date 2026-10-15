<script>
  // @ts-check
  // Collection value over time: one series, 2px line in the accent with a 10% wash,
  // hairline grid, end dot with a surface ring, value labelled only at the end,
  // crosshair + tooltip on hover/touch, and a table for screen readers.
  import { euro } from '../domain/cards.js';

  /** @type {{ points: { date: string, totalValue: number }[], label: string }} */
  let { points, label } = $props();

  let width = $state(320);
  const height = 170;
  const pad = { top: 16, right: 64, bottom: 24, left: 8 };

  const geom = $derived.by(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.totalValue);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 1) {
      min -= 1;
      max += 1;
    }
    const span = max - min;
    min -= span * 0.1;
    max += span * 0.1;
    const t0 = Date.parse(points[0].date);
    const t1 = Date.parse(points.at(-1)?.date ?? points[0].date);
    const w = Math.max(10, width - pad.left - pad.right);
    const h = height - pad.top - pad.bottom;
    const x = (/** @type {string} */ d) => pad.left + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * w;
    const y = (/** @type {number} */ v) => pad.top + (1 - (v - min) / (max - min)) * h;
    const xy = points.map((p) => [x(p.date), y(p.totalValue)]);
    const line = xy.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join('');
    const area = `${line}L${xy.at(-1)?.[0].toFixed(1)},${pad.top + h}L${xy[0][0].toFixed(1)},${pad.top + h}Z`;
    const grid = [0, 0.5, 1].map((k) => pad.top + k * h);
    const end = xy.at(-1) ?? [0, 0];
    return { xy, line, area, grid, w, h, min, max, end };
  });

  /** @type {number | null} */
  let hover = $state(null);

  /** @param {PointerEvent} e */
  function onMove(e) {
    if (!geom) return;
    const rect = /** @type {SVGElement} */ (e.currentTarget).getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    geom.xy.forEach(([gx], i) => {
      if (Math.abs(gx - px) < Math.abs(geom.xy[best][0] - px)) best = i;
    });
    hover = best;
  }

  const fmtDate = (/** @type {string} */ d) =>
    new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: points.length > 60 ? '2-digit' : undefined });
</script>

<div class="chart" bind:clientWidth={width}>
  {#if !geom}
    <p class="empty">Il grafico si riempie giorno dopo giorno: l’app salva il valore una volta al giorno.</p>
  {:else}
    <svg
      {width}
      {height}
      role="img"
      aria-label={label}
      onpointermove={onMove}
      onpointerdown={onMove}
      onpointerleave={() => (hover = null)}
    >
      {#each geom.grid as gy (gy)}<line class="grid" x1={pad.left} x2={pad.left + geom.w} y1={gy} y2={gy} />{/each}
      <path class="area" d={geom.area} />
      <path class="line" d={geom.line} />
      <circle class="dot" cx={geom.end[0]} cy={geom.end[1]} r="4" />
      <text class="end num" x={geom.end[0] + 10} y={geom.end[1] + 4}>{euro(points.at(-1)?.totalValue)}</text>
      <text class="axis" x={pad.left} y={height - 6}>{fmtDate(points[0].date)}</text>
      <text class="axis" x={pad.left + geom.w} y={height - 6} text-anchor="end">{fmtDate(points.at(-1)?.date ?? '')}</text>
      {#if hover != null}
        {@const [hx, hy] = geom.xy[hover]}
        <line class="cross" x1={hx} x2={hx} y1={pad.top} y2={pad.top + geom.h} />
        <circle class="dot" cx={hx} cy={hy} r="4" />
      {/if}
    </svg>
    {#if hover != null}
      {@const [hx] = geom.xy[hover]}
      <div class="tip" style:left="{Math.min(Math.max(hx, 60), width - 60)}px">
        <span>{fmtDate(points[hover].date)}</span>
        <strong class="num">{euro(points[hover].totalValue)}</strong>
      </div>
    {/if}
    <table class="visually-hidden">
      <caption>{label}</caption>
      <thead><tr><th>Data</th><th>Valore</th></tr></thead>
      <tbody>
        {#each points as p (p.date)}<tr><td>{p.date}</td><td>{euro(p.totalValue)}</td></tr>{/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .chart {
    position: relative;
    width: 100%;
    touch-action: pan-y;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }

  .area {
    fill: var(--accent);
    opacity: 0.1;
  }

  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .dot {
    fill: var(--accent);
    stroke: var(--surface);
    stroke-width: 2;
  }

  .cross {
    stroke: var(--muted);
    stroke-width: 1;
  }

  .end {
    fill: var(--text);
    font-size: 12px;
    font-weight: 700;
  }

  .axis {
    fill: var(--muted);
    font-size: 11px;
  }

  .tip {
    position: absolute;
    top: -6px;
    transform: translateX(-50%);
    padding: 6px 10px;
    border-radius: 12px;
    background: var(--surface-2);
    border: 1px solid var(--line-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 11px;
    color: var(--muted);
    pointer-events: none;
    white-space: nowrap;
  }

  .tip strong {
    color: var(--text);
    font-size: 14px;
  }

  .empty {
    margin: 0;
    padding: 24px 8px;
    text-align: center;
    font-size: 13px;
    color: var(--muted);
  }
</style>
