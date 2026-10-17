<script>
  // @ts-check
  // Search (docs/mockups/Cerca.html): all cards or only mine, filters, ownership, add to
  // collection or wishlist. Offline it searches the cards saved on the phone.
  import { liveQuery } from 'dexie';
  import { Add01Icon, FavouriteIcon, Search01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';
  import { getRarities, getTypes } from '../lib/api/tcgdex.js';
  import { filterByQuery, smartSearch } from '../lib/data/search.js';
  import { settings } from '../lib/stores/settings.svelte.js';
  import { cachedCards, prefetchCards, setsMap } from '../lib/data/catalog.js';
  import { addOneCopy, toggleWish } from '../lib/data/actions.js';
  import { changeDeckCard } from '../lib/data/decks.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import { setIdOf, thumbUrl } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { replace } from '../lib/router.svelte.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import Segmented from '../lib/ui/Segmented.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import SetPicker from '../lib/ui/SetPicker.svelte';
  import Picker from '../lib/ui/Picker.svelte';
  import { langOptions, rarityOptions, typeOptions } from '../lib/ui/options.js';
  import { setCardSequence } from '../lib/stores/cardSequence.svelte.js';
  import { KINDS, isKind } from '../lib/domain/kinds.js';

  /** @type {{ query: Record<string, string> }} */
  let { query } = $props();

  // Local copy of the text, so typing doesn't wait for the URL.
  let text = $state(query.q ?? '');
  const mine = $derived(query.mine === '1');
  const lang = $derived(query.lang || settings.cardLang);
  const filters = $derived({ setId: query.set ?? '', type: query.type ?? '', rarity: query.rarity ?? '', kind: query.kind ?? '' });
  // "Aggiungi al deck" (docs/mockups/CercaCarte.html): + adds to the deck, Standard only by default.
  const deckId = $derived(query.deck ?? '');
  const standard = $derived(deckId ? query.standard !== '0' : query.standard === '1');
  const deck = $derived(liveQuery(() => (deckId ? db.decks.get(deckId) : Promise.resolve(undefined))));
  /** @param {string} cardId */
  const inDeck = (cardId) => $deck?.cards.find((c) => c.cardId === cardId)?.qty ?? 0;

  /** @param {{ id: string, name: string }} c */
  async function addToDeck(c) {
    await changeDeckCard(deckId, c.id, 1);
    showToast(`${c.name} nel deck · ${inDeck(c.id) + 1}`, () => changeDeckCard(deckId, c.id, -1));
  }

  /** @param {Record<string, string | null>} patch */
  function update(patch) {
    replace(
      hrefFor('search', {}, {
        q: text.trim() || null,
        mine: mine ? '1' : null,
        lang: query.lang,
        deck: deckId || null,
        standard: query.standard,
        ...filters,
        set: filters.setId,
        ...patch,
        setId: undefined,
      }),
    );
  }

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let debounce;
  function onInput() {
    clearTimeout(debounce);
    debounce = setTimeout(() => update({}), 350);
  }

  // Filter options.
  /** @type {Map<string, any>} */
  let sets = $state(new Map());
  /** @type {string[]} */
  let types = $state([]);
  /** @type {string[]} */
  let rarities = $state([]);
  $effect(() => {
    const l = lang;
    setsMap(l).then((m) => (sets = m));
    getTypes(l).then((r) => (types = r.data)).catch(() => {});
    getRarities(l).then((r) => (rarities = r.data)).catch(() => {});
  });

  // Ownership, live.
  const owned = liveQuery(async () => {
    /** @type {Map<string, number>} */
    const m = new Map();
    for (const e of await db.collection.toArray()) m.set(e.cardId, (m.get(e.cardId) ?? 0) + e.qty);
    return m;
  });
  const wished = liveQuery(async () => new Set((await db.wishlist.toArray()).map((w) => w.cardId)));

  // Results.
  /** Thumbnails that did not load (the guessed path does not exist): those show the frame. */
  let broken = $state(/** @type {Set<string>} */ (new Set()));
  const thumbOf = thumbUrl;
  /** @type {{ id: string, localId: string, name: string, image?: string }[]} */
  let results = $state([]);
  let page = $state(1);
  let more = $state(false);
  let loading = $state(false);
  /** @type {null | 'offline' | 'error'} */
  let problem = $state(null);
  /** What the search understood of the text (edition, number, English names), shown under the count. */
  /** @type {import('../lib/data/search.js').SearchResult['understood'] | null} */
  let understood = $state(null);

  const q = $derived((query.q ?? '').trim());
  const canSearch = $derived(q.length >= 2 || !!filters.setId || mine);

  /** Only mine: the same query over the collection (cached cards), plus set, type and rarity. */
  async function searchMine() {
    const ids = [...($owned?.keys() ?? [])];
    await Promise.all([prefetchCards(ids, lang), lang === 'en' ? null : prefetchCards(ids, 'en').catch(() => {})]);
    const [cards, english] = await Promise.all([cachedCards(ids, lang), cachedCards(ids, 'en')]);
    const list = ids.map((id) => cards.get(id) ?? english.get(id) ?? { id, localId: id.slice(setIdOf(id).length + 1), name: id });
    return (await filterByQuery(list, english, q, sets))
      .filter((c) => !filters.setId || setIdOf(c.id) === filters.setId)
      .filter((c) => !filters.type || (c.types ?? []).includes(filters.type))
      .filter((c) => !filters.rarity || c.rarity === filters.rarity)
      .filter((c) => isKind(c, filters.kind))
      .sort((a, b) => a.id.localeCompare(b.id, 'it', { numeric: true }));
  }

  /** Offline fallback: cards saved on the phone whose name matches. */
  async function searchCache() {
    const rows = await db.cardCache.where('[lang+cardId]').between([lang, ''], [lang, '￿']).toArray();
    const en = await db.cardCache.where('[lang+cardId]').between(['en', ''], ['en', '￿']).toArray();
    const english = new Map(en.map((r) => [r.cardId, r.data]));
    return (await filterByQuery(rows.map((r) => r.data), english, q, sets)).filter((c) => !filters.setId || setIdOf(c.id) === filters.setId);
  }

  /** @param {number} p */
  async function run(p) {
    if (!canSearch) {
      results = [];
      return;
    }
    loading = true;
    problem = null;
    try {
      if (mine) {
        results = await searchMine();
        more = false;
      } else {
        const res = await smartSearch(lang, q, { ...filters, standard }, sets.size ? sets : await setsMap(lang), p);
        results = p === 1 ? res.results : [...results, ...res.results.filter((c) => !results.some((r) => r.id === c.id))];
        more = res.more;
        understood = res.understood;
        page = p;
      }
    } catch (err) {
      const offline = !navigator.onLine || (err instanceof Error && 'kind' in err && err.kind === 'offline');
      problem = offline ? 'offline' : 'error';
      results = offline ? await searchCache() : [];
      more = false;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Re-run when the query in the URL changes.
    void [q, mine, lang, filters.setId, filters.type, filters.rarity, filters.kind, standard, $owned?.size];
    run(1);
  });

  /** @param {{ id: string, localId: string }} c */
  function subtitle(c) {
    const set = sets.get(setIdOf(c.id));
    return `${set?.name ?? setIdOf(c.id)} · ${c.localId}${set?.cardCount?.official ? `/${set.cardCount.official}` : ''}`;
  }

  const ownedCount = $derived(results.filter((r) => ($owned?.get(r.id) ?? 0) > 0).length);
</script>

<BackHeader
  title={deckId ? 'Aggiungi al deck' : 'Cerca'}
  big
  fallback={deckId ? hrefFor('deckEdit', { id: deckId }) : hrefFor('collection')}
/>
{#if deckId && $deck}<p class="deckname">{$deck.name} · <span class="num">{$deck.cards.reduce((n, c) => n + c.qty, 0)}</span>/60</p>{/if}

<div class="pad">
  <label class="field">
    <Icon icon={Search01Icon} size={20} />
    <span class="visually-hidden">Cerca una carta</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input type="search" placeholder="Nome, numero o sigla" bind:value={text} oninput={onInput} autofocus enterkeyhint="search" />
  </label>

  <Segmented
    label="Dove cercare"
    value={mine ? 'mine' : 'all'}
    options={[
      { value: 'all', label: 'Tutte le carte' },
      { value: 'mine', label: 'Solo le mie' },
    ]}
    onchange={(v) => update({ mine: v === 'mine' ? '1' : null })}
  />

  <div class="chips" role="group" aria-label="Filtri">
    <button class="chip" aria-pressed={standard} onclick={() => update({ standard: standard ? (deckId ? '0' : null) : '1' })}>Solo Standard</button>
    <SetPicker {sets} value={filters.setId} placeholder="Edizione" noneLabel="Tutte le edizioni" active recent={settings.recentSets} onchange={(v) => update({ set: v || null })} />
    <Picker
      title="Tipo di carta"
      placeholder="Categoria"
      active
      value={filters.kind}
      options={[{ value: '', label: 'Tutte le categorie' }, ...KINDS.map((k) => ({ value: k.key, label: k.label, sub: k.parent }))]}
      onchange={(k) => update({ kind: k || null })}
    />
    <Picker title="Tipo" placeholder="Tipo" active value={filters.type} options={[{ value: '', label: 'Tutti i tipi' }, ...typeOptions(types)]} onchange={(t) => update({ type: t || null })} />
    <Picker title="Rarità" placeholder="Rarità" active value={filters.rarity} options={[{ value: '', label: 'Tutte le rarità' }, ...rarityOptions(rarities)]} onchange={(r) => update({ rarity: r || null })} />
    <Picker title="Lingua" active={!!query.lang} value={lang} options={langOptions()} onchange={(l) => update({ lang: l === settings.cardLang ? null : l })} />
  </div>

  {#if problem === 'offline'}
    <p class="note">Sei offline: cerco tra le carte salvate sul telefono.</p>
  {:else if problem === 'error'}
    <p class="note">TCGdex non risponde. <button class="link" onclick={() => run(1)}>Riprova</button></p>
  {/if}

  {#if canSearch && !loading}
    <p class="count num">
      {results.length}{more ? '+' : ''} risultati · {ownedCount} {ownedCount === 1 ? 'posseduto' : 'posseduti'}
    </p>
    {#if !mine && understood && (understood.sets.length || understood.number || understood.english)}
      <p class="understood">
        {[
          understood.sets.length ? `Edizione: ${understood.sets.slice(0, 2).join(', ')}${understood.sets.length > 2 ? '…' : ''}` : '',
          understood.number ? `N. ${understood.number.toUpperCase()}${understood.total ? `/${understood.total}` : ''}` : '',
          understood.english ? `${understood.english} trovate col nome inglese` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    {/if}
  {/if}
</div>

{#if !canSearch}
  <p class="hint">
    Scrivi il nome (anche inglese: “Iono”), eventualmente con numero e sigla: “Charizard 11/78”, “Charizard svi”, “svi 25”.
  </p>
{:else if loading && results.length === 0}
  <p class="hint" aria-busy="true">Cerco…</p>
{:else if results.length === 0}
  <section class="empty card">
    <p>
      Nessuna carta trovata{!mine && understood?.sets.length ? ` in ${understood.sets.join(', ')}` : ''}{!mine && understood?.number
        ? ` con il numero ${understood.number}${understood.total ? `/${understood.total}` : ''}`
        : ''}.
    </p>
    {#if mine}
      <button class="btn" onclick={() => update({ mine: null })}>Cerca in tutte le carte</button>
    {:else if filters.setId || filters.type || filters.rarity || filters.kind}
      <button class="btn" onclick={() => update({ set: null, type: null, rarity: null, kind: null })}>Togli i filtri</button>
    {/if}
  </section>
{:else}
  <ul class="results">
    {#each results as c (c.id)}
      {@const qty = $owned?.get(c.id) ?? 0}
      {@const wish = $wished?.has(c.id) ?? false}
      {@const img = thumbOf(c)}
      <li class="row card" class:owned={qty > 0}>
        <a class="main" href={hrefFor('card', { lang, id: c.id })} onclick={() => setCardSequence(results.map((x) => x.id))}>
          {#if img && !broken.has(c.id)}
            <img class="thumb" src={img} alt="" loading="lazy" onerror={() => (broken = new Set([...broken, c.id]))} />
          {:else}
            <span class="thumb dashed"></span>
          {/if}
          <span class="txt">
            <strong>{c.name}</strong>
            <span class="sub num">{subtitle(c)}</span>
            <span class="badges">
              {#if qty > 0}
                <span class="badge yes"><Icon icon={Tick02Icon} size={12} /> Posseduta ×{qty}</span>
              {:else}
                <span class="badge">Non posseduta</span>
              {/if}
              {#if deckId && inDeck(c.id)}<span class="badge deck">Nel deck ×{inDeck(c.id)}</span>{/if}
            </span>
          </span>
        </a>
        <button class="icon" class:wish aria-pressed={wish} aria-label={wish ? 'Togli dai desideri' : 'Aggiungi ai desideri'} onclick={() => toggleWish(c.id, c.name)}>
          <Icon icon={FavouriteIcon} size={20} />
        </button>
        <button
          class="icon add"
          aria-label={deckId ? 'Aggiungi al deck' : 'Aggiungi alla collezione'}
          onclick={() => (deckId ? addToDeck(c) : addOneCopy({ cardId: c.id, lang, name: c.name }))}
        >
          <Icon icon={Add01Icon} size={20} />
        </button>
      </li>
    {/each}
  </ul>
  {#if more}
    <div class="pad"><button class="btn wide" disabled={loading} onclick={() => run(page + 1)}>Mostra altri</button></div>
  {/if}
{/if}

<style>
  .understood {
    margin: -6px 0 0;
    font-size: 12px;
    color: var(--muted);
  }

  .pad {
    padding: 12px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field {
    min-height: 56px;
    padding: 0 18px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 36px;
    background: var(--surface);
    border: 1.5px solid var(--accent);
    color: var(--muted);
  }

  .field input {
    flex: 1;
    min-height: 44px;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 16px;
    outline: none;
  }

  .note,
  .count,
  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .hint {
    padding: 24px 20px;
    text-align: center;
    font-size: 14px;
  }

  .link {
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
    min-height: 32px;
  }

  .results {
    list-style: none;
    margin: 0;
    padding: 12px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .row {
    padding: 8px 10px 8px 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: var(--r-card);
    background: var(--surface);
    border: 1px solid var(--line);
  }

  /* Owned cards stand out when searching all cards (SPEC Phase 9). */
  .row.owned {
    border-color: color-mix(in srgb, var(--success) 55%, var(--line));
    background: color-mix(in srgb, var(--success) 7%, var(--surface));
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }

  .thumb {
    width: 44px;
    aspect-ratio: 63 / 88;
    border-radius: var(--r-cardimg);
    background: var(--surface-2);
    object-fit: cover;
    flex-shrink: 0;
  }

  .thumb.dashed {
    background: transparent;
    border: 1.5px dashed var(--line-2);
  }

  .txt {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .txt strong {
    font-size: 15px;
  }

  .sub {
    font-size: 12px;
    color: var(--muted);
  }

  .badge {
    align-self: flex-start;
    height: 22px;
    padding: 0 8px;
    border-radius: 11px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .badge.deck {
    background: color-mix(in srgb, var(--accent) 16%, var(--surface));
    color: var(--accent);
  }

  .deckname {
    margin: 0;
    padding: 0 20px;
    color: var(--muted);
    font-size: 13px;
  }

  .badge.yes {
    background: color-mix(in srgb, var(--success) 16%, var(--surface));
    color: var(--success);
  }

  .icon {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border: 0;
    border-radius: 26px;
    background: var(--surface-2);
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .icon.wish {
    color: var(--danger);
  }

  .icon.add {
    background: var(--text);
    color: var(--on-accent);
  }

  .empty {
    margin: 16px;
    padding: 20px;
    border-radius: var(--r-section);
    background: var(--surface);
    text-align: center;
    color: var(--muted);
  }

  .wide {
    width: 100%;
  }
</style>
