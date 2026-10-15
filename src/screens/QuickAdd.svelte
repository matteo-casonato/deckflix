<script>
  // @ts-check
  // Quick add by number (SPEC § 4.1 bis): set and language, type only the number
  // ("25", "025" or "25/165"), Enter adds the default print, the field clears for the next card.
  import { getCard, getSet } from '../lib/api/tcgdex.js';
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
  const allSets = $derived([...sets.values()].reverse());
  const recent = $derived(settings.recentSets.map((id) => sets.get(id)).filter(Boolean));

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
  const brief = $derived(parsed && set ? cardByNumber(set.cards ?? [], parsed.number) : null);
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
    <label class="sel">
      <span>Edizione</span>
      <select class="chip" bind:value={setId}>
        <option value="" disabled>Scegli l’edizione</option>
        {#if recent.length}
          <optgroup label="Ultime usate">
            {#each recent as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
          </optgroup>
        {/if}
        <optgroup label="Tutte le edizioni">
          {#each allSets as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
        </optgroup>
      </select>
    </label>
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
      inputmode="numeric"
      autocomplete="off"
      enterkeyhint="done"
      placeholder={set ? `Numero, es. 25 o 25/${set.cardCount?.official ?? ''}` : 'Scegli prima l’edizione'}
      disabled={!setId}
      autofocus
    />
    <button class="btn primary" disabled={!brief}>Aggiungi</button>
  </form>

  {#if setError}
    <p class="note warn">Non riesco a caricare questa edizione. Controlla la connessione.</p>
  {:else if text && !parsed}
    <p class="note">Scrivi solo il numero: 25, 025 o 25/165.</p>
  {:else if parsed && set && !brief}
    <p class="note warn">Nessuna carta con il numero {parsed.number} in {set.name}.</p>
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
        <span class="muted num">{set?.name} · {brief.localId}/{set?.cardCount?.official ?? '?'}</span>
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
