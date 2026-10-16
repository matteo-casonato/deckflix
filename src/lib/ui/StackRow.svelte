<script>
  // @ts-check
  // List row shared by decks, sets and albums: card stack on the left, title, details and
  // tags in the middle, completion ring (or a value) on the right.
  import CardStack from './CardStack.svelte';

  /**
   * @type {{
   *   href: string, images: (string | null | undefined)[], title: string, logo?: string | null, sub?: string,
   *   percent?: number | null, done?: boolean, aside?: string | null, label?: string,
   *   children?: import('svelte').Snippet,
   * }}
   */
  let { href, images, title, logo = null, sub = '', percent = null, done = false, aside = null, label, children } = $props();

  /** The logo (a set's) did not load: show the title. */
  let logoFailed = $state(false);

  const R = 20;
  const C = 2 * Math.PI * R;
</script>

<a class="row card" {href} aria-label={label}>
  <CardStack {images} />
  <span class="txt">
    {#if logo && !logoFailed}
      <img class="logo" src={logo} alt={title} onerror={() => (logoFailed = true)} />
    {:else}
      <strong>{title}</strong>
    {/if}
    {#if sub}<span class="sub num">{sub}</span>{/if}
    {#if children}<span class="tags">{@render children()}</span>{/if}
  </span>
  {#if percent != null}
    <svg class="ring" viewBox="0 0 48 48" role="img" aria-label={`${percent}%`}>
      <circle cx="24" cy="24" r={R} class="track" />
      <circle cx="24" cy="24" r={R} class="fill" class:done stroke-dasharray={`${(Math.min(percent, 100) / 100) * C} ${C}`} />
      <text x="24" y="28" text-anchor="middle" class="num">{percent}%</text>
    </svg>
  {:else if aside}
    <span class="aside num">{aside}</span>
  {/if}
</a>

<style>
  .row {
    min-height: 96px;
    padding: 12px 14px 12px 12px;
    border-radius: var(--r-card);
    background: var(--surface);
    display: flex;
    align-items: center;
    gap: 14px;
    color: var(--text);
    text-decoration: none;
  }

  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  strong {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 800;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Same box for every logo: wide ones (Lost Origin) fill the width, tall ones (Paldea
     Evolved, Prismatic Evolutions) the height, none takes over the row. */
  .logo {
    align-self: flex-start;
    width: 96px;
    height: 32px;
    object-fit: contain;
    object-position: left center;
    margin-bottom: 2px;
  }

  .sub {
    font-size: 13px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tags {
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tags :global(.tag) {
    height: 22px;
    padding: 0 9px;
    border-radius: 11px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .tags :global(.tag.ok) {
    background: color-mix(in srgb, var(--success) 16%, var(--surface));
    color: var(--success);
  }

  .tags :global(.tag.bad) {
    background: color-mix(in srgb, var(--danger) 16%, var(--surface));
    color: var(--danger);
  }

  .tags :global(.tag.accent) {
    background: color-mix(in srgb, var(--accent) 16%, var(--surface));
    color: var(--accent);
  }

  .ring {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }

  .ring text {
    fill: var(--text);
    font-size: 12px;
    font-weight: 800;
  }

  .track,
  .fill {
    fill: none;
    stroke-width: 5;
  }

  .track {
    stroke: var(--surface-2);
  }

  .fill {
    stroke: var(--accent);
    stroke-linecap: round;
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
  }

  .fill.done {
    stroke: var(--success);
  }

  .aside {
    flex-shrink: 0;
    font-weight: 700;
    font-size: 15px;
  }
</style>
