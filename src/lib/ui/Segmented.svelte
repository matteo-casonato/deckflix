<script>
  // @ts-check
  // Segmented control / tabs (Possedute · Desideri, Tutte · Possedute · Mancanti).
  /** @type {{ options: { value: string, label: string }[], value: string, onchange: (v: string) => void, label: string }} */
  let { options, value, onchange, label } = $props();
</script>

<div class="seg" role="tablist" aria-label={label} style:--n={options.length}>
  {#each options as o (o.value)}
    <button role="tab" aria-selected={o.value === value} class:on={o.value === value} onclick={() => onchange(o.value)}>
      {o.label}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: 4px;
    padding: 4px;
    border-radius: var(--r-card);
    background: var(--surface);
    border: 1px solid var(--line);
  }

  button {
    min-height: 42px;
    border: 0;
    border-radius: 26px;
    background: transparent;
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  button.on {
    background: var(--line-2);
    color: var(--text);
  }

  @supports (corner-shape: squircle) {
    .seg,
    button {
      corner-shape: squircle;
    }
  }
</style>
