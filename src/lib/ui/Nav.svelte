<script>
  // @ts-check
  // Floating navigation bar (docs/mockups/Home.html): Home · Collezione · [Scansiona] · Deck · Account.
  import { Cards02Icon, Home04Icon, PokeballIcon, ScanIcon, UserIcon } from '@hugeicons/core-free-icons';
  import Icon from './Icon.svelte';
  import { hrefFor } from '../domain/routes.js';

  /** @type {{ active: string }} */
  let { active } = $props();

  const items = [
    { name: 'home', label: 'Home', icon: Home04Icon },
    { name: 'collection', label: 'Collezione', icon: Cards02Icon },
    { name: 'deck', label: 'Deck', icon: PokeballIcon },
    // Phase 2: Google account photo and first name, with the backup status dot.
    { name: 'profile', label: 'Profilo', icon: UserIcon },
  ];
</script>

{#snippet item(/** @type {typeof items[number]} */ it)}
  <a
    class="item"
    class:active={active === it.name}
    href={hrefFor(/** @type {any} */ (it.name))}
    aria-current={active === it.name ? 'page' : undefined}
  >
    <Icon icon={it.icon} />
    <span>{it.label}</span>
  </a>
{/snippet}

<nav class="nav" aria-label="Navigazione principale">
  {@render item(items[0])}
  {@render item(items[1])}
  <a class="scan" href={hrefFor('scan')} aria-label="Scansiona carte">
    <Icon icon={ScanIcon} size={26} strokeWidth={1.6} />
  </a>
  {@render item(items[2])}
  {@render item(items[3])}
</nav>

<style>
  .nav {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(var(--nav-gap) + var(--safe-bottom));
    z-index: 10;
    max-width: 480px;
    margin-inline: auto;
    height: var(--nav-height);
    padding: 0 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 47px;
    background: rgb(27 30 37 / 0.94);
    border: 1px solid var(--line-2);
    box-shadow: 0 16px 40px rgb(0 0 0 / 0.45);
    backdrop-filter: blur(12px);
  }

  .item {
    flex: 1 1 0;
    min-width: 48px;
    height: 58px;
    border-radius: 38px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: var(--muted);
    text-decoration: none;
    font-size: 12px;
    font-weight: 500;
    transition: background-color var(--dur) var(--ease), color var(--dur) var(--ease);
  }

  .item.active {
    background: var(--line-2);
    color: var(--text);
    font-weight: 600;
  }

  .scan {
    width: 56px;
    height: 56px;
    margin: 0 4px;
    flex-shrink: 0;
    border-radius: 26px;
    background: var(--text);
    color: var(--on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @supports (corner-shape: squircle) {
    .nav,
    .item,
    .scan {
      corner-shape: squircle;
    }
  }
</style>
