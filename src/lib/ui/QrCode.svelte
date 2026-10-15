<script>
  // @ts-check
  // QR code as SVG (dark modules on white, 4-module quiet zone), from src/lib/domain/qr.js.
  // With `logo` (a player photo) the code uses the highest error correction (H) and the
  // picture covers the center: checked to decode with up to 30% of the width covered.
  import { qrMatrix } from '../domain/qr.js';

  /** @type {{ text: string, label: string, size?: number, logo?: string | null }} */
  let { text, label, size = 260, logo = null } = $props();

  const matrix = $derived(qrMatrix(text, logo ? 'H' : 'M'));
  /** Side of the center picture, in modules (24% of the code, white margin included). */
  const hole = $derived(Math.round(matrix.length * 0.24));
  const n = $derived(matrix.length + 8);
  // One path for all dark modules: small and crisp at any size.
  const d = $derived(
    matrix
      .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x + 4} ${y + 4}h1v1h-1z` : '')))
      .join(''),
  );
</script>

<svg class="qr" role="img" aria-label={label} viewBox={`0 0 ${n} ${n}`} width={size} height={size} shape-rendering="crispEdges">
  <rect width={n} height={n} fill="#fff" />
  <path {d} fill="#000" />
  {#if logo}
    {@const x = (n - hole) / 2}
    <rect {x} y={x} width={hole} height={hole} rx={hole * 0.22} fill="#fff" />
    <clipPath id="qr-logo"><rect x={x + 0.6} y={x + 0.6} width={hole - 1.2} height={hole - 1.2} rx={hole * 0.2} /></clipPath>
    <image href={logo} x={x + 0.6} y={x + 0.6} width={hole - 1.2} height={hole - 1.2} clip-path="url(#qr-logo)" preserveAspectRatio="xMidYMid slice" />
  {/if}
</svg>

<style>
  .qr {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 12px;
  }
</style>
