<script>
  // @ts-check
  // App shell: first run (Google sign-in), restore and choice flows, router, navigation
  // bar and the offline / renew-access banners.
  import { onMount } from 'svelte';
  import { router } from './lib/router.svelte.js';
  import { account } from './lib/stores/account.svelte.js';
  import { backupNow, initSync } from './lib/sync/sync.js';
  import { FULL_SCREEN, NAV_SECTION } from './lib/domain/routes.js';
  import { loadSettings } from './lib/stores/settings.svelte.js';
  import Toast from './lib/ui/Toast.svelte';
  import Collection from './screens/Collection.svelte';
  import Search from './screens/Search.svelte';
  import QuickAdd from './screens/QuickAdd.svelte';
  import SetScreen from './screens/Set.svelte';
  import Nav from './lib/ui/Nav.svelte';
  import Home from './screens/Home.svelte';
  import Placeholder from './screens/Placeholder.svelte';
  import Scan from './screens/Scan.svelte';
  import Card from './screens/Card.svelte';
  import Profile from './screens/Profile.svelte';
  import Access from './screens/Access.svelte';
  import Restore from './screens/Restore.svelte';
  import Choice from './screens/Choice.svelte';

  onMount(() => {
    loadSettings();
    initSync();
  });

  const route = $derived(router.route);
  const flow = $derived(
    !account.ready ? 'loading' : !account.firstRunDone ? 'access' : account.choice ? 'choice' : account.signIn ? 'restore' : 'app',
  );
  const showNav = $derived(flow === 'app' && !FULL_SCREEN.has(route.name));
</script>

{#if flow === 'access'}
  <Access />
{:else if flow === 'restore'}
  <Restore />
{:else if flow === 'choice'}
  <Choice />
{:else if flow === 'app'}
{#if !account.online}
  <p class="banner" role="status">Sei offline: mostro i dati salvati</p>
{:else if account.user && account.needsAuth}
  <p class="banner" role="status">
    Accesso a Google Drive da rinnovare
    <button class="btn small" onclick={() => backupNow({ interactive: true })}>Continua</button>
  </p>
{/if}

<main class:with-nav={showNav}>
  {#if route.name === 'home'}
    <Home />
  {:else if route.name === 'collection'}
    <Collection query={route.query} />
  {:else if route.name === 'search'}
    <Search query={route.query} />
  {:else if route.name === 'quick'}
    <QuickAdd query={route.query} />
  {:else if route.name === 'deck'}
    <Placeholder
      title="Deck"
      emptyTitle="Crea il tuo primo deck"
      emptyText="Potrai crearne uno nuovo o importare una lista da un sito di tornei."
      phase="Fase 6"
    />
  {:else if route.name === 'profile'}
    <Profile />
  {:else if route.name === 'scan'}
    <Scan />
  {:else if route.name === 'card'}
    {#key `${route.params.lang}/${route.params.id}`}
      <Card lang={route.params.lang} id={route.params.id} />
    {/key}
  {:else if route.name === 'set'}
    {#key route.params.id}
      <SetScreen id={route.params.id} query={route.query} />
    {/key}
  {:else}
    <Placeholder title="Pagina non trovata" emptyTitle="Qui non c'è niente" emptyText="Torna alla Home dalla barra in basso." phase="—" />
  {/if}
</main>

{#if showNav}
  <Nav active={NAV_SECTION[route.name]} />
{/if}
<Toast />
{/if}

<style>
  main {
    max-width: 560px;
    margin-inline: auto;
    padding-top: var(--safe-top);
  }

  /* Keep content clear of the floating navigation bar. */
  main.with-nav {
    padding-bottom: calc(var(--nav-height) + var(--nav-gap) * 2 + var(--safe-bottom));
  }

  .banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 20;
    margin: 0;
    padding: calc(8px + var(--safe-top)) 16px 8px;
    background: var(--surface-2);
    color: var(--text);
    font-size: 14px;
    text-align: center;
  }

  .banner .btn.small {
    min-height: 40px;
    padding: 0 14px;
    font-size: 13px;
  }
</style>
