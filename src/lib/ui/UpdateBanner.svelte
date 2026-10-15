<script>
  // @ts-check
  import { applyUpdate, pwa } from '../stores/pwa.svelte.js';
</script>

{#if pwa.needRefresh}
  <div class="update" role="status">
    <span>Nuova versione disponibile</span>
    <button class="btn primary" onclick={applyUpdate}>Aggiorna</button>
    <button class="later" onclick={() => (pwa.needRefresh = false)} aria-label="Più tardi">Più tardi</button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    top: calc(12px + var(--safe-top));
    left: 16px;
    right: 16px;
    z-index: 40;
    max-width: 480px;
    margin-inline: auto;
    padding: 8px 8px 8px 18px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: var(--r-control);
    background: var(--surface-2);
    border: 1px solid var(--line-2);
    box-shadow: 0 12px 30px rgb(0 0 0 / 0.45);
    font-size: 14px;
    font-weight: 600;
  }

  span {
    flex: 1;
  }

  .btn {
    min-height: 44px;
    padding: 0 16px;
  }

  .later {
    min-height: 44px;
    padding: 0 10px;
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
</style>
