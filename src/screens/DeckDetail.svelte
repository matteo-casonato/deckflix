<script>
  // @ts-check
  // Deck summary (docs/mockups/DeckDettaglio.html): sections, value, completion, every card
  // with its state, breakdown and opening-hand odds; edit, share the list, missing cards to
  // the wishlist, delete.
  import { liveQuery } from 'dexie';
  import { db } from '../lib/db.js';
  import { deckRows, deleteDeck, exportDecklist, missingToWishlist, ownedMap, updateDeck } from '../lib/data/decks.js';
  import { deckSummary } from '../lib/domain/deck.js';
  import { euro } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { navigate } from '../lib/router.svelte.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import { cardImage } from '../lib/api/tcgdex.js';
  import { setDetails } from '../lib/data/catalog.js';
  import { coverCards, printedCode } from '../lib/domain/deck.js';
  import { replace } from '../lib/router.svelte.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import Sheet from '../lib/ui/Sheet.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import { ArrowRight01Icon, LinkSquare02Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons';
  import { cardmarketUrl } from '../lib/domain/cards.js';
  import Segmented from '../lib/ui/Segmented.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';
  import DeckStats from './deck/DeckStats.svelte';

  /** @type {{ id: string, query: Record<string, string> }} */
  let { id, query } = $props();

  // List with thumbnails, or a grid of cards like Limitless.
  const view = $derived(query.view === 'grid' ? 'grid' : 'list');

  const deck = $derived(liveQuery(() => db.decks.get(id)));
  const owned = liveQuery(ownedMap);

  /** @type {import('../lib/data/decks.js').DeckRow[] | null} */
  let rows = $state(null);
  $effect(() => {
    const d = $deck;
    const own = $owned;
    if (d && own) deckRows(d, own).then((r) => (rows = r));
  });
  const summary = $derived(rows ? deckSummary(rows) : null);

  // Printed set codes (BRS, SVI) for "BRS 048/172 F" under each name.
  /** @type {Map<string, any>} */
  let sets = $state(new Map());
  const setIds = $derived([...new Set((rows ?? []).map((r) => r.card?.set?.id).filter(Boolean))].sort().join(','));
  $effect(() => {
    if (setIds) setDetails(setIds.split(','), 'en').then((m) => (sets = m));
  });

  const SECTIONS = /** @type {const} */ ([
    ['Pokémon', 'Pokémon'],
    ['Trainer', 'Allenatori'],
    ['Energy', 'Energie'],
  ]);
  const STATE = { owned: '', other: 'Altra versione', missing: 'Manca' };
  // Cover card: chosen with a long press (Android fires contextmenu), else automatic.
  const coverId = $derived(rows && $deck ? (coverCards(rows, $deck.cover, (r) => !!cardImage(r.card), 1)[0] ?? null) : null);
  /**
   * @param {Event} e
   * @param {import('../lib/data/decks.js').DeckRow} r
   */
  async function chooseCover(e, r) {
    e.preventDefault();
    if (!$deck) return;
    const before = $deck.cover ?? null;
    const next = before === r.cardId ? null : r.cardId;
    await updateDeck(id, { cover: next });
    navigator.vibrate?.(20);
    showToast(next ? `Copertina: ${r.card?.name ?? r.cardId}` : 'Copertina automatica', () => updateDeck(id, { cover: before }));
  }

  /** @param {import('../lib/data/decks.js').DeckRow} r */
  const stateLabel = (r) => (r.state === 'missing' ? `Manca ${r.missing}` : STATE[r.state]);
  /** Right-hand label of a list row: "4", "Manca 2/4", "4 · altra versione". @param {import('../lib/data/decks.js').DeckRow} r */
  const rowLabel = (r) => (r.state === 'missing' ? `Manca ${r.missing}/${r.qty}` : r.state === 'other' ? `${r.qty} · altra versione` : String(r.qty));

  let confirmDelete = $state(false);

  async function share() {
    if (!$deck) return;
    const text = await exportDecklist($deck);
    if (navigator.share) {
      try {
        await navigator.share({ title: $deck.name, text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Lista copiata negli appunti');
    } catch {
      showToast('Non riesco a copiare la lista');
    }
  }

  async function toWishlist() {
    if (!rows) return;
    const n = await missingToWishlist(rows);
    showMissing = false;
    showToast(n ? `${n} ${n === 1 ? 'carta salvata' : 'carte salvate'} nei Desideri` : 'Le mancanti sono già nei Desideri');
  }

  /** "Cosa ti manca": the missing cards with price and a Cardmarket link each. */
  let showMissing = $state(false);
  const missingRows = $derived((rows ?? []).filter((r) => r.missing > 0).sort((a, b) => (b.price ?? 0) * b.missing - (a.price ?? 0) * a.missing));

  /** Section counters open the editor on that section. */
  const SECTION_LINKS = /** @type {const} */ ([
    ['pokemon', 'Pokémon', null],
    ['trainer', 'Allenatori', 'Trainer'],
    ['energy', 'Energie', 'Energy'],
  ]);
</script>

<BackHeader title="Deck" fallback={hrefFor('deck', {}, { tab: 'decks' })} />

{#if $deck === undefined}
  <p class="pad muted">Carico…</p>
{:else if !$deck}
  <p class="pad muted">Questo deck non esiste più.</p>
{:else}
  <section class="head card">
    <h1>{$deck.name}</h1>
    {#if summary}
      <p class="muted num">{summary.total} carte · valore deck {euro(summary.value)}</p>
      <div class="split num">
        {#each SECTION_LINKS as [key, label, tab] (key)}
          <a href={hrefFor('deckEdit', { id }, { tab })} aria-label={`Modifica ${label}: ${summary[key]} carte`}>
            <span class="pen" aria-hidden="true"><Icon icon={PencilEdit02Icon} size={16} /></span>
            <strong>{summary[key]}</strong>
            {label}
          </a>
        {/each}
      </div>
      <div class="progress">
        <span class="pct num">{summary.percent}%</span>
        <span class="facts num">
          <span>{summary.owned} di {summary.total} possedute</span>
          {#if summary.otherVersion}<span>{summary.otherVersion} coperte da un’altra versione</span>{/if}
          {#if summary.missing}<span>{summary.missing} mancanti · circa {euro(summary.missingCost)}</span>{/if}
        </span>
      </div>
      {#if summary.total !== 60}
        <p class="warn">Un deck Standard ha 60 carte: questo ne ha {summary.total}.</p>
      {/if}
    {:else}
      <p class="muted">Controllo la collezione…</p>
    {/if}
  </section>

  {#if rows?.length}
    <div class="pad">
      <Segmented
        label="Vista"
        value={view}
        options={[
          { value: 'list', label: 'Lista' },
          { value: 'grid', label: 'Griglia' },
        ]}
        onchange={(v) => replace(hrefFor('deckDetail', { id }, { view: v === 'grid' ? 'grid' : null }))}
      />
      <p class="muted cover-hint">Tieni premuta una carta per sceglierla come copertina ★{$deck.cover ? '' : ' (ora è automatica)'}.</p>
    </div>
  {/if}

  {#if rows}
    {#each SECTIONS as [key, label] (key)}
      {@const group = rows.filter((r) => r.section === key)}
      {#if group.length}
        <h2 class="section">{label} · <span class="num">{group.reduce((n, r) => n + r.qty, 0)}</span></h2>
        {#if view === 'grid'}
          <ul class="cards">
            {#each group as r (r.cardId)}
              <li>
                <a
                  class="tile"
                  class:missing={r.state === 'missing'}
                  class:cover={r.cardId === coverId}
                  href={hrefFor('card', { lang: 'en', id: r.cardId })}
                  oncontextmenu={(e) => chooseCover(e, r)}
                  aria-label={`${r.qty} ${r.card?.name ?? r.cardId}${r.state !== 'owned' ? `, ${stateLabel(r)}` : ''}`}
                >
                  {#if cardImage(r.card)}
                    <img src={cardImage(r.card)} alt="" loading="lazy" />
                  {:else}
                    <span class="ph">{r.card?.name ?? r.cardId}</span>
                  {/if}
                  <span class="count num">{r.qty}</span>
                  {#if r.cardId === coverId}<span class="star" title="Copertina">★</span>{/if}
                  {#if r.state !== 'owned'}<span class="tag {r.state}">{stateLabel(r)}</span>{/if}
                </a>
              </li>
            {/each}
          </ul>
        {:else}
        <ul class="lines card">
          {#each group as r (r.cardId)}
            <li>
              <a href={hrefFor('card', { lang: 'en', id: r.cardId })} oncontextmenu={(e) => chooseCover(e, r)}>
                <span class="thumb" class:missing={r.state === 'missing'}>
                  {#if cardImage(r.card)}<img src={cardImage(r.card)} alt="" loading="lazy" />{/if}
                  {#if r.cardId === coverId}<span class="star mini" title="Copertina">★</span>{/if}
                </span>
                <span class="name">
                  <strong>{r.card?.name ?? r.cardId}</strong>
                  <span class="muted num">{r.card ? printedCode(r.card, sets.get(r.card.set?.id)) : ''}</span>
                </span>
                <span class="state {r.state}">{rowLabel(r)}</span>
              </a>
            </li>
          {/each}
        </ul>
        {/if}
      {/if}
    {/each}
    {#if !rows.length}
      <p class="pad muted">Il deck è vuoto: tocca Pokémon, Allenatori o Energie qui sopra per aggiungere carte.</p>
    {:else}
      <section class="more card" aria-label="Altre azioni">
        {#if summary?.missing}
          <button class="missing-row" onclick={() => (showMissing = true)}>
            <span>
              <strong>Ti mancano {summary.missing} {summary.missing === 1 ? 'carta' : 'carte'}</strong>
              <span class="num">circa {euro(summary.missingCost)} su Cardmarket · vedi quali</span>
            </span>
            <Icon icon={ArrowRight01Icon} size={20} />
          </button>
        {/if}
        <div class="actions">
          <button class="btn" onclick={share}>Condividi</button>
          <a class="btn" href={hrefFor('deckPrint', { id })}>Stampa</a>
        </div>
      </section>
      <DeckStats {rows} />
    {/if}
  {/if}

  <div class="pad"><button class="btn danger-text" onclick={() => (confirmDelete = true)}>Elimina il deck</button></div>

  <Sheet open={showMissing} title="Cosa ti manca" onclose={() => (showMissing = false)}>
    <p class="sheet-note num">
      {summary?.missing ?? 0} carte, circa {euro(summary?.missingCost ?? 0)} su Cardmarket. Tocca una carta per aprirla su Cardmarket.
    </p>
    <ul class="missing-list">
      {#each missingRows as r (r.cardId)}
        <li>
          <a href={cardmarketUrl(r.card ?? r.cardId, 'it')} target="_blank" rel="noopener noreferrer">
            <span class="thumb">{#if cardImage(r.card)}<img src={cardImage(r.card)} alt="" loading="lazy" />{/if}</span>
            <span class="name">
              <strong>{r.card?.name ?? r.cardId}</strong>
              <span class="muted num">{r.card ? printedCode(r.card, sets.get(r.card.set?.id)) : ''}</span>
            </span>
            <span class="need num">×{r.missing}{r.price ? ` · ${euro(r.price * r.missing)}` : ''}</span>
            <Icon icon={LinkSquare02Icon} size={16} />
          </a>
        </li>
      {/each}
    </ul>
    <button class="btn primary" onclick={toWishlist}>
      Salva {summary?.missing === 1 ? 'la mancante' : `le ${summary?.missing ?? ''} mancanti`} nei Desideri
    </button>
    <p class="sheet-note">Le ritrovi in Cards › Desideri, con il prezzo e l’avviso quando scendono: una lista della spesa per completare il deck.</p>
  </Sheet>

  <ConfirmDialog
    open={confirmDelete}
    title="Eliminare il deck?"
    text={`${$deck.name} verrà eliminato. Le carte della collezione non cambiano.`}
    confirmLabel="Elimina"
    danger
    onconfirm={async () => {
      await deleteDeck(id);
      navigate(hrefFor('deck', {}, { tab: 'decks' }));
    }}
    onclose={() => (confirmDelete = false)}
  />
{/if}

<style>
  .more {
    margin: 24px 16px 0;
    padding: 14px;
    border-radius: var(--r-section);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* .pad .cover-hint: more specific than .muted (margin: 0), declared later. */
  .pad .cover-hint {
    margin: 10px 4px 0;
    font-size: 12px;
  }

  .star {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    border-radius: 12px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tile.cover {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .thumb {
    position: relative;
  }

  .star.mini {
    top: 2px;
    right: auto;
    left: 2px;
    width: 16px;
    height: 16px;
    font-size: 10px;
  }

  /* No text selection or callout on long press: it chooses the cover. */
  .lines a,
  .tile {
    -webkit-touch-callout: none;
    user-select: none;
  }

  .pad {
    padding: 12px 16px 0;
  }

  .muted {
    color: var(--muted);
    margin: 0;
    font-size: 13px;
  }

  .head {
    margin: 8px 16px 0;
    padding: 18px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h1 {
    font-size: 26px;
  }

  .split {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .split a {
    position: relative;
    min-height: 64px;
    padding: 10px;
    border-radius: 16px;
    background: var(--bg);
    font-size: 12px;
    color: var(--muted);
    text-decoration: none;
    display: flex;
    flex-direction: column;
  }

  .pen {
    position: absolute;
    top: 8px;
    right: 8px;
    color: var(--muted);
    display: flex;
  }

  .missing-row {
    width: 100%;
    min-height: 60px;
    padding: 10px 14px;
    border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--line));
    border-radius: var(--r-card);
    background: color-mix(in srgb, var(--danger) 8%, var(--surface));
    color: var(--text);
    font: inherit;
    text-align: left;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    cursor: pointer;
  }

  .missing-row > span {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .missing-row span span {
    font-size: 12px;
    color: var(--muted);
  }

  .sheet-note {
    margin: 0;
    padding: 0 4px;
    font-size: 12px;
    color: var(--muted);
  }

  .missing-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 48dvh;
    overflow-y: auto;
  }

  .missing-list a {
    min-height: 60px;
    padding: 6px 4px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
    border-bottom: 1px solid var(--line);
  }

  .need {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }

  .split strong {
    font-family: var(--font-display);
    font-size: 20px;
    color: var(--text);
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .pct {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 30px;
    color: var(--accent);
  }

  .facts {
    display: flex;
    flex-direction: column;
    font-size: 13px;
    color: var(--muted);
  }

  .warn {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .actions > :last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  .subtle {
    background: transparent;
    border: 1px solid var(--line-2);
  }

  .section {
    margin: 22px 20px 8px;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .lines {
    list-style: none;
    margin: 0 16px;
    padding: 4px;
    border-radius: var(--r-section);
    background: var(--surface);
  }

  .lines a {
    min-height: 56px;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
    border-radius: 24px;
  }

  .qty {
    width: 26px;
    text-align: right;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 17px;
  }

  .thumb {
    width: 36px;
    height: 50px;
    flex-shrink: 0;
    border-radius: var(--r-cardimg);
    overflow: hidden;
    background: var(--surface-2);
  }

  .thumb img,
  .tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Missing or partly missing: the card in grey, like the set binder. */
  .thumb.missing img,
  .tile.missing img {
    filter: grayscale(1);
    opacity: 0.4;
  }

  .cards {
    list-style: none;
    margin: 0;
    padding: 0 16px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .tile {
    position: relative;
    aspect-ratio: 63 / 88;
    border-radius: var(--r-cardimg);
    overflow: hidden;
    background: var(--surface-2);
    display: block;
    color: var(--text);
    text-decoration: none;
  }

  .ph {
    position: absolute;
    inset: 0;
    padding: 6px;
    font-size: 10px;
    color: var(--muted);
  }

  .count {
    position: absolute;
    top: 4px;
    left: 4px;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    border-radius: 12px;
    background: var(--bg);
    border: 1px solid var(--line-2);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tag {
    position: absolute;
    left: 4px;
    right: 4px;
    bottom: 4px;
    padding: 3px 4px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    background: var(--bg);
  }

  .tag.missing {
    color: var(--danger);
    border: 1px solid color-mix(in srgb, var(--danger) 50%, transparent);
  }

  .tag.other {
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
  }

  .name {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .name strong {
    font-size: 15px;
  }

  .state {
    flex-shrink: 0;
    height: 24px;
    padding: 0 9px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
  }

  .state.owned {
    min-width: 32px;
    justify-content: center;
    background: var(--surface-2);
    color: var(--text);
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 800;
  }

  .state.other {
    background: color-mix(in srgb, var(--accent) 16%, var(--surface));
    color: var(--accent);
  }

  .state.missing {
    background: color-mix(in srgb, var(--danger) 14%, var(--surface));
    color: var(--danger);
  }

  .danger-text {
    width: 100%;
    background: transparent;
    color: var(--danger);
  }
</style>
