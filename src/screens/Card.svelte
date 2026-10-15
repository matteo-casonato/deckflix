<script>
  // @ts-check
  // Card detail, Phase 1 version: proves the TCGdex client and its Dexie cache.
  // Prices, quantities and the Cardmarket link arrive in Phase 3.
  import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
  import Icon from '../lib/ui/Icon.svelte';
  import { TcgdexError, cardImage, getCard } from '../lib/api/tcgdex.js';
  import { PRICES_STALE_AFTER, freshnessLabel } from '../lib/domain/cache.js';

  /** @type {{ lang: string, id: string }} */
  let { lang, id } = $props();

  /** @type {Promise<{ card: any, image: string | null, fetchedAt: number, source: string }> | null} */
  let request = $state(null);

  async function load() {
    const res = await getCard(lang, id);
    let image = cardImage(res.data, 'high');
    // SPEC § 2: when the localised card has no image, use the English one.
    if (!image && lang !== 'en') image = await getCard('en', id).then((en) => cardImage(en.data, 'high')).catch(() => null);
    return { card: res.data, image, fetchedAt: res.fetchedAt, source: res.source };
  }

  $effect(() => {
    request = load();
  });

  const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

  /** @param {{ fetchedAt: number, source: string }} r */
  function sourceText(r) {
    const when = freshnessLabel(r.fetchedAt, Date.now());
    if (r.source === 'network') return `Dati scaricati ora da TCGdex`;
    if (r.source === 'cache') return `Dati salvati sul telefono · aggiornati ${when}`;
    return `Sei offline: dati salvati sul telefono, aggiornati ${when}`;
  }

  /** @param {unknown} err */
  function errorText(err) {
    if (err instanceof TcgdexError && err.kind === 'not-found') return 'Questa carta non esiste su TCGdex.';
    if (err instanceof TcgdexError && err.kind === 'offline') return 'Sei offline e questa carta non è ancora salvata sul telefono.';
    return 'TCGdex non risponde in questo momento.';
  }
</script>

<header class="top">
  <a class="back" href="#/home" aria-label="Indietro"><Icon icon={ArrowLeft01Icon} size={20} /></a>
</header>

{#if request}
  {#await request}
    <div class="layout" aria-busy="true">
      <div class="art skeleton"></div>
      <p class="muted">Carico la carta…</p>
    </div>
  {:then r}
    {@const card = r.card}
    {@const trend = card.pricing?.cardmarket?.trend}
    <div class="layout">
      {#if r.image}
        <img class="art" src={r.image} alt={`${card.name}, carta ${card.localId} di ${card.set?.name}`} />
      {:else}
        <div class="art placeholder"><span>{card.name}</span><span class="num">{card.localId}</span></div>
      {/if}
      <div class="info">
        <h1>{card.name}</h1>
        <p class="muted">
          {card.set?.name} · <span class="num">{card.localId}/{card.set?.cardCount?.official ?? '?'}</span>
          {#if card.rarity} · {card.rarity}{/if}
        </p>
        <p class="price num">
          {#if typeof trend === 'number' && trend > 0}
            {euro.format(trend)} <span class="muted">trend Cardmarket</span>
          {:else}
            <span class="muted">Prezzo non disponibile</span>
          {/if}
        </p>
        <p class="source" class:warn={Date.now() - r.fetchedAt > PRICES_STALE_AFTER}>{sourceText(r)}</p>
      </div>
    </div>
  {:catch err}
    <section class="error">
      <p>{errorText(err)}</p>
      <button class="btn" onclick={() => (request = load())}>Riprova</button>
    </section>
  {/await}
{/if}

<style>
  .top {
    padding: calc(12px + var(--safe-top)) 16px 0;
  }

  .back {
    width: 48px;
    height: 48px;
    border-radius: var(--r-card);
    background: var(--surface);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .layout {
    padding: 16px;
    display: grid;
    gap: 16px;
    justify-items: center;
  }

  .art {
    width: min(320px, 80vw);
    aspect-ratio: 63 / 88;
    border-radius: 14px;
    background: var(--surface-2);
    object-fit: cover;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--muted);
    text-align: center;
    padding: 16px;
  }

  .skeleton {
    animation: pulse 1.2s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    to {
      opacity: 0.5;
    }
  }

  .info {
    width: 100%;
    text-align: center;
  }

  h1 {
    font-size: 28px;
  }

  .muted {
    color: var(--muted);
    margin: 4px 0;
  }

  .price {
    margin: 12px 0 4px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 26px;
  }

  .price .muted {
    font-family: var(--font-body);
    font-weight: 400;
    font-size: 14px;
  }

  .source {
    margin: 4px 0;
    font-size: 13px;
    color: var(--muted);
  }

  .source.warn {
    color: var(--danger);
  }

  .error {
    margin: 16px;
    padding: 20px;
    border-radius: var(--r-section);
    background: var(--surface);
    text-align: center;
  }
</style>
