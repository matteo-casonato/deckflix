<script>
  // @ts-check
  // Bottom sheet for contextual actions (CLAUDE.md UI guidelines). Native modal <dialog>:
  // focus trap, Esc and the Android back gesture close it; a tap on the backdrop too.
  /** @type {{ open: boolean, title: string, onclose: () => void, children: import('svelte').Snippet }} */
  let { open, title, onclose, children } = $props();

  /** @type {HTMLDialogElement} */
  let dialog;

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  /** @param {MouseEvent} e */
  function onclick(e) {
    if (e.target === dialog) dialog.close();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} {onclose} {onclick} aria-labelledby="sheet-title">
  <div class="body">
    <span class="grip" aria-hidden="true"></span>
    <h2 id="sheet-title">{title}</h2>
    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    width: 100%;
    max-width: 560px;
    max-height: 85dvh;
    margin: auto auto 0;
    padding: 0;
    border: 1px solid var(--line-2);
    border-bottom: 0;
    border-radius: var(--r-section) var(--r-section) 0 0;
    background: var(--surface);
    color: var(--text);
  }

  dialog[open] {
    animation: up 220ms ease-out;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.6);
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

  h2 {
    font-size: 19px;
    padding: 0 4px;
  }

  @keyframes up {
    from {
      transform: translateY(40px);
      opacity: 0;
    }
  }
</style>
