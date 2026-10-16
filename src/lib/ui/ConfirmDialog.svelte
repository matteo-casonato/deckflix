<script>
  // @ts-check
  // Dialog for destructive confirmations only (CLAUDE.md UI guidelines), on Bits UI
  // AlertDialog: focus trap, Esc and the Android back gesture cancel it. Style is ours.
  import { AlertDialog } from 'bits-ui';
  import { backToClose } from './backToClose.svelte.js';

  /** @type {{ open: boolean, title: string, text: string, confirmLabel: string, danger?: boolean, onconfirm: () => void, onclose: () => void }} */
  let { open, title, text, confirmLabel, danger = false, onconfirm, onclose } = $props();

  backToClose(() => open, () => onclose());
</script>

<AlertDialog.Root {open} onOpenChange={(o) => !o && onclose()}>
  <AlertDialog.Portal>
    <AlertDialog.Overlay class="dfx-overlay" />
    <AlertDialog.Content class="dfx-dialog">
      <AlertDialog.Title class="dfx-dialog-title">{title}</AlertDialog.Title>
      <AlertDialog.Description class="dfx-dialog-text">{text}</AlertDialog.Description>
      <div class="actions">
        <AlertDialog.Cancel class="btn">Annulla</AlertDialog.Cancel>
        <AlertDialog.Action
          class={danger ? 'btn danger' : 'btn'}
          onclick={() => {
            onconfirm();
            onclose();
          }}>{confirmLabel}</AlertDialog.Action
        >
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>

<style>
  :global(.dfx-overlay) {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgb(0 0 0 / 0.6);
  }

  :global(.dfx-dialog) {
    position: fixed;
    left: 50%;
    top: 50%;
    z-index: 51;
    transform: translate(-50%, -50%);
    width: min(360px, calc(100vw - 32px));
    padding: 22px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-card);
    background: var(--surface);
    color: var(--text);
    outline: none;
  }

  @supports (corner-shape: squircle) {
    :global(.dfx-dialog) {
      corner-shape: squircle;
    }
  }

  :global(.dfx-dialog-title) {
    margin: 0;
    font-size: 20px;
  }

  :global(.dfx-dialog-text) {
    color: var(--muted);
    margin: 10px 0 18px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .actions :global(.btn.danger) {
    background: color-mix(in srgb, var(--danger) 18%, var(--surface));
    color: var(--danger);
  }
</style>
