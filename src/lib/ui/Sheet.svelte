<script>
  // @ts-check
  // Bottom sheet for contextual actions (CLAUDE.md UI guidelines), on Bits UI Dialog: focus
  // trap, Esc, tap on the backdrop, the Android back gesture and dragging it down by the grip
  // (or the title) close it. Style is ours.
  import { Dialog } from 'bits-ui';
  import { backToClose } from './backToClose.svelte.js';

  /** @type {{ open: boolean, title: string, onclose: () => void, children: import('svelte').Snippet }} */
  let { open, title, onclose, children } = $props();

  backToClose(() => open, () => onclose());

  // ---------- drag down to close ----------
  /** @type {HTMLElement | null} */
  let sheetEl = $state(null);
  let startY = 0;
  let dy = 0;
  let lastY = 0;
  let lastT = 0;
  let speed = 0;
  let dragging = false;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** @param {PointerEvent} e */
  function down(e) {
    if (!sheetEl || e.button > 0) return;
    dragging = true;
    startY = lastY = e.clientY;
    lastT = performance.now();
    dy = speed = 0;
    /** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
    sheetEl.style.transition = 'none';
    sheetEl.style.animation = 'none';
  }
  /** @param {PointerEvent} e */
  function move(e) {
    if (!dragging || !sheetEl) return;
    // Upwards it barely moves: the sheet is already as tall as it gets.
    const raw = e.clientY - startY;
    dy = raw > 0 ? raw : raw / 6;
    const now = performance.now();
    speed = (e.clientY - lastY) / Math.max(1, now - lastT);
    lastY = e.clientY;
    lastT = now;
    sheetEl.style.transform = `translateY(${dy}px)`;
  }
  function up() {
    if (!dragging || !sheetEl) return;
    dragging = false;
    const el = sheetEl;
    // Far enough (a third of the sheet, at most 140 px) or a quick flick down: close.
    const close = dy > Math.min(140, el.offsetHeight / 3) || (speed > 0.6 && dy > 20);
    el.style.transition = reduced() ? 'none' : 'transform 180ms ease-out';
    if (close) {
      el.style.transform = 'translateY(100%)';
      setTimeout(onclose, reduced() ? 0 : 160);
    } else {
      el.style.transform = '';
    }
  }
</script>

<Dialog.Root {open} onOpenChange={(o) => !o && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="dfx-overlay" />
    <Dialog.Content class="dfx-sheet" bind:ref={sheetEl}>
      <div class="body">
        <div class="handle" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
          <span class="grip" aria-hidden="true"></span>
          <Dialog.Title class="dfx-sheet-title">{title}</Dialog.Title>
        </div>
        {@render children()}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.dfx-overlay) {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgb(0 0 0 / 0.6);
  }

  :global(.dfx-sheet) {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 51;
    width: 100%;
    max-width: 560px;
    max-height: 85dvh;
    margin: 0 auto;
    overflow-y: auto;
    border: 1px solid var(--line-2);
    border-bottom: 0;
    border-radius: var(--r-section) var(--r-section) 0 0;
    background: var(--surface);
    color: var(--text);
    animation: dfx-up 220ms ease-out;
    outline: none;
  }

  @supports (corner-shape: squircle) {
    :global(.dfx-sheet) {
      corner-shape: squircle;
    }
  }

  .body {
    padding: 10px 18px calc(18px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Grip and title: the area that drags the sheet down. */
  .handle {
    margin: -10px -18px 0;
    padding: 10px 18px 2px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    touch-action: none;
    cursor: grab;
    user-select: none;
  }

  .grip {
    align-self: center;
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--line-2);
  }

  :global(.dfx-sheet-title) {
    margin: 0;
    padding: 0 4px;
    font-size: 19px;
  }

  @keyframes -global-dfx-up {
    from {
      transform: translateY(40px);
      opacity: 0;
    }
  }
</style>
