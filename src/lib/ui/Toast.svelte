<script>
  // @ts-check
  import { hideToast, toast } from '../stores/toast.svelte.js';
</script>

{#if toast.message}
  {#key toast.id}
    <div class="toast" role="status">
      <span>{toast.message}</span>
      {#if toast.undo}
        <button
          onclick={() => {
            toast.undo?.();
            hideToast();
          }}>Annulla</button
        >
      {/if}
    </div>
  {/key}
{/if}

<style>
  .toast {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(var(--nav-height) + var(--nav-gap) * 2 + var(--safe-bottom));
    z-index: 30;
    max-width: 480px;
    margin-inline: auto;
    min-height: 52px;
    padding: 6px 6px 6px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-radius: var(--r-control);
    background: var(--text);
    color: var(--on-accent);
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 12px 30px rgb(0 0 0 / 0.4);
    animation: rise var(--dur) var(--ease);
  }

  button {
    min-height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 16px;
    background: transparent;
    color: var(--on-accent);
    font-weight: 800;
    text-decoration: underline;
    cursor: pointer;
  }

  @keyframes rise {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }
</style>
