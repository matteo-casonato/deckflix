<script>
  // @ts-check
  // Two cards like a small stack: the main (cover) card upright in front, the second tilted
  // behind it to the right, pivoting on the bottom-left corner. Decorative.
  /** @type {{ images: (string | null | undefined)[], width?: number }} */
  let { images, width = 46 } = $props();

  const shown = $derived(images.filter(Boolean).slice(0, 2));
</script>

<span class="stack" style:--w="{width}px" aria-hidden="true">
  {#if shown.length}
    <!-- Back card first so the cover sits on top. -->
    {#each [...shown].reverse() as src, i (src)}
      <img {src} alt="" loading="lazy" decoding="async" class:back={shown.length === 2 && i === 0} />
    {/each}
  {:else}
    <span class="ph"></span>
  {/if}
</span>

<style>
  .stack {
    position: relative;
    width: calc(var(--w) * 1.36);
    height: calc(var(--w) * 1.56);
    flex-shrink: 0;
    display: block;
  }

  img,
  .ph {
    position: absolute;
    left: 2px;
    bottom: 4px;
    width: var(--w);
    aspect-ratio: 63 / 88;
    border-radius: var(--r-cardimg);
    object-fit: cover;
    box-shadow: 0 3px 8px rgb(0 0 0 / 0.45);
    transform-origin: 15% 100%;
  }

  img.back {
    transform: rotate(13deg);
    filter: brightness(0.85);
  }

  .ph {
    background: var(--surface-2);
    border: 1.5px dashed var(--line-2);
    box-shadow: none;
  }
</style>
