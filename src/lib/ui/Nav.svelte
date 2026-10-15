<script>
  // @ts-check
  // Floating navigation bar (docs/mockups/Home.html): Home · Collezione · [Scansiona] · Deck · Account.
  import { Cards02Icon, Home04Icon, PokeballIcon, ScanIcon, UserIcon } from '@hugeicons/core-free-icons';
  import Icon from './Icon.svelte';
  import Avatar from './Avatar.svelte';
  import { hrefFor } from '../domain/routes.js';
  import { account } from '../stores/account.svelte.js';
  import { backupState } from '../domain/backup.js';

  /** @type {{ active: string }} */
  let { active } = $props();

  const items = [
    { name: 'home', label: 'Home', icon: Home04Icon },
    { name: 'collection', label: 'Cards', icon: Cards02Icon },
    { name: 'deck', label: 'Play!', icon: PokeballIcon },
  ];

  const status = $derived(
    backupState({
      signedIn: !!account.user,
      online: account.online,
      needsAuth: account.needsAuth,
      pending: account.pending || account.saving,
      conflict: !!account.choice,
    }),
  );

  // Scan button: tap = single mode, long press = burst mode (SPEC § 5).
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let pressTimer;
  let longPressed = false;
  function pressStart() {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      navigator.vibrate?.(20);
      location.hash = hrefFor('scan', {}, { mode: 'burst' });
    }, 500);
  }
  const pressEnd = () => clearTimeout(pressTimer);
  /** @param {MouseEvent} e */
  function onScanClick(e) {
    if (longPressed) e.preventDefault();
  }

  const STATE_TEXT = { saved: 'backup completato', pending: 'modifiche da salvare', idle: 'backup in pausa', none: '' };
  const profileLabel = $derived(
    account.user ? `Profilo di ${account.user.givenName || account.user.name}, ${STATE_TEXT[status]}` : 'Profilo',
  );
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
  <a
    class="scan"
    href={hrefFor('scan')}
    aria-label="Scansiona carte (tieni premuto per la raffica)"
    onpointerdown={pressStart}
    onpointerup={pressEnd}
    onpointerleave={pressEnd}
    onpointercancel={pressEnd}
    onclick={onScanClick}
    oncontextmenu={(e) => e.preventDefault()}
  >
    <Icon icon={ScanIcon} size={26} strokeWidth={1.6} />
  </a>
  {@render item(items[2])}
  <a
    class="item"
    class:active={active === 'profile'}
    href={hrefFor('profile')}
    aria-current={active === 'profile' ? 'page' : undefined}
    aria-label={profileLabel}
  >
    {#if account.user}
      <Avatar user={account.user} {status} ring="rgb(27 30 37)" />
      <span class="name">{account.user.givenName || account.user.name}</span>
    {:else}
      <Icon icon={UserIcon} />
      <span>Profilo</span>
    {/if}
  </a>
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
    /* Short labels (Home, Cards, Play!): equal widths, long profile names are cut. */
    flex: 1 1 0;
    min-width: 48px;
    padding: 0 8px;
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

  .name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item.active {
    background: var(--line-2);
    color: var(--text);
    font-weight: 600;
  }

  .scan {
    -webkit-touch-callout: none;
    user-select: none;
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
