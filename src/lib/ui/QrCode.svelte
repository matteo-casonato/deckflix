<script>
  // @ts-check
  // QR code as SVG (dark modules on white, 4-module quiet zone), from src/lib/domain/qr.js.
  import { qrMatrix } from '../domain/qr.js';

  /** @type {{ text: string, label: string, size?: number }} */
  let { text, label, size = 260 } = $props();

  const matrix = $derived(qrMatrix(text, 'M'));
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
</svg>

<style>
  .qr {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 12px;
  }
</style>
