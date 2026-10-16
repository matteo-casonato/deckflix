<script>
  // @ts-check
  // Frame the player's face: the photo moves under a round window (drag, or two fingers to
  // zoom) and a slider zooms; "Usa questa" crops what is inside the circle.
  import Sheet from '../../lib/ui/Sheet.svelte';
  import { avatarFromCrop } from '../../lib/data/avatar.js';

  /** @type {{ image: HTMLImageElement | null, onconfirm: (dataUrl: string) => void, onclose: () => void }} */
  let { image, onconfirm, onclose } = $props();

  const VIEW = 240;
  let zoom = $state(1);
  let x = $state(0);
  let y = $state(0);

  const w = $derived(image?.naturalWidth ?? 1);
  const h = $derived(image?.naturalHeight ?? 1);
  /** Scale that makes the short side fill the circle, times the zoom. */
  const scale = $derived((VIEW / Math.min(w, h)) * zoom);

  $effect(() => {
    void image;
    zoom = 1;
    x = 0;
    y = 0;
  });

  /** Keeps the photo covering the whole circle. */
  function clamp() {
    const maxX = Math.max(0, (w * scale - VIEW) / 2);
    const maxY = Math.max(0, (h * scale - VIEW) / 2);
    x = Math.min(maxX, Math.max(-maxX, x));
    y = Math.min(maxY, Math.max(-maxY, y));
  }

  /** @type {Map<number, { x: number, y: number }>} */
  const pointers = new Map();
  let pinch = 0;

  /** @param {PointerEvent} e */
  function down(e) {
    /** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) pinch = spread();
  }
  /** @param {PointerEvent} e */
  function move(e) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    if (pointers.size === 1) {
      x += e.clientX - prev.x;
      y += e.clientY - prev.y;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      const now = spread();
      zoom = Math.min(4, Math.max(1, zoom * (now / pinch)));
      pinch = now;
    }
    clamp();
  }
  /** @param {PointerEvent} e */
  function up(e) {
    pointers.delete(e.pointerId);
    pinch = 0;
  }
  function spread() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  function confirm() {
    if (!image) return;
    // Centre of the circle in image pixels, and its side.
    onconfirm(avatarFromCrop(image, { cx: w / 2 - x / scale, cy: h / 2 - y / scale, side: VIEW / scale }));
  }
</script>

<Sheet open={!!image} title="Centra la foto" {onclose}>
  {#if image}
    <p class="note">Trascina la foto e ingrandiscila finché il viso è al centro del cerchio.</p>
    <div
      class="frame"
      style:width="{VIEW}px"
      style:height="{VIEW}px"
      role="application"
      aria-label="Riquadro della foto: trascina per spostarla"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
    >
      <img
        src={image.src}
        alt=""
        draggable="false"
        style:width="{w * scale}px"
        style:height="{h * scale}px"
        style:transform="translate(calc(-50% + {x}px), calc(-50% + {y}px))"
      />
      <span class="ring" aria-hidden="true"></span>
    </div>
    <label class="zoom">
      <span>Zoom</span>
      <input type="range" min="1" max="4" step="0.01" bind:value={zoom} oninput={clamp} />
    </label>
    <div class="row">
      <button class="btn" onclick={onclose}>Annulla</button>
      <button class="btn primary" onclick={confirm}>Usa questa</button>
    </div>
  {/if}
</Sheet>

<style>
  .note {
    margin: 0;
    padding: 0 4px;
    font-size: 13px;
    color: var(--muted);
  }

  .frame {
    position: relative;
    align-self: center;
    overflow: hidden;
    border-radius: 24px;
    background: #000;
    touch-action: none;
    cursor: grab;
    user-select: none;
  }

  img {
    position: absolute;
    left: 50%;
    top: 50%;
    max-width: none;
    pointer-events: none;
  }

  /* Dim everything outside the circle. */
  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    box-shadow: 0 0 0 999px rgb(0 0 0 / 0.55);
    outline: 2px solid rgb(255 255 255 / 0.85);
    outline-offset: -2px;
    pointer-events: none;
  }

  .zoom {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: var(--muted);
  }

  .zoom input {
    flex: 1;
    accent-color: var(--accent);
  }

  .row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
