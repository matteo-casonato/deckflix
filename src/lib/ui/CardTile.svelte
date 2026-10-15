<script>
  // @ts-check
  // Card in a grid (docs/mockups/Set.html, Collezione.html): image, quantity and variant
  // badges, or a missing card: dashed slot with its number, or its image greyed out (`ghost`).
  // 63:88 placeholder while loading or without image.
  /** @type {{ name: string, localId: string, image?: string | null, qty?: number, badge?: string | null, href?: string, price?: string | null, missing?: boolean, ghost?: boolean }} */
  let { name, localId, image = null, qty = 0, badge = null, href, price = null, missing = false, ghost = false } = $props();

  // Fallbacks when the thumbnail doesn't load. Images are cached as opaque responses (CORS
  // headers on TCGdex assets are sometimes broken), so a missing image once cached as an
  // error would never come back: retry past the cache, then English, then the large image.
  const sources = $derived(
    image
      ? [`${image}/low.webp`, `${image}/low.webp?retry=1`, ...(/\/(it|fr|de|es|pt)\//.test(image) ? [`${image.replace(/\/(it|fr|de|es|pt)\//, '/en/')}/low.webp`] : []), `${image}/high.webp`]
      : [],
  );
  let attempt = $state(0);
  $effect(() => {
    void image;
    attempt = 0;
  });
  const failed = $derived(attempt >= sources.length);
  const src = $derived(sources[attempt]);
</script>

<a class="tile" {href} aria-label={`${name}, ${localId}${missing ? ', mancante' : qty ? `, ${qty} ${qty === 1 ? 'copia' : 'copie'}` : ''}`}>
  {#if missing && ghost && image && !failed}
    <span class="art missing ghost">
      <img {src} alt="" loading="lazy" decoding="async" onerror={() => attempt++} />
      <span class="no num">{localId}</span>
    </span>
    <span class="caption muted">{name}</span>
  {:else if missing}
    <span class="art missing num">{localId}</span>
    <span class="caption muted">{name}</span>
  {:else}
    <span class="art">
      {#if image && !failed}
        <img {src} alt="" loading="lazy" decoding="async" onerror={() => attempt++} />
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

  .ghost img {
    position: absolute;
    inset: 0;
    filter: grayscale(1);
    opacity: 0.3;
  }

  .ghost .no {
    position: relative;
    padding: 2px 8px;
    border-radius: 9px;
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
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
