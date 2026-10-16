<script>
  // @ts-check
  // Bottom sheet for contextual actions (CLAUDE.md UI guidelines), on Bits UI Dialog: focus
  // trap, Esc, tap on the backdrop and the Android back gesture close it. Style is ours.
  import { Dialog } from 'bits-ui';
  import { backToClose } from './backToClose.svelte.js';

  /** @type {{ open: boolean, title: string, onclose: () => void, children: import('svelte').Snippet }} */
  let { open, title, onclose, children } = $props();

  backToClose(() => open, () => onclose());
</script>

<Dialog.Root {open} onOpenChange={(o) => !o && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="dfx-overlay" />
    <Dialog.Content class="dfx-sheet">
      <div class="body">
        <span class="grip" aria-hidden="true"></span>
        <Dialog.Title class="dfx-sheet-title">{title}</Dialog.Title>
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
