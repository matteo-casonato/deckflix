<script>
  // @ts-check
  // "Scrivi il numero" from the scanner: what is printed at the bottom of the card ("SVI 25",
  // "25/165", "16/107", "TG25", "swsh302"), no set to choose first. Faster than the camera
  // for old or worn cards. Picking a result opens the usual add sheet.
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { setsMap } from '../../lib/data/catalog.js';
  import { smartSearch } from '../../lib/data/search.js';
  import { setIdOf } from '../../lib/domain/cards.js';
  import Sheet from '../../lib/ui/Sheet.svelte';

  /**
   * @typedef {{ id: string, localId: string, name: string, image?: string }} Brief
   * @type {{ open: boolean, onpick: (c: Brief, set: any) => void, onclose: () => void }}
   */
  let { open, onpick, onclose } = $props();

  let text = $state('');
  /** @type {Brief[]} */
  let results = $state([]);
  let searching = $state(false);
  let searched = $state(false);

  /** @type {Map<string, any>} */
  let sets = $state(new Map());
  $effect(() => {
    if (open) setsMap(settings.cardLang).then((m) => (sets = m));
  });

  /** @param {SubmitEvent} e */
  async function find(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    searching = true;
    try {
      const r = await smartSearch(settings.cardLang, t, { setId: '', type: '', rarity: '', standard: false }, sets.size ? sets : await setsMap(settings.cardLang));
      results = r.results.slice(0, 30);
      if (results.length === 1) pick(results[0]);
    } catch {
      results = [];
    } finally {
      searching = false;
      searched = true;
    }
  }

  /** @param {Brief} c */
  function pick(c) {
    onpick(c, sets.get(setIdOf(c.id)) ?? null);
    text = '';
    results = [];
    searched = false;
  }
</script>

<Sheet {open} title="Scrivi il numero" {onclose}>
  <form class="find" onsubmit={find}>
    <label class="visually-hidden" for="num-text">Numero della carta</label>
    <!-- svelte-ignore a11y_autofocus -->
    <input id="num-text" bind:value={text} placeholder="Es. SVI 25 · 25/165 · TG25" autocomplete="off" autocapitalize="characters" enterkeyhint="search" autofocus />
    <button class="btn primary" disabled={!text.trim() || searching}>{searching ? '…' : 'Trova'}</button>
  </form>
  <p class="note">
    Scrivi quello che vedi in basso sulla carta: numero e totale (25/165), con la sigla dell’edizione se c’è (SVI 25), anche
    il nome (Charizard 4/102).
  </p>
  {#if searched && !searching && !results.length}
    <p class="note warn">Nessuna carta trovata: controlla il numero o aggiungi la sigla o il nome.</p>
  {/if}
  {#if results.length > 1}
    <ul class="list">
      {#each results as c (c.id)}
        {@const set = sets.get(setIdOf(c.id))}
        <li>
          <button onclick={() => pick(c)}>
            <span class="thumb">{#if c.image}<img src={`${c.image}/low.webp`} alt="" loading="lazy" />{/if}</span>
            <span class="txt">
              <strong>{c.name}</strong>
              <span class="num">{set?.name ?? setIdOf(c.id)} · {c.localId}{set?.cardCount?.official ? `/${set.cardCount.official}` : ''}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</Sheet>

<style>
  .find {
    display: flex;
    gap: 8px;
  }

  .find input {
    flex: 1;
    min-width: 0;
    min-height: 56px;
    padding: 0 18px;
    border: 1.5px solid var(--accent);
    border-radius: var(--r-control);
    background: var(--bg);
    color: var(--text);
    font: inherit;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .find .btn {
    min-height: 56px;
  }

  .note {
    margin: 0;
    padding: 0 4px;
    font-size: 12px;
    color: var(--muted);
  }

  .warn {
    color: var(--danger);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 46dvh;
    overflow-y: auto;
  }

  .list button {
    width: 100%;
    min-height: 64px;
    padding: 6px 4px;
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

  .thumb {
    width: 38px;
    height: 53px;
    flex-shrink: 0;
    border-radius: var(--r-cardimg);
    overflow: hidden;
    background: var(--surface-2);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .txt {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .txt span {
    font-size: 12px;
    color: var(--muted);
  }
</style>
