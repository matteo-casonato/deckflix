<script>
  // @ts-check
  // App name with its ball icon (public/icons/icon-192.png), as on the home screen.
  /** @type {{ size?: number, tag?: 'h1' | 'span' }} */
  let { size = 28, tag = 'span' } = $props();
</script>

<svelte:element this={tag} class="logo" style:font-size="{size}px">
  <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={Math.round(size * 1.15)} height={Math.round(size * 1.15)} />
  <span>Deck<span class="flix">flix</span></span>
</svelte:element>

<style>
  .logo {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: -0.5px;
    line-height: 1;
  }

  img {
    display: block;
    flex-shrink: 0;
  }

  .flix {
    color: var(--accent);
  }
</style>
