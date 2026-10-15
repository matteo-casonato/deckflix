<script>
  // @ts-check
  // Tiny value trend for the Home card: one line in the accent with a soft area, end dot.
  // Decorative (the value and change are written next to it), so hidden from screen readers.
  /** @type {{ points: { totalValue: number }[], width?: number, height?: number }} */
  let { points, width = 120, height = 44 } = $props();

  const geom = $derived.by(() => {
    if (points.length < 2) return null;
    const v = points.map((p) => p.totalValue);
    let min = Math.min(...v);
    let max = Math.max(...v);
    if (max - min < 0.01) {
      min -= 1;
      max += 1;
    }
    const pad = 4;
    const xy = v.map((y, i) => [pad + (i / (v.length - 1)) * (width - pad * 2), pad + (1 - (y - min) / (max - min)) * (height - pad * 2)]);
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
    const end = xy[xy.length - 1];
    return { line, area: `${line}L${end[0].toFixed(1)},${height}L${xy[0][0].toFixed(1)},${height}Z`, end };
  });
</script>

{#if geom}
  <svg {width} {height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    <path class="area" d={geom.area} />
    <path class="line" d={geom.line} />
    <circle class="dot" cx={geom.end[0]} cy={geom.end[1]} r="3.5" />
  </svg>
{/if}

<style>
  svg {
    display: block;
    overflow: visible;
  }

  .area {
    fill: var(--accent);
    opacity: 0.12;
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
</style>
