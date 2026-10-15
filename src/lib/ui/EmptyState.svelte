<script>
  // @ts-check
  /** @type {{ title: string, text?: string, children?: import('svelte').Snippet }} */
  let { title, text, children } = $props();
</script>

<section class="empty card">
  <h2>{title}</h2>
  {#if text}<p>{text}</p>{/if}
  {#if children}<div class="actions">{@render children()}</div>{/if}
</section>

<style>
  .empty {
    margin: 16px;
    padding: 24px 20px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    text-align: center;
  }

  h2 {
    font-size: 20px;
  }

  p {
    margin: 8px 0 0;
    color: var(--muted);
  }

  .actions {
    margin-top: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
  }
</style>
