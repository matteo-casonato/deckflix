<script>
  // @ts-check
  // "Link utili" from the Profile: useful Pokémon TCG websites (list in src/lib/domain/links.js).
  import { LinkSquare02Icon } from '@hugeicons/core-free-icons';
  import { USEFUL_LINKS, faviconOf, hostOf } from '../lib/domain/links.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import Icon from '../lib/ui/Icon.svelte';

  /** Favicons that did not load: the initial is shown instead. */
  let failed = $state(new Set());
</script>

<BackHeader title="Link utili" big fallback={hrefFor('profile')} />

<p class="intro">Siti utili per giocare e collezionare. Si aprono in una nuova scheda.</p>

<ul class="links card">
  {#each USEFUL_LINKS as l (l.url)}
    <li>
      <a href={l.url} target="_blank" rel="noopener noreferrer">
        <span class="ico" aria-hidden="true">
          {#if !failed.has(l.url)}
            <img src={faviconOf(l)} alt="" width="26" height="26" loading="lazy" onerror={() => (failed = new Set([...failed, l.url]))} />
          {:else}{l.name[0]}{/if}
        </span>
        <span class="text">
          <strong>{l.name}</strong>
          <span>{l.text}</span>
          <span class="host">{hostOf(l.url)}</span>
        </span>
        <span class="ext" aria-hidden="true"><Icon icon={LinkSquare02Icon} size={18} /></span>
        <span class="visually-hidden">(si apre in una nuova scheda)</span>
      </a>
    </li>
  {/each}
</ul>

<style>
  .intro {
    margin: 0 20px 12px;
    font-size: 14px;
    color: var(--muted);
  }

  .links {
    list-style: none;
    margin: 0 16px 24px;
    padding: 4px;
    border-radius: var(--r-section);
    background: var(--surface);
  }

  a {
    min-height: 72px;
    padding: 10px 14px 10px 10px;
    border-radius: 28px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }

  li + li a {
    border-top: 1px solid var(--line);
    border-radius: 0;
  }

  .ico {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 14px;
    background: var(--surface-2);
    color: var(--accent);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ico img {
    width: 26px;
    height: 26px;
    object-fit: contain;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .text strong {
    font-size: 16px;
  }

  .text span {
    font-size: 13px;
    color: var(--muted);
  }

  .text .host {
    font-size: 12px;
  }

  .ext {
    color: var(--muted);
    display: flex;
  }
</style>
