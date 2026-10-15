<script>
  // @ts-check
  // Quick add by number (SPEC § 4.1 bis): set and language, type only the number
  // ("25", "025" or "25/165"), Enter adds the default print, the field clears for the next card.
  import { cardsByNumber, getCard, getSet } from '../lib/api/tcgdex.js';
  import { settings, rememberSet } from '../lib/stores/settings.svelte.js';
  import { setsMap } from '../lib/data/catalog.js';
  import { changeCopies, restoreEntry } from '../lib/data/collection.js';
  import { defaultVariant } from '../lib/data/actions.js';
  import { listVariants } from '../lib/domain/variants.js';
  import { collectionKey } from '../lib/domain/collection.js';
  import { LANG_LABELS, cardByNumber, euro, parseQuickNumber } from '../lib/domain/cards.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { replace } from '../lib/router.svelte.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import SetPicker from '../lib/ui/SetPicker.svelte';

  /** @type {{ query: Record<string, string> }} */
  let { query } = $props();

  let setId = $state(query.set ?? settings.recentSets[0] ?? '');
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
    if (!id) return;
    replace(hrefFor('quick', {}, { set: id }));
    getSet(settings.cardLang, id)
      .catch(() => getSet('en', id))
      .then((r) => (set = r.data))
      .catch(() => (setError = true));
  });

  const parsed = $derived(parseQuickNumber(text));
  const inSet = $derived(parsed && set ? cardByNumber(set.cards ?? [], parsed.number) : null);

  // Numbers with letters not in the chosen set: gallery cards live in a companion set on
  // TCGdex (swsh9 → swsh9tg, swsh12.5 → swsh12.5gg), promos in their own ("SWSH302"),
  // so look there, then in every set.
  /** @type {any[]} */
  let elsewhere = $state([]);
  let looking = $state(false);
  /** @type {any} */
  let picked = $state(null);
  $effect(() => {
    const p = parsed;
    const id = setId;
    elsewhere = [];
    picked = null;
    if (!p || !set || inSet || !/[A-Z]/.test(p.number)) return;
    looking = true;
    (async () => {
      for (const sub of [`${id}tg`, `${id}gg`]) {
        if (!sets.has(sub)) continue;
        const r = await getSet(settings.cardLang, sub).catch(() => getSet('en', sub)).catch(() => null);
        const c = r && cardByNumber(r.data.cards ?? [], p.number);
        if (c) return [c];
      }
      const m = p.number.match(/^([A-Z]+)0*(\d+)$/);
      const variants = m ? [...new Set([p.number, `${m[1]}${m[2].padStart(2, '0')}`, `${m[1]}${m[2]}`])] : [p.number];
      const lists = await Promise.all(variants.map((v) => cardsByNumber(settings.cardLang, v).then((r) => r.data).catch(() => [])));
      const seen = new Set();
      return lists.flat().filter((c) => !/^[A-Z]/.test(c.id) && !seen.has(c.id) && seen.add(c.id));
    })().then((found) => {
      if (parsed !== p) return;
      elsewhere = found;
      if (found.length === 1) picked = found[0];
      looking = false;
    });
  });
  const brief = $derived(inSet ?? picked);
  const isDigits = (/** @type {string} */ n) => /^\d+$/.test(n);
  /** Set of the card in the preview (the chosen one, or where the number was found). */
  const briefSet = $derived(inSet ? set : picked ? sets.get(picked.id.slice(0, picked.id.lastIndexOf('-'))) : null);
  const totalMismatch = $derived(
    parsed?.total && set?.cardCount?.official && parsed.total !== set.cardCount.official ? set.cardCount.official : null,
  );

  /** Full card of the preview, for its prints. */
  /** @type {any} */
  let card = $state(null);
  let variant = $state('normal');
  $effect(() => {
    const b = brief;
    card = null;
    if (!b) return;
    getCard(settings.cardLang, b.id)
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
    rememberSet(setId);
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
  <div class="selects">
    <div class="sel">
      <span>Edizione</span>
      <SetPicker {sets} value={setId} recent={settings.recentSets} onchange={(v) => (setId = v)} />
    </div>
    <label class="sel">
      <span>Lingua delle copie</span>
      <select class="chip" bind:value={copyLang}>
        {#each Object.entries(LANG_LABELS) as [code, label] (code)}<option value={code}>{label}</option>{/each}
      </select>
    </label>
  </div>

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
      placeholder={set ? `Numero, es. 25, 25/${set.cardCount?.official ?? ''} o TG05` : 'Scegli prima l’edizione'}
      disabled={!setId}
      autofocus
    />
    <button class="btn primary" disabled={!brief}>Aggiungi</button>
  </form>

  {#if setError}
    <p class="note warn">Non riesco a caricare questa edizione. Controlla la connessione.</p>
  {:else if text && !parsed}
    <p class="note">Scrivi solo il numero: 25, 025, 25/165, TG25/TG30 o SWSH302.</p>
  {:else if parsed && set && !brief && looking}
    <p class="note" aria-busy="true">Cerco {parsed.number} nelle altre edizioni…</p>
  {:else if parsed && set && !brief && elsewhere.length > 1}
    <section class="choose">
      <p class="note">{parsed.number} non è in {set.name}. L’ho trovato in:</p>
      {#each elsewhere as c (c.id)}
        <button type="button" class="chip" onclick={() => (picked = c)}>{c.name} · {sets.get(c.id.slice(0, c.id.lastIndexOf('-')))?.name ?? c.id}</button>
      {/each}
    </section>
  {:else if parsed && set && !brief}
    <p class="note warn">Nessuna carta con il numero {parsed.number} in {set.name}.</p>
  {/if}
  {#if picked && !inSet}
    <p class="note">Trovata in {briefSet?.name ?? 'un’altra edizione'}.</p>
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
  .choose {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .pad {
    padding: 12px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .selects {
    display: grid;
    gap: 10px;
  }

  .sel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }

  .sel .chip {
    width: 100%;
    min-height: 48px;
    font-size: 15px;
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
    font-size: 26px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .number input:disabled {
    border-color: var(--line);
    font-size: 16px;
    font-family: var(--font-body);
    font-weight: 400;
  }

  .number .btn {
    min-height: 64px;
  }

  .note {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .warn {
    color: var(--danger);
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
