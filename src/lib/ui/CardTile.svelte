<script>
  // @ts-check
  // Card in a grid (docs/mockups/Set.html, Collezione.html): image, quantity and variant
  // badges, or a dashed slot for a missing card. 63:88 placeholder while loading or without image.
  /** @type {{ name: string, localId: string, image?: string | null, qty?: number, badge?: string | null, href?: string, price?: string | null, missing?: boolean }} */
  let { name, localId, image = null, qty = 0, badge = null, href, price = null, missing = false } = $props();

  let failed = $state(false);
</script>

<a class="tile" {href} aria-label={`${name}, ${localId}${missing ? ', mancante' : qty ? `, ${qty} ${qty === 1 ? 'copia' : 'copie'}` : ''}`}>
  {#if missing}
    <span class="art missing num">{localId}</span>
    <span class="caption muted">{name}</span>
  {:else}
    <span class="art">
      {#if image && !failed}
        <img src={`${image}/low.webp`} alt="" loading="lazy" decoding="async" onerror={() => (failed = true)} />
      {:else}
        <span class="ph"><span>{name}</span><span class="num">{localId}</span></span>
      {/if}
      {#if qty > 1}<span class="qty num">×{qty}</span>{/if}
      {#if badge}<span class="badge">{badge}</span>{/if}
    </span>
    <span class="caption"><span class="num">{localId}</span>{#if price}<span class="num">{price}</span>{/if}</span>
  {/if}
</a>

<style>
  .tile {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    color: var(--text);
    text-decoration: none;
  }

  .art {
    position: relative;
    aspect-ratio: 63 / 88;
    border-radius: 10px;
    background: var(--surface-2);
    overflow: hidden;
    display: block;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .ph {
    position: absolute;
    inset: 0;
    padding: 6px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: 10px;
    color: var(--muted);
  }

  .missing {
    background: transparent;
    border: 1.5px dashed var(--line-2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 13px;
  }

  .qty {
    position: absolute;
    top: 5px;
    right: 5px;
    min-width: 26px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .badge {
    position: absolute;
    left: 5px;
    bottom: 5px;
    height: 18px;
    padding: 0 6px;
    border-radius: 9px;
    background: var(--bg);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
  }

  .caption {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    font-size: 11px;
    color: var(--muted);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
