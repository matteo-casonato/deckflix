<script>
  // @ts-check
  // App shell: first run (Google sign-in), restore and choice flows, router, navigation
  // bar and the offline / renew-access banners.
  import { onMount } from 'svelte';
  import { guardExit, router } from './lib/router.svelte.js';
  import { showToast } from './lib/stores/toast.svelte.js';
  import { account } from './lib/stores/account.svelte.js';
  import { backupNow, initSync } from './lib/sync/sync.js';
  import { FULL_SCREEN, NAV_SECTION } from './lib/domain/routes.js';
  import { loadSettings, settings, setSetting } from './lib/stores/settings.svelte.js';
  import { db } from './lib/db.js';
  import Toast from './lib/ui/Toast.svelte';
  import UpdateBanner from './lib/ui/UpdateBanner.svelte';
  import { initPwa } from './lib/stores/pwa.svelte.js';
  import { recordTodaySnapshot } from './lib/data/value.js';
  import Collection from './screens/Collection.svelte';
  import Search from './screens/Search.svelte';
  import QuickAdd from './screens/QuickAdd.svelte';
  import SetScreen from './screens/Set.svelte';
  import Play from './screens/Play.svelte';
  import DeckDetail from './screens/DeckDetail.svelte';
  import DeckBuilder from './screens/DeckBuilder.svelte';
  import DeckImport from './screens/DeckImport.svelte';
  import Nav from './lib/ui/Nav.svelte';
  import Home from './screens/Home.svelte';
  import Placeholder from './screens/Placeholder.svelte';
  import Scan from './screens/Scan.svelte';
  import Card from './screens/Card.svelte';
  import Profile from './screens/Profile.svelte';
  import Csv from './screens/Csv.svelte';
  import Links from './screens/Links.svelte';
  import Settings from './screens/Settings.svelte';
  import DeckPrint from './screens/DeckPrint.svelte';
  import Album from './screens/Album.svelte';
  import Access from './screens/Access.svelte';
  import Restore from './screens/Restore.svelte';
  import Choice from './screens/Choice.svelte';
  import Setup from './screens/Setup.svelte';
  import GroupPhoto from './screens/scan/GroupPhoto.svelte';

  const settingsLoaded = loadSettings();

  onMount(() => {
    settingsLoaded.then(() => recordTodaySnapshot()).catch(() => {});
    initSync();
    initPwa();
    guardExit(() => showToast('Premi ancora Indietro per uscire'));
  });

  const route = $derived(router.route);
  const flow = $derived(
    !account.ready
      ? 'loading'
      : !account.firstRunDone
        ? 'access'
        : account.choice
          ? 'choice'
          : account.signIn
            ? 'restore'
            : account.setup
              ? 'setup'
              : 'app',
  );

  // First time in the app: the setup screen for new users. Those who already have cards,
  // players or a city (an older version, or a restored backup) skip it.
  let setupChecked = false;
  $effect(() => {
    if (flow !== 'app' || setupChecked) return;
    setupChecked = true;
    settingsLoaded
      .then(() => (settings.setupDone ? null : db.collection.count()))
      .then((n) => {
        if (n == null) return;
        if (n || settings.players.length || settings.homePlace) setSetting('setupDone', true);
        else account.setup = true;
      })
      .catch(() => {});
  });
  const showNav = $derived(flow === 'app' && !FULL_SCREEN.has(route.name));
</script>

{#if flow === 'access'}
  <Access />
{:else if flow === 'restore'}
  <Restore />
{:else if flow === 'choice'}
  <Choice />
{:else if flow === 'setup'}
  <Setup />
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
    <Play query={route.query} />
  {:else if route.name === 'deckImport'}
    <DeckImport />
  {:else if route.name === 'deckDetail'}
    {#key route.params.id}<DeckDetail id={route.params.id} query={route.query} />{/key}
  {:else if route.name === 'deckEdit'}
    {#key route.params.id}<DeckBuilder id={route.params.id} query={route.query} />{/key}
  {:else if route.name === 'profile'}
    <Profile />
  {:else if route.name === 'album'}
    {#key route.params.id}<Album id={route.params.id} />{/key}
  {:else if route.name === 'play'}
    <Play query={{ tab: 'players' }} />
  {:else if route.name === 'deckPrint'}
    {#key route.params.id}<DeckPrint id={route.params.id} />{/key}
  {:else if route.name === 'settings'}
    {#key route.params.key}<Settings key={route.params.key} />{/key}
  {:else if route.name === 'links'}
    <Links />
  {:else if route.name === 'csv'}
    <Csv query={route.query} />
  {:else if route.name === 'scanPhoto'}
    <GroupPhoto />
  {:else if route.name === 'scan'}
    <Scan query={route.query} />
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
<UpdateBanner />
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
