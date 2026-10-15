<script>
  // @ts-check
  // App shell: router, navigation bar and offline banner.
  // Splash, first run (Google sign-in) and restore arrive in Phase 2.
  import { router } from './lib/router.svelte.js';
  import { FULL_SCREEN } from './lib/domain/routes.js';
  import Nav from './lib/ui/Nav.svelte';
  import Home from './screens/Home.svelte';
  import Placeholder from './screens/Placeholder.svelte';
  import Scan from './screens/Scan.svelte';
  import Card from './screens/Card.svelte';

  let online = $state(navigator.onLine);
  const route = $derived(router.route);
  const showNav = $derived(!FULL_SCREEN.has(route.name));
</script>

<svelte:window ononline={() => (online = true)} onoffline={() => (online = false)} />

{#if !online}
  <p class="offline" role="status">Sei offline: mostro i dati salvati</p>
{/if}

<main class:with-nav={showNav}>
  {#if route.name === 'home'}
    <Home />
  {:else if route.name === 'collection'}
    <Placeholder
      title="Le mie carte"
      emptyTitle="Nessuna carta ancora"
      emptyText="Scansiona o usa l'inserimento rapido per riempire la collezione."
      phase="Fase 3"
    />
  {:else if route.name === 'deck'}
    <Placeholder
      title="Deck"
      emptyTitle="Crea il tuo primo deck"
      emptyText="Potrai crearne uno nuovo o importare una lista da un sito di tornei."
      phase="Fase 6"
    />
  {:else if route.name === 'profile'}
    <Placeholder
      title="Profilo"
      emptyTitle="Accedi con Google"
      emptyText="Il backup automatico su Google Drive tiene al sicuro la collezione."
      phase="Fase 2"
    />
  {:else if route.name === 'scan'}
    <Scan />
  {:else if route.name === 'card'}
    {#key `${route.params.lang}/${route.params.id}`}
      <Card lang={route.params.lang} id={route.params.id} />
    {/key}
  {:else if route.name === 'set'}
    <Placeholder title="Edizione" emptyTitle="Raccoglitore dell'edizione" emptyText={route.params.id} phase="Fase 3" />
  {:else}
    <Placeholder title="Pagina non trovata" emptyTitle="Qui non c'è niente" emptyText="Torna alla Home dalla barra in basso." phase="—" />
  {/if}
</main>

{#if showNav}
  <Nav active={route.name} />
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

  .offline {
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
</style>
