<script>
  // @ts-check
  // Card detail: prices per print, quantities per language and variant, wishlist,
  // Cardmarket link (SPEC § 2: TCGdex prices aggregate all languages and conditions).
  import { liveQuery } from 'dexie';
  import { BookmarkAdd02Icon, FavouriteIcon, LinkSquare02Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { TcgdexError, cardImage, getCard } from '../lib/api/tcgdex.js';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import { changeCopies, moveToWishlist, restoreEntry, setCondition, undoMoveToWishlist } from '../lib/data/collection.js';
  import { toggleWish } from '../lib/data/actions.js';
  import { listVariants } from '../lib/domain/variants.js';
  import { CONDITIONS, DEFAULT_CONDITION, collectionKey } from '../lib/domain/collection.js';
  import { LANG_LABELS, cardmarketUrl, euro, googleUrl, guessImage, pricesDate, setIdOf } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { freshnessLabel } from '../lib/domain/cache.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';
  import AlbumPicker from './AlbumPicker.svelte';
  import PriceTrend from './card/PriceTrend.svelte';

  /** @type {{ lang: string, id: string }} */
  let { lang, id } = $props();

  /** Language of the physical copy (may differ from the language the card is shown in). */
  let copyLang = $state(lang);

  /** @type {Promise<{ card: any, image: string | null, fetchedAt: number, source: string }> | null} */
  let request = $state(null);

  async function load() {
    // Old cards often exist on TCGdex only in English (e.g. EX Deoxys has no Italian data).
    const res = await getCard(lang, id).catch((err) => {
      if (lang !== 'en' && err instanceof TcgdexError && err.kind === 'not-found') return getCard('en', id).then((r) => ({ ...r, englishOnly: true }));
      throw err;
    });
    let image = cardImage(res.data, 'high');
    // SPEC § 2: when the localised card has no image, use the English one.
    if (!image && lang !== 'en') image = await getCard('en', id).then((en) => cardImage(en.data, 'high')).catch(() => null);
    // TCGdex data without image: the file is often on the server anyway (see guessImage).
    const guess = guessImage(id, res.data.localId ?? '', 'en');
    if (!image && guess) image = `${guess}/high.webp`;
    return { card: res.data, image, fetchedAt: res.fetchedAt, source: res.source, englishOnly: 'englishOnly' in res };
  }

  $effect(() => {
    request = load();
  });

  const entries = $derived(liveQuery(() => db.collection.where('cardId').equals(id).toArray()));
  const wished = $derived(liveQuery(() => db.wishlist.get(id).then(Boolean)));

  /** @param {string} variant */
  const qtyOf = (variant) => ($entries ?? []).find((e) => e.lang === copyLang && e.variant === variant)?.qty ?? 0;
  /** @param {string} variant */
  const conditionOf = (variant) => ($entries ?? []).find((e) => e.lang === copyLang && e.variant === variant)?.condition || DEFAULT_CONDITION;
  const otherLangs = $derived(
    Object.entries(
      ($entries ?? [])
        .filter((e) => e.lang !== copyLang)
        .reduce((/** @type {Record<string, number>} */ m, e) => ({ ...m, [e.lang]: (m[e.lang] ?? 0) + e.qty }), {}),
    ),
  );
  const totalCopies = $derived(($entries ?? []).reduce((s, e) => s + e.qty, 0));

  /** @type {{ variant: string, label: string } | null} */
  let confirmRemove = $state(null);
  let confirmMove = $state(false);
  /** The (possibly guessed) image did not load: show the placeholder. */
  let artFailed = $state(false);
  let picker = $state(false);
  const inAlbums = $derived(liveQuery(async () => (await db.albums.toArray()).filter((a) => a.cards.some((c) => c.cardId === id)).length));

  /**
   * @param {any} card
   * @param {string} variant
   * @param {number} delta
   * @param {string} label
   */
  async function change(card, variant, delta, label) {
    if (delta < 0 && qtyOf(variant) === 1) {
      confirmRemove = { variant, label };
      return;
    }
    await changeCopies({ cardId: id, lang: copyLang, variant }, delta);
    void card;
  }

  /** @param {string} variant */
  async function removeLast(variant) {
    const before = await changeCopies({ cardId: id, lang: copyLang, variant }, -1);
    showToast('Copia rimossa dalla collezione', () => restoreEntry(collectionKey(id, copyLang, variant), before));
  }

  /** @param {any} card */
  async function moveToWishes(card) {
    const removed = await moveToWishlist(id, { lang: copyLang });
    showToast(`${card.name} spostata nei desideri`, () => undoMoveToWishlist(id, removed));
  }

  /**
   * Cardmarket product of the print you own in this language, when it is a single one.
   * @param {import('../lib/domain/variants.js').VariantOption[]} variants
   */
  function cardmarketProduct(variants) {
    const mine = variants.filter((v) => qtyOf(v.key) > 0);
    return mine.length === 1 ? (mine[0].productId ?? null) : null;
  }

  /** @param {unknown} err */
  function errorText(err) {
    if (err instanceof TcgdexError && err.kind === 'not-found') return 'Questa carta non esiste su TCGdex.';
    if (err instanceof TcgdexError && err.kind === 'offline') return 'Sei offline e questa carta non è ancora salvata sul telefono.';
    return 'TCGdex non risponde in questo momento.';
  }
</script>

<BackHeader fallback={hrefFor('set', { id: setIdOf(id) })}>
  <button
    class="round"
    class:on={!!$inAlbums}
    aria-label={$inAlbums ? `Raccolte: in ${$inAlbums}` : 'Aggiungi a raccolta'}
    onclick={() => (picker = true)}
  >
    <Icon icon={BookmarkAdd02Icon} size={20} />
  </button>
  {#if $wished !== undefined}
    <button
      class="round"
      class:on={$wished}
      aria-pressed={$wished}
      aria-label={$wished ? 'Togli dai desideri' : 'Aggiungi ai desideri'}
      onclick={() => request?.then((r) => toggleWish(id, r.card.name))}
    >
      <Icon icon={FavouriteIcon} size={20} />
    </button>
  {/if}
</BackHeader>

{#if request}
  {#await request}
    <div class="layout" aria-busy="true">
      <div class="art skeleton"></div>
      <p class="muted">Carico la carta…</p>
    </div>
  {:then r}
    {@const card = r.card}
    {@const variants = listVariants(card)}
    {@const prices = pricesDate(card.pricing?.cardmarket?.updated, Date.now())}
    <div class="layout">
      {#if r.image && !artFailed}
        <img class="art" onerror={() => (artFailed = true)} src={r.image} alt={`${card.name}, carta ${card.localId} di ${card.set?.name}`} />
      {:else}
        <div class="art placeholder"><span>{card.name}</span><span class="num">{card.localId}</span></div>
      {/if}

      <div class="info">
        <h1>{card.name}</h1>
        <p class="muted">
          <a href={hrefFor('set', { id: setIdOf(id) })}>{card.set?.name}</a> ·
          <span class="num">{card.localId}/{card.set?.cardCount?.official ?? '?'}</span>
          {#if card.rarity && card.rarity !== 'Nessuna'} · {card.rarity}{/if}
        </p>
      </div>

      <section class="block card">
        <div class="block-head">
          <h2>Le tue copie</h2>
          <span class="muted num">{totalCopies} {totalCopies === 1 ? 'copia' : 'copie'}</span>
        </div>

        <label class="lang">
          <span>Lingua della copia</span>
          <select class="chip" bind:value={copyLang}>
            {#each Object.entries(LANG_LABELS) as [code, label] (code)}<option value={code}>{label}</option>{/each}
          </select>
        </label>

        {#if variants.length === 0}
          <p class="muted">TCGdex non elenca le stampe di questa carta.</p>
        {/if}
        <ul class="variants">
          {#each variants.length ? variants : [{ key: 'normal', label: 'Normale', price: null }] as v (v.key)}
            {@const qty = qtyOf(v.key)}
            <li class="variant">
              <span class="vtxt">
                <strong>{v.label}</strong>
                <span class="muted num">{v.price != null ? euro(v.price) : 'Prezzo non disponibile'}</span>
                {#if qty > 0}
                  <select
                    class="cond"
                    aria-label={`Condizione delle copie ${v.label}`}
                    value={conditionOf(v.key)}
                    onchange={(e) => setCondition(collectionKey(id, copyLang, v.key), e.currentTarget.value)}
                  >
                    {#each CONDITIONS as [code, label] (code)}<option value={code}>{label}</option>{/each}
                  </select>
                {/if}
              </span>
              <span class="stepper">
                {#if qty > 0}
                  <button class="step" aria-label={`Togli una copia ${v.label}`} onclick={() => change(card, v.key, -1, v.label)}>−</button>
                  <span class="num qty" aria-live="polite">{qty}</span>
                {/if}
                <button class="step plus" aria-label={`Aggiungi una copia ${v.label}`} onclick={() => change(card, v.key, 1, v.label)}>+</button>
              </span>
            </li>
          {/each}
        </ul>
        {#if otherLangs.length}
          <p class="muted small">
            Anche in: {otherLangs.map(([l, n]) => `${LANG_LABELS[l] ?? l} ×${n}`).join(', ')}
          </p>
        {/if}
        {#if totalCopies > 0}
          <button class="btn subtle" onclick={() => (confirmMove = true)}>Sposta nei desideri</button>
        {/if}
      </section>

      <section class="block card">
        <div class="block-head">
          <h2>Prezzo Cardmarket</h2>
          {#if prices}<span class="small" class:warn={prices.old}>{prices.label}</span>{/if}
        </div>
        <p class="muted small">
          È la media di tutte le lingue e condizioni. Il prezzo reale della tua copia lo trovi su Cardmarket.
        </p>
        <PriceTrend cardId={id} cardmarket={card.pricing?.cardmarket} />
        <div class="links">
          <a class="btn" href={cardmarketUrl(card, copyLang, cardmarketProduct(variants))} target="_blank" rel="noopener noreferrer">
            <Icon icon={LinkSquare02Icon} size={18} /> Cardmarket
          </a>
          <a class="btn" href={googleUrl(card, card.set?.cardCount?.official)} target="_blank" rel="noopener noreferrer">
            <Icon icon={LinkSquare02Icon} size={18} /> Cerca su Google
          </a>
        </div>
        <p class="muted small">Per le carte vecchie Google con nome e numero (es. “{card.name} {card.localId}{card.set?.cardCount?.official ? `/${card.set.cardCount.official}` : ''}”) trova spesso prima le offerte.</p>
        <p class="source">
          {r.source === 'network'
            ? 'Dati scaricati ora da TCGdex'
            : r.source === 'cache'
              ? `Dati salvati sul telefono · aggiornati ${freshnessLabel(r.fetchedAt, Date.now())}`
              : `Sei offline: dati salvati sul telefono, aggiornati ${freshnessLabel(r.fetchedAt, Date.now())}`}
        </p>
      </section>
    </div>

    <AlbumPicker open={picker} cardId={id} cardName={card.name} onclose={() => (picker = false)} />
    <ConfirmDialog
      open={!!confirmRemove}
      title="Rimuovere la carta?"
      text={`Togli l’ultima copia ${confirmRemove?.label ?? ''} in ${LANG_LABELS[copyLang] ?? copyLang} dalla collezione.`}
      confirmLabel="Rimuovi"
      danger
      onconfirm={() => confirmRemove && removeLast(confirmRemove.variant)}
      onclose={() => (confirmRemove = null)}
    />
    <ConfirmDialog
      open={confirmMove}
      title="Spostare nei desideri?"
      text={`Tutte le copie di ${card.name} (${totalCopies}) escono dalla collezione e la carta va nei desideri.`}
      confirmLabel="Sposta"
      danger
      onconfirm={() => moveToWishes(card)}
      onclose={() => (confirmMove = false)}
    />
  {:catch err}
    <section class="error card">
      <p>{errorText(err)}</p>
      <button class="btn" onclick={() => (request = load())}>Riprova</button>
    </section>
  {/await}
{/if}

<style>
  .cond {
    align-self: flex-start;
    margin-top: 4px;
    min-height: 32px;
    padding: 0 26px 0 10px;
    border: 1px solid var(--line-2);
    border-radius: 12px;
    background: var(--bg);
    color: var(--text);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
  }

  .links {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }


  .round {
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: var(--r-card);
    background: var(--surface);
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .round.on {
    color: var(--danger);
  }

  .layout {
    padding: 8px 16px 0;
    display: grid;
    gap: 16px;
    justify-items: center;
  }

  .art {
    width: min(300px, 76vw);
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

  .info a {
    color: var(--muted);
  }

  .muted {
    color: var(--muted);
    margin: 0;
  }

  .small {
    font-size: 13px;
  }

  .warn {
    color: var(--danger);
  }

  .block {
    width: 100%;
    padding: 18px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .block-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }

  h2 {
    font-size: 18px;
  }

  .lang {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-size: 14px;
  }

  .variants {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .variant {
    min-height: 64px;
    padding: 8px 8px 8px 14px;
    border-radius: 24px;
    background: var(--bg);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .vtxt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .vtxt strong {
    font-size: 14px;
  }

  .vtxt .muted {
    font-size: 13px;
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .step {
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: 16px;
    background: var(--line-2);
    color: var(--text);
    font-size: 22px;
    font-weight: 700;
    cursor: pointer;
  }

  .step.plus {
    background: var(--accent);
    color: var(--on-accent);
  }

  .qty {
    min-width: 24px;
    text-align: center;
    font-weight: 800;
    font-size: 17px;
  }

  .subtle {
    background: transparent;
    border: 1px solid var(--line-2);
  }

  .source {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .error {
    margin: 16px;
    padding: 20px;
    border-radius: var(--r-section);
    background: var(--surface);
    text-align: center;
  }
</style>
