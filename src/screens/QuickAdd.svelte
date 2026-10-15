<script>
  // @ts-check
  // Quick add by number (SPEC § 4.1 bis). One big field: what is printed on the card
  // ("SVI 25", "25/165", "16/107", "TG25", "swsh302"), no set needed. For a pile of cards from
  // the same set, fix the set and type only the numbers ("25", "26"…). Enter adds the default
  // print and clears the field for the next card.
  import { cardsByNumber, getCard, getSet } from '../lib/api/tcgdex.js';
  import { settings, rememberSet } from '../lib/stores/settings.svelte.js';
  import { setsMap } from '../lib/data/catalog.js';
  import { smartSearch } from '../lib/data/search.js';
  import { changeCopies, restoreEntry } from '../lib/data/collection.js';
  import { defaultVariant } from '../lib/data/actions.js';
  import { listVariants } from '../lib/domain/variants.js';
  import { collectionKey } from '../lib/domain/collection.js';
  import { LANG_LABELS, cardByNumber, euro, parseQuickNumber, setIdOf } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { replace } from '../lib/router.svelte.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import SetPicker from '../lib/ui/SetPicker.svelte';

  /** @typedef {{ id: string, localId: string, name: string, image?: string }} Brief */

  /** @type {{ query: Record<string, string> }} */
  let { query } = $props();

  /** Fixed set ('' = any: the field takes code and number). */
  let setId = $state(query.set ?? '');
  let copyLang = $state(settings.cardLang);
  let text = $state('');
  /** @type {HTMLInputElement} */
  let input;

  /** @type {Map<string, any>} */
  let sets = $state(new Map());
  $effect(() => {
    setsMap(settings.cardLang).then((m) => (sets = m));
  });

  /** @type {any} */
  let set = $state(null);
  let setError = $state(false);
  $effect(() => {
    const id = setId;
    set = null;
    setError = false;
    replace(hrefFor('quick', {}, { set: id || null }));
    if (!id) return;
    getSet(settings.cardLang, id)
      .catch(() => getSet('en', id))
      .then((r) => (set = r.data))
      .catch(() => (setError = true));
  });

  const isDigits = (/** @type {string} */ n) => /^\d+$/.test(n);

  // ---------- fixed set: only the number ----------
  const parsed = $derived(setId ? parseQuickNumber(text) : null);
  const inSet = $derived(parsed && set ? cardByNumber(set.cards ?? [], parsed.number) : null);
  const totalMismatch = $derived(
    parsed?.total && set?.cardCount?.official && parsed.total !== set.cardCount.official ? set.cardCount.official : null,
  );

  // ---------- lookups: number with letters outside the set, or free text without a set ----------
  /** @type {Brief[]} */
  let found = $state([]);
  let looking = $state(false);
  let looked = $state(false);
  /** @type {Brief | null} */
  let picked = $state(null);
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let debounce;

  $effect(() => {
    const t = text.trim();
    const p = parsed;
    const id = setId;
    const s = set;
    found = [];
    picked = null;
    looked = false;
    clearTimeout(debounce);
    if (!t) return;
    if (id) {
      // Gallery cards live in a companion set on TCGdex (swsh9 → swsh9tg), promos in their own.
      if (!p || !s || inSet || !/[A-Z]/.test(p.number)) return;
      looking = true;
      debounce = setTimeout(async () => {
        /** @type {Brief[]} */
        let list = [];
        for (const sub of [`${id}tg`, `${id}gg`]) {
          if (!sets.has(sub)) continue;
          const r = await getSet(settings.cardLang, sub).catch(() => getSet('en', sub)).catch(() => null);
          const c = r && cardByNumber(r.data.cards ?? [], p.number);
          if (c) list = [c];
        }
        if (!list.length) list = (await cardsByNumber(settings.cardLang, p.number).catch(() => ({ data: [] }))).data;
        if (text.trim() !== t) return;
        found = list.filter((c) => !/^[A-Z]/.test(c.id));
        if (found.length === 1) picked = found[0];
        looking = false;
        looked = true;
      }, 250);
    } else {
      if (!/\d/.test(t)) return;
      looking = true;
      debounce = setTimeout(async () => {
        const r = await smartSearch(settings.cardLang, t, { setId: '', type: '', rarity: '', standard: false }, sets.size ? sets : await setsMap(settings.cardLang)).catch(
          () => ({ results: [] }),
        );
        if (text.trim() !== t) return;
        found = r.results.slice(0, 12);
        if (found.length === 1) picked = found[0];
        looking = false;
        looked = true;
      }, 450);
    }
  });

  const brief = $derived(/** @type {Brief | null} */ (inSet ?? picked));
  const briefSet = $derived(brief ? (inSet ? set : sets.get(setIdOf(brief.id))) : null);

  /** Full card of the preview, for its prints. */
  /** @type {any} */
  let card = $state(null);
  let variant = $state('normal');
  $effect(() => {
    const b = brief;
    card = null;
    if (!b) return;
    getCard(settings.cardLang, b.id)
      .catch(() => getCard('en', b.id))
      .then((r) => {
        if (brief?.id !== b.id) return;
        card = r.data;
        variant = defaultVariant(r.data);
      })
      .catch(() => {
        variant = 'normal';
      });
  });
  const variants = $derived(card ? listVariants(card) : []);

  /** @type {{ key: string, name: string, localId: string, label: string, before: any, undone: boolean }[]} */
  let added = $state([]);

  async function add() {
    if (!brief) return;
    const copy = { cardId: brief.id, lang: copyLang, variant };
    const before = await changeCopies(copy, 1);
    const label = variants.find((v) => v.key === variant)?.label ?? 'Normale';
    added = [
      { key: collectionKey(copy.cardId, copy.lang, copy.variant), name: brief.name, localId: brief.localId, label, before, undone: false },
      ...added,
    ].slice(0, 20);
    rememberSet(setId || setIdOf(brief.id));
    text = '';
    input?.focus();
  }

  /** @param {typeof added[number]} a */
  async function undo(a) {
    await restoreEntry(a.key, a.before);
    a.undone = true;
  }
</script>

<BackHeader title="Inserimento rapido" big fallback={hrefFor('collection')} />

<div class="pad">
  <form
    class="number"
    onsubmit={(e) => {
      e.preventDefault();
      add();
    }}
  >
    <label class="visually-hidden" for="qa-number">Numero della carta</label>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      id="qa-number"
      bind:this={input}
      bind:value={text}
      inputmode="text"
      autocapitalize="characters"
      autocomplete="off"
      enterkeyhint="done"
      placeholder={setId ? `25 · 25/${set?.cardCount?.official ?? '…'} · TG05` : 'SVI 25 · 25/165 · TG25'}
      autofocus
    />
    <button class="btn primary" disabled={!brief}>Aggiungi</button>
  </form>

  <div class="opts">
    <div class="opt">
      <span>Edizione</span>
      <SetPicker
        {sets}
        value={setId}
        recent={settings.recentSets}
        placeholder="Qualsiasi"
        noneLabel="Qualsiasi (scrivo sigla e numero)"
        active
        onchange={(v) => (setId = v)}
      />
    </div>
    <label class="opt">
      <span>Lingua delle copie</span>
      <select class="chip" bind:value={copyLang}>
        {#each Object.entries(LANG_LABELS) as [code, label] (code)}<option value={code}>{label}</option>{/each}
      </select>
    </label>
  </div>

  <p class="note">
    {setId
      ? `Edizione fissa: scrivi solo il numero e premi Invio, il campo si svuota per la carta successiva.`
      : 'Scrivi quello che vedi in basso sulla carta. Per una pila della stessa edizione, sceglila sopra e scrivi solo i numeri.'}
  </p>

  {#if setError}
    <p class="note warn">Non riesco a caricare questa edizione. Controlla la connessione.</p>
  {:else if text.trim() && setId && !parsed}
    <p class="note">Con l’edizione fissa scrivi solo il numero: 25, 025, 25/165, TG25.</p>
  {:else if text.trim() && !brief && looking}
    <p class="note" aria-busy="true">Cerco…</p>
  {:else if found.length > 1 && !brief}
    <section class="choose" aria-label="Carte trovate">
      <p class="note">Ho trovato {found.length} carte: quale?</p>
      <ul>
        {#each found as c (c.id)}
          {@const s = sets.get(setIdOf(c.id))}
          <li>
            <button type="button" onclick={() => (picked = c)}>
              <span class="mini">{#if c.image}<img src={`${c.image}/low.webp`} alt="" loading="lazy" />{/if}</span>
              <span class="ctxt">
                <strong>{c.name}</strong>
                <span class="num">{s?.name ?? setIdOf(c.id)} · {c.localId}{isDigits(c.localId) && s?.cardCount?.official ? `/${s.cardCount.official}` : ''}</span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {:else if text.trim() && !brief && (looked || (setId && parsed && set))}
    <p class="note warn">Nessuna carta trovata{setId && set ? ` con il numero ${parsed?.number} in ${set.name}` : ''}.</p>
  {/if}
  {#if totalMismatch}
    <p class="note warn">Questa edizione ha {totalMismatch} carte, non {parsed?.total}: controlla l’edizione scelta.</p>
  {/if}

  {#if brief}
    <section class="preview card">
      {#if brief.image}
        <img src={`${brief.image}/low.webp`} alt="" />
      {:else}
        <span class="ph"></span>
      {/if}
      <span class="ptxt">
        <strong>{brief.name}</strong>
        <span class="muted num">{briefSet?.name ?? ''} · {brief.localId}{isDigits(brief.localId) ? `/${briefSet?.cardCount?.official ?? '?'}` : ''}</span>
        {#if variants.length > 1}
          <span class="chips" role="radiogroup" aria-label="Variante">
            {#each variants as v (v.key)}
              <button type="button" class="chip" role="radio" aria-checked={variant === v.key} aria-pressed={variant === v.key} onclick={() => (variant = v.key)}>
                {v.label}{v.price != null ? ` · ${euro(v.price)}` : ''}
              </button>
            {/each}
          </span>
        {:else if variants.length === 1}
          <span class="muted small">{variants[0].label}</span>
        {/if}
        {#if found.length > 1}<button type="button" class="link" onclick={() => (picked = null)}>Non è questa</button>{/if}
      </span>
    </section>
  {/if}

  {#if added.length}
    <h2>Ultime aggiunte</h2>
    <ul class="added">
      {#each added as a (a)}
        <li class:undone={a.undone}>
          <span><strong>{a.name}</strong> <span class="muted num">{a.localId} · {a.label} · {LANG_LABELS[copyLang] ?? ''}</span></span>
          {#if a.undone}
            <span class="muted small">Annullata</span>
          {:else}
            <button class="link" onclick={() => undo(a)}>Annulla</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .pad {
    padding: 8px 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .number {
    display: flex;
    gap: 10px;
  }

  .number input {
    flex: 1;
    min-width: 0;
    min-height: 64px;
    padding: 0 20px;
    border-radius: var(--r-card);
    border: 1.5px solid var(--accent);
    background: var(--surface);
    color: var(--text);
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
  }

  .number input::placeholder {
    font-size: 17px;
    font-weight: 600;
    color: var(--muted);
  }

  .number .btn {
    min-height: 64px;
  }

  /* Set and language side by side, same height, labels above. */
  .opts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .opt {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
  }

  .opt :global(.chip) {
    width: 100%;
    max-width: none;
    min-height: 48px;
    font-size: 14px;
    justify-content: space-between;
  }

  .note {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .warn {
    color: var(--danger);
  }

  .choose ul {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    border-radius: var(--r-card);
    background: var(--surface);
    overflow: hidden;
  }

  .choose button {
    width: 100%;
    min-height: 60px;
    padding: 6px 12px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
  }

  .mini {
    width: 36px;
    height: 50px;
    flex-shrink: 0;
    border-radius: 5px;
    overflow: hidden;
    background: var(--surface-2);
  }

  .mini img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ctxt {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .ctxt span {
    font-size: 12px;
    color: var(--muted);
  }

  .preview {
    padding: 12px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .preview img,
  .ph {
    width: 96px;
    aspect-ratio: 63 / 88;
    border-radius: 10px;
    background: var(--surface-2);
    object-fit: cover;
    flex-shrink: 0;
  }

  .ptxt {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .ptxt strong {
    font-family: var(--font-display);
    font-size: 19px;
  }

  .ptxt .chips {
    flex-wrap: wrap;
  }

  .muted {
    color: var(--muted);
  }

  .small {
    font-size: 13px;
  }

  h2 {
    margin-top: 8px;
    font-size: 17px;
  }

  .added {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .added li {
    min-height: 52px;
    padding: 4px 6px 4px 14px;
    border-radius: 20px;
    background: var(--surface);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 14px;
  }

  .added li.undone {
    opacity: 0.55;
  }

  .link {
    align-self: flex-start;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
</style>
