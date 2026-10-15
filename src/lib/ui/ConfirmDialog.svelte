<script>
  // @ts-check
  // Dialog for destructive confirmations only (CLAUDE.md UI guidelines). Native <dialog>:
  // focus trap, Esc and the Android back gesture close it.
  /** @type {{ open: boolean, title: string, text: string, confirmLabel: string, danger?: boolean, onconfirm: () => void, onclose: () => void }} */
  let { open, title, text, confirmLabel, danger = false, onconfirm, onclose } = $props();

  /** @type {HTMLDialogElement} */
  let dialog;

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} onclose={onclose} aria-labelledby="dlg-title">
  <h2 id="dlg-title">{title}</h2>
  <p>{text}</p>
  <div class="actions">
    <button class="btn" onclick={() => dialog.close()}>Annulla</button>
    <button
      class="btn"
      class:danger
      onclick={() => {
        onconfirm();
        dialog.close();
      }}>{confirmLabel}</button
    >
  </div>
</dialog>

<style>
  dialog {
    width: min(360px, calc(100vw - 32px));
    padding: 22px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-card);
    background: var(--surface);
    color: var(--text);
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.6);
  }

  h2 {
    font-size: 20px;
  }

  p {
    color: var(--muted);
    margin: 10px 0 18px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .danger {
    background: var(--danger);
    color: var(--on-accent);
  }
</style>
