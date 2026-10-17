<script>
  // @ts-check
  // Card detail: prices per print, quantities per language and variant, wishlist,
  // Cardmarket link (SPEC § 2: TCGdex prices aggregate all languages and conditions).
  import { liveQuery } from 'dexie';
  import Picker from '../lib/ui/Picker.svelte';
  import Flag from '../lib/ui/Flag.svelte';
  import { ArrowLeft01Icon, ArrowRight01Icon, BookmarkAdd02Icon, FavouriteIcon, LinkSquare02Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { TcgdexError, cardImage, getCard } from '../lib/api/tcgdex.js';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import { changeCopies, moveCondition, moveToWishlist, restoreEntry, undoMoveCondition, undoMoveToWishlist } from '../lib/data/collection.js';
  import { toggleWish } from '../lib/data/actions.js';
  import { listVariants, variantLabelOf } from '../lib/domain/variants.js';
  import { CONDITIONS, DEFAULT_CONDITION, collectionKey, conditionFactor, conditionLabel } from '../lib/domain/collection.js';
  import { LANG_LABELS, cardmarketUrl, euro, guessImage, imageAt, limitlessFallback, pricesDate, setIdOf } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { replace } from '../lib/router.svelte.js';
  import { cardSequence } from '../lib/stores/cardSequence.svelte.js';
  import { neighbours } from '../lib/domain/sequence.js';
  import { rarityIcon } from '../lib/domain/rarity.js';
  import { setSymbolUrl } from '../lib/domain/setSymbols.js';
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
    if (!image && guess) image = imageAt(guess, 'high');
    return { card: res.data, image, fetchedAt: res.fetchedAt, source: res.source, englishOnly: 'englishOnly' in res };
  }

  $effect(() => {
    request = load();
  });

  /** Previous and next card of the list this card was opened from (a set, an album…). */
  const steps = $derived(neighbours(cardSequence.ids, id));
  /** Steps in place: Back still returns to the list. @param {string | null | undefined} to */
  const go = (to) => {
    if (to) replace(hrefFor('card', { lang, id: to }));
  };

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (!steps || e.altKey || e.ctrlKey || e.metaKey || document.querySelector('[role="dialog"]')) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.key === 'ArrowLeft') go(steps.prev);
    else if (e.key === 'ArrowRight') go(steps.next);
  }

  // Horizontal swipe on the picture: left for the next card, right for the previous one.
  let swipeX = 0;
  let swipeY = 0;
  /** @param {TouchEvent} e */
  const swipeStart = (e) => {
    swipeX = e.touches[0].clientX;
    swipeY = e.touches[0].clientY;
  };
  /** @param {TouchEvent} e */
  const swipeEnd = (e) => {
    const dx = e.changedTouches[0].clientX - swipeX;
    const dy = e.changedTouches[0].clientY - swipeY;
    if (!steps || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? steps.next : steps.prev);
  };

  const entries = $derived(liveQuery(() => db.collection.where('cardId').equals(id).toArray()));
  const wished = $derived(liveQuery(() => db.wishlist.get(id).then(Boolean)));

  const CONDITION_ORDER = CONDITIONS.map(([c]) => /** @type {string} */ (c));
  /** Groups of copies of a print in this language, one per condition, best first. @param {string} variant */
  const groupsOf = (variant) =>
    ($entries ?? [])
      .filter((e) => e.lang === copyLang && e.variant === variant)
      .sort((a, b) => CONDITION_ORDER.indexOf(a.condition || DEFAULT_CONDITION) - CONDITION_ORDER.indexOf(b.condition || DEFAULT_CONDITION));
  /**
   * The card's prints, plus any print stored for this language that the data doesn't list
   * (e.g. a copy saved as "Normale" of a holo-only card): it must show up to be removed or fixed.
   * @param {import('../lib/domain/variants.js').VariantOption[]} variants
   * @returns {{ key: string, label: string, price: number | null }[]}
   */
  const withStored = (variants) => {
    /** @type {{ key: string, label: string, price: number | null }[]} */
    const base = variants.length ? variants : [{ key: 'normal', label: 'Normale', price: null }];
    const known = new Set(base.map((v) => v.key));
    const extra = [...new Set(($entries ?? []).filter((e) => e.lang === copyLang && !known.has(e.variant)).map((e) => e.variant))];
    return [...base, ...extra.map((key) => ({ key, label: `${variantLabelOf(key)} · non in elenco`, price: null }))];
  };
  /** @param {string} variant */
  const qtyOf = (variant) => groupsOf(variant).reduce((n, e) => n + e.qty, 0);
  /** Copies per language (the same card in Italian and English are separate copies). */
  const byLang = $derived(
    ($entries ?? []).reduce((/** @type {Record<string, number>} */ m, e) => ({ ...m, [e.lang]: (m[e.lang] ?? 0) + e.qty }), {}),
  );
  /** Languages with copies first, then the others. */
  const langOrder = $derived(
    Object.keys(LANG_LABELS).sort((a, b) => (byLang[b] ?? 0) - (byLang[a] ?? 0) || (a === lang ? -1 : b === lang ? 1 : 0)),
  );
  const totalCopies = $derived(($entries ?? []).reduce((s, e) => s + e.qty, 0));

  /** @type {{ variant: string, condition: string, label: string } | null} */
  let confirmRemove = $state(null);
  let confirmMove = $state(false);
  /** The (possibly guessed) image did not load: show the placeholder. */
  let artFailed = $state(false);
  /** Limitless copy of the picture, when the TCGdex file is missing (30th-R). */
  let artSrc = $state(/** @type {string | null} */ (null));
  /** @param {string} url */
  function artError(url) {
    const alt = artSrc ? null : imageAt(limitlessFallback(url.replace(/\/(high|low)\.webp$/, '')), 'high');
    if (alt) artSrc = alt;
    else artFailed = true;
  }
  /** The set symbol (from pokesymbols.com) did not load: just the name. */
  let symbolFailed = $state(false);
  let picker = $state(false);
  const inAlbums = $derived(liveQuery(async () => (await db.albums.toArray()).filter((a) => a.cards.some((c) => c.cardId === id)).length));

  /**
   * @param {string} variant
   * @param {string} condition
   * @param {number} delta
   * @param {string} label
   */
  async function change(variant, condition, delta, label) {
    const group = groupsOf(variant).find((e) => (e.condition || DEFAULT_CONDITION) === condition);
    if (delta < 0 && (group?.qty ?? 0) === 1 && qtyOf(variant) === 1) {
      confirmRemove = { variant, condition, label };
      return;
    }
    await changeCopies({ cardId: id, lang: copyLang, variant, condition }, delta);
  }

  /** @param {string} variant @param {string} condition */
  async function removeLast(variant, condition) {
    const before = await changeCopies({ cardId: id, lang: copyLang, variant, condition }, -1);
    showToast('Copia rimossa dalla collezione', () => restoreEntry(collectionKey(id, copyLang, variant, condition), before));
  }

  /** @param {import('../lib/db.js').CollectionEntry} entry @param {string} condition */
  async function regrade(entry, condition) {
    const m = await moveCondition(entry, condition);
    if (m) showToast(`${entry.qty === 1 ? 'Copia' : `${entry.qty} copie`} in ${conditionLabel(condition)}`, () => undoMoveCondition(m));
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

  /** Condition of the copies, when they are all one print in one condition (for Cardmarket). */
  /** @param {import('../lib/domain/variants.js').VariantOption[]} variants */
  function cardmarketCondition(variants) {
    const mine = variants.filter((v) => qtyOf(v.key) > 0);
    const groups = mine.length === 1 ? groupsOf(mine[0].key) : [];
    return groups.length === 1 ? groups[0].condition || DEFAULT_CONDITION : null;
  }

  /** @param {unknown} err */
  function errorText(err) {
    if (err instanceof TcgdexError && err.kind === 'not-found') return 'Questa carta non esiste su TCGdex.';
    if (err instanceof TcgdexError && err.kind === 'offline') return 'Sei offline e questa carta non è ancora salvata sul telefono.';
    return 'TCGdex non risponde in questo momento.';
  }
</script>

<svelte:window onkeydown={onKey} />

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
    {@const symbol = setSymbolUrl(setIdOf(id))}
    {@const rarityImg = rarityIcon(card.rarity)}
    {@const variants = listVariants(card)}
    {@const prices = pricesDate(card.pricing?.cardmarket?.updated, Date.now())}
    <div class="layout">
      <!-- Swipe is a shortcut: the arrows are the accessible way to step. -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="stage" class:stepping={!!steps} ontouchstart={swipeStart} ontouchend={swipeEnd}>
        {#if steps}
          <button class="step" aria-label="Carta precedente" disabled={!steps.prev} onclick={() => go(steps.prev)}>
            <Icon icon={ArrowLeft01Icon} size={22} />
          </button>
        {/if}
        {#if r.image && !artFailed}
          <img class="art" onerror={() => artError(r.image)} src={artSrc ?? r.image} alt={`${card.name}, carta ${card.localId} di ${card.set?.name}`} />
        {:else}
          <div class="art placeholder"><span>{card.name}</span><span class="num">{card.localId}</span></div>
        {/if}
        {#if steps}
          <button class="step" aria-label="Carta successiva" disabled={!steps.next} onclick={() => go(steps.next)}>
            <Icon icon={ArrowRight01Icon} size={22} />
          </button>
        {/if}
      </div>
      {#if steps}<p class="position num" aria-live="polite">{steps.index} di {steps.total}</p>{/if}

      <div class="info">
        <h1>{card.name}</h1>
        <p class="muted meta">
          <a href={hrefFor('set', { id: setIdOf(id) })}>
            {#if symbol && !symbolFailed}<span class="sym"><img src={symbol} alt="" onerror={() => (symbolFailed = true)} /></span>{/if}
            {card.set?.name}
          </a>
          <span>· <span class="num">{card.localId}/{card.set?.cardCount?.official ?? '?'}</span></span>
          {#if card.rarity && card.rarity !== 'Nessuna'}
            <span class="rar">
              ·
              {#if rarityImg}<span class="sym"><img src="{import.meta.env.BASE_URL}rarities/{rarityImg}.png" alt="" /></span>{/if}
              {card.rarity}
            </span>
          {/if}
        </p>
      </div>

      <section class="block card">
        <div class="block-head">
          <h2>Le tue copie</h2>
          <span class="muted num">{totalCopies} {totalCopies === 1 ? 'copia' : 'copie'}</span>
        </div>

        <div class="langs">
          <span class="muted small">Lingua delle copie</span>
          <div class="chips" role="group" aria-label="Lingua delle copie">
            {#each langOrder as code (code)}
              <button class="chip" aria-pressed={copyLang === code} onclick={() => (copyLang = code)}>
                <Flag lang={code} />{LANG_LABELS[code]}{#if byLang[code]}<span class="num count">{byLang[code]}</span>{/if}
              </button>
            {/each}
          </div>
        </div>

        {#if variants.length === 0}
          <p class="muted">TCGdex non elenca le stampe di questa carta.</p>
        {/if}
        <ul class="variants">
          {#each withStored(variants) as v (v.key)}
            {@const groups = groupsOf(v.key)}
            <li class="variant">
              <div class="vhead">
                <span class="vtxt">
                  <strong>{v.label}{variants.length === 1 && v.key === variants[0].key ? ' · unica stampa' : ''}</strong>
                  <span class="muted num">{v.price != null ? euro(v.price) : 'Prezzo non disponibile'}</span>
                </span>
                {#if !groups.length}
                  <button class="step plus" aria-label={`Aggiungi una copia ${v.label}`} onclick={() => change(v.key, DEFAULT_CONDITION, 1, v.label)}>+</button>
                {/if}
              </div>
              {#each groups as g (g.key)}
                {@const cond = g.condition || DEFAULT_CONDITION}
                <div class="cgroup">
                  <span class="ctxt">
                    <span class="cond">
                      <Picker small title={`Condizione di ${g.qty === 1 ? 'questa copia' : 'queste copie'} ${v.label}`} value={cond} options={CONDITIONS.map(([code, label]) => ({ value: code, label }))} onchange={(c) => regrade(g, c)} />
                    </span>
                    {#if v.price != null && cond !== DEFAULT_CONDITION}
                      <span class="muted num small">stima {euro(v.price * conditionFactor(cond, settings.conditionFactors))}</span>
                    {/if}
                  </span>
                  <span class="stepper">
                    <button class="step" aria-label={`Togli una copia ${v.label} ${conditionLabel(cond)}`} onclick={() => change(v.key, cond, -1, `${v.label} ${conditionLabel(cond)}`)}>−</button>
                    <span class="num qty" aria-live="polite">{g.qty}</span>
                    <button class="step plus" aria-label={`Aggiungi una copia ${v.label} ${conditionLabel(cond)}`} onclick={() => change(v.key, cond, 1, v.label)}>+</button>
                  </span>
                </div>
              {/each}
              {#if groups.length && groups.length < CONDITIONS.length}
                <span class="add">
                  <Picker
                    wide
                    title={`Aggiungi una copia ${v.label} in un’altra condizione`}
                    label="＋ Copia in un’altra condizione"
                    value=""
                    options={CONDITIONS.filter(([c]) => !groups.some((g) => (g.condition || DEFAULT_CONDITION) === c)).map(([code, label]) => ({ value: code, label }))}
                    onchange={(c) => change(v.key, c, 1, v.label)}
                  />
                </span>
              {/if}
            </li>
          {/each}
        </ul>
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
          Il prezzo indicato è la <strong>media Cardmarket di tutte le lingue e condizioni</strong>, come riferimento per una copia
          Near Mint. Per le tue copie l’app stima il valore in base alla condizione (vedi
          <a href={hrefFor('settings', { key: 'qualita' })}>Qualità e prezzi</a>); il prezzo reale lo trovi su Cardmarket, con le offerte
          nella lingua e nella condizione della tua copia.
        </p>
        <PriceTrend cardId={id} cardmarket={card.pricing?.cardmarket} />
        <a class="btn" href={cardmarketUrl(card, copyLang, cardmarketProduct(variants), cardmarketCondition(variants))} target="_blank" rel="noopener noreferrer">
          <Icon icon={LinkSquare02Icon} size={18} /> Apri su Cardmarket
        </a>
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
      onconfirm={() => confirmRemove && removeLast(confirmRemove.variant, confirmRemove.condition)}
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
  .vhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .cgroup {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .ctxt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .add {
    display: block;
    margin-top: 12px;
  }

  .add :global(.chip) {
    color: var(--accent);
  }

  /* min-width 0: the chips row scrolls sideways instead of widening the page. */
  .langs {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .langs .chips {
    max-width: 100%;
    padding: 2px;
  }

  .count {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: color-mix(in srgb, currentColor 16%, transparent);
    font-size: 12px;
    text-align: center;
  }

  .small a {
    color: var(--accent);
  }

  .small strong {
    color: var(--text);
  }

  .cond {
    align-self: flex-start;
    margin-top: 4px;
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

  .stage {
    display: grid;
    grid-template-columns: auto;
    align-items: center;
    gap: 4px;
    touch-action: pan-y;
  }

  .stage.stepping {
    grid-template-columns: 48px auto 48px;
  }

  .stepping .art {
    width: min(300px, calc(100vw - 32px - 104px));
  }

  .step {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--text);
    background: var(--surface-2);
  }

  .step:disabled {
    opacity: 0.3;
  }

  .position {
    margin: -8px 0 0;
    font-size: 12px;
    color: var(--muted);
  }

  .art {
    width: min(300px, 76vw);
    aspect-ratio: 63 / 88;
    border-radius: var(--r-cardimg);
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

  .meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    column-gap: 6px;
    row-gap: 4px;
  }

  .meta a,
  .rar {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  /* Symbols are printed black on the card: a light tile keeps them readable on the dark theme. */
  .sym {
    height: 22px;
    padding: 3px 5px;
    border-radius: 6px;
    background: #f4f4f2;
    display: inline-flex;
    align-items: center;
  }

  .sym img {
    height: 16px;
    width: auto;
    max-width: 40px;
    object-fit: contain;
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
    min-width: 0;
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
    flex-direction: column;
    justify-content: center;
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
