<script>
  // @ts-check
  // Horizontal strip of small cards (recent additions, price movers): scrolls sideways so it
  // doesn't take half the page.
  /**
   * @typedef {{ key: string, href: string, image: string | null, title: string, sub?: string, tag?: string | null, tone?: 'up' | 'down' | null }} StripItem
   * @type {{ items: StripItem[], label: string }}
   */
  let { items, label } = $props();
  /** Images that did not load (guessed paths): show the name instead of a broken icon. */
  let failed = $state(new Set());
</script>

<ul class="strip" aria-label={label}>
  {#each items as it (it.key)}
    <li>
      <a href={it.href}>
        <span class="art">
          {#if it.image && !failed.has(it.key)}
            <img src={it.image} alt="" loading="lazy" decoding="async" onerror={() => (failed = new Set([...failed, it.key]))} />
          {:else}<span class="ph">{it.title}</span>{/if}
          {#if it.tag}<span class="tag" class:up={it.tone === 'up'} class:down={it.tone === 'down'}>{it.tag}</span>{/if}
        </span>
        <span class="title">{it.title}</span>
        {#if it.sub}<span class="sub num">{it.sub}</span>{/if}
      </a>
    </li>
  {/each}
</ul>

<style>
  /* Starts aligned with the section title (20px); scroll-padding keeps that margin when
     the strip snaps, so the first card never sticks to the screen edge. */
  .strip {
    list-style: none;
    margin: 0;
    padding: 0 20px 4px;
    display: flex;
    gap: 10px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scroll-padding-inline: 20px;
    scrollbar-width: none;
  }

  .strip::-webkit-scrollbar {
    display: none;
  }

  li {
    width: 104px;
    flex-shrink: 0;
    scroll-snap-align: start;
  }

  a {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--text);
    text-decoration: none;
  }

  .art {
    position: relative;
    aspect-ratio: 63 / 88;
    border-radius: 10px;
    overflow: hidden;
    background: var(--surface-2);
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
    font-size: 10px;
    color: var(--muted);
  }

  .tag {
    position: absolute;
    top: 5px;
    right: 5px;
    height: 20px;
    padding: 0 7px;
    border-radius: 10px;
    background: var(--bg);
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
  }

  .tag.up {
    color: var(--success);
  }

  .tag.down {
    color: var(--danger);
  }

  .title {
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    font-size: 11px;
    color: var(--muted);
  }
</style>
