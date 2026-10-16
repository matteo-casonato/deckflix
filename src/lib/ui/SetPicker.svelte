<script>
  // @ts-check
  // Set chooser with search: there are 200+ sets, too many for a plain <select>. A chip shows
  // the current set; tapping it opens a sheet with a search field (name, TCGdex id, or the
  // printed code like "SVI"), the recent sets first, then all sets newest first.
  import { findSetsByCode } from '../api/tcgdex.js';
  import { isPocketSet } from '../domain/cards.js';
  import Sheet from './Sheet.svelte';
  import { setLogoUrl, setSymbolUrl } from '../domain/setSymbols.js';

  /** Logos that did not load: those rows show the symbol, else nothing. */
  let broken = $state(/** @type {Set<string>} */ (new Set()));
  /** Icon of a set: its logo, else its symbol. @param {any} s */
  const iconOf = (s) => {
    const logo = setLogoUrl(s.id, s.logo);
    return logo && !broken.has(logo) ? logo : setSymbolUrl(s.id);
  };

  /**
   * @type {{
   *   sets: Map<string, any>, value: string, onchange: (id: string) => void,
   *   recent?: string[], label?: string, placeholder?: string, noneLabel?: string | null, active?: boolean,
   * }}
   */
  let { sets, value, onchange, recent = [], label = 'Edizione', placeholder = 'Scegli l’edizione', noneLabel = null, active = false } = $props();

  let open = $state(false);
  let q = $state('');
  /** Set ids whose printed code equals the text ("SVI" → sv01). */
  /** @type {string[]} */
  let byCode = $state([]);

  const norm = (/** @type {string} */ s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const all = $derived([...sets.values()].filter((s) => !isPocketSet(s.id)).reverse());

  $effect(() => {
    const t = q.trim();
    byCode = [];
    if (!/^[a-z]{2,5}$/i.test(t)) return;
    findSetsByCode(t.toUpperCase())
      .then((r) => {
        if (q.trim() === t) byCode = (r.data ?? []).map((/** @type {any} */ s) => s.id);
      })
      .catch(() => {});
  });

  const shown = $derived.by(() => {
    const t = norm(q.trim());
    if (!t) return all;
    const words = t.split(/\s+/);
    const hits = all.filter((s) => words.every((w) => norm(s.name).includes(w) || s.id.toLowerCase().includes(w)));
    const coded = byCode.map((id) => sets.get(id)).filter((s) => s && !hits.includes(s));
    return [...coded, ...hits];
  });
  const recentSets = $derived(recent.map((id) => sets.get(id)).filter(Boolean));

  /** @param {string} id */
  function pick(id) {
    onchange(id);
    open = false;
    q = '';
  }

  const current = $derived(value ? (sets.get(value)?.name ?? value) : null);
</script>

<button type="button" class="chip dropdown pick" class:on={active && !!value} aria-haspopup="dialog" aria-label={`${label}: ${current ?? placeholder}`} onclick={() => (open = true)}>
  <span>{current ?? placeholder}</span>
</button>

{#snippet icon(/** @type {any} */ s)}
  {@const src = iconOf(s)}
  <span class="icon" aria-hidden="true">
    {#if src}<img {src} alt="" loading="lazy" onerror={() => (broken = new Set([...broken, src]))} />{/if}
  </span>
{/snippet}

<Sheet {open} title={label} onclose={() => ((open = false), (q = ''))}>
  <label class="visually-hidden" for="set-search">Cerca un’edizione</label>
  <!-- svelte-ignore a11y_autofocus -->
  <input id="set-search" type="search" bind:value={q} placeholder="Nome o sigla, es. 151, Astri, SVI" autocomplete="off" autofocus enterkeyhint="search" />
  <ul class="list" role="listbox" aria-label="Edizioni">
    {#if noneLabel && !q.trim()}
      <li><button type="button" role="option" aria-selected={!value} onclick={() => pick('')}>{noneLabel}</button></li>
    {/if}
    {#if recentSets.length && !q.trim()}
      <li class="group">Ultime usate</li>
      {#each recentSets as s (s.id)}
        <li>
          <button type="button" role="option" aria-selected={value === s.id} onclick={() => pick(s.id)}>
            {@render icon(s)}<span class="txt">{s.name}<span>{s.id}</span></span>
          </button>
        </li>
      {/each}
      <li class="group">Tutte le edizioni</li>
    {/if}
    {#each shown as s (s.id)}
      <li>
        <button type="button" role="option" aria-selected={value === s.id} onclick={() => pick(s.id)}>
          {@render icon(s)}<span class="txt">{s.name}<span>{s.cardCount?.official ? `${s.cardCount.official} carte · ` : ''}{s.id}</span></span>
        </button>
      </li>
    {:else}
      <li class="empty">Nessuna edizione trovata.</li>
    {/each}
  </ul>
</Sheet>

<style>
  .pick {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 220px;
  }

  .pick span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  input {
    min-height: 48px;
    padding: 0 16px;
    border: 1.5px solid var(--accent);
    border-radius: var(--r-control);
    background: var(--bg);
    color: var(--text);
    font: inherit;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    height: 55dvh;
    overflow-y: auto;
  }

  .list button {
    width: 100%;
    min-height: 52px;
    padding: 6px 12px;
    border: 0;
    border-radius: 16px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 15px;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
  }

  /* Square box: every logo, wide or tall, takes the same room and the names line up. */
  .icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
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

  .list button[aria-selected='true'] {
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  }

  .group {
    padding: 12px 12px 4px;
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .empty {
    padding: 16px 12px;
    color: var(--muted);
    font-size: 14px;
  }
</style>
