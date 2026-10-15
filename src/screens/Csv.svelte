<script>
  // @ts-check
  // CSV export (docs/mockups/Csv.html): source, columns, preview, Share or Save file.
  import { liveQuery } from 'dexie';
  import { Csv01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
  import { db } from '../lib/db.js';

  // Any export counts as a copy of the data: Home stops inviting to sign in (SPEC § 3).
  const exported = () => db.settings.put({ key: 'lastExportAt', value: Date.now() });
  import { csvRows } from '../lib/data/csv.js';
  import { CSV_COLUMNS, csvFileName, toCsv } from '../lib/domain/csv.js';
  import { dayKey } from '../lib/domain/value.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import Icon from '../lib/ui/Icon.svelte';

  /** @type {{ query: Record<string, string> }} */
  let { query } = $props();

  const decks = liveQuery(() => db.decks.orderBy('updatedAt').reverse().toArray());
  const sources = $derived([
    { id: 'collection', label: 'Collezione' },
    { id: 'wishlist', label: 'Lista desideri' },
    ...($decks ?? []).map((d) => ({ id: `deck:${d.id}`, label: `Deck: ${d.name}` })),
  ]);

  let source = $state(query.source ?? 'collection');
  /** @type {import('../lib/domain/csv.js').CsvColumn[]} */
  let columns = $state(CSV_COLUMNS.map(([k]) => k));
  /** @type {import('../lib/domain/csv.js').CsvRow[] | null} */
  let rows = $state(null);

  $effect(() => {
    const s = source;
    rows = null;
    csvRows(s).then((r) => {
      if (s === source) rows = r;
    });
  });

  const label = $derived(sources.find((s) => s.id === source)?.label ?? 'export');
  const preview = $derived(rows ? toCsv(rows.slice(0, 4), columns, { bom: false }).trimEnd() : '');
  const ready = $derived(!!rows && rows.length > 0 && columns.length > 0);

  /** @param {import('../lib/domain/csv.js').CsvColumn} k */
  function toggle(k) {
    columns = columns.includes(k) ? columns.filter((c) => c !== k) : [...columns, k];
  }

  function file() {
    const name = csvFileName(label, dayKey(Date.now()));
    return new File([toCsv(rows ?? [], columns)], name, { type: 'text/csv;charset=utf-8' });
  }

  const canShare = typeof navigator.canShare === 'function';

  async function share() {
    const f = file();
    if (!navigator.canShare?.({ files: [f] })) return save();
    try {
      await navigator.share({ files: [f], title: f.name });
      exported();
    } catch (e) {
      if (/** @type {Error} */ (e).name !== 'AbortError') showToast('Condivisione non riuscita');
    }
  }

  function save() {
    const f = file();
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    showToast(`Salvato · ${f.name}`);
    exported();
  }
</script>

<BackHeader title="Esporta CSV" fallback={hrefFor('profile')} />

<div class="intro">
  <h1>Porta i dati<br />dove vuoi</h1>
  <span class="badge" aria-hidden="true"><Icon icon={Csv01Icon} size={32} /></span>
</div>

<section class="card block">
  <h2 id="src">Cosa esportare</h2>
  <div class="sources" role="radiogroup" aria-labelledby="src">
    {#each sources as s (s.id)}
      <button class="source card" role="radio" aria-checked={source === s.id} onclick={() => (source = s.id)}>
        <span class="lbl">{s.label}</span>
        <span class="tick">{#if source === s.id}<Icon icon={Tick02Icon} size={18} />{/if}</span>
      </button>
    {/each}
  </div>
</section>

<section class="card block">
  <h2 id="cols">Colonne</h2>
  <div class="chips wrap" role="group" aria-labelledby="cols">
    {#each CSV_COLUMNS as [key, , text] (key)}
      <button class="chip" aria-pressed={columns.includes(key)} onclick={() => toggle(key)}>{text}</button>
    {/each}
  </div>
  {#if !rows}
    <p class="note" aria-busy="true">Preparo le righe…</p>
  {:else if !rows.length}
    <p class="note">Niente da esportare: questa lista è vuota.</p>
  {:else if !columns.length}
    <p class="note">Scegli almeno una colonna.</p>
  {:else}
    <pre class="preview" aria-label="Anteprima delle prime righe">{preview}</pre>
    <p class="note">
      {rows.length} {rows.length === 1 ? 'riga' : 'righe'} · separatore punto e virgola, virgola per i decimali: si apre
      direttamente in Excel, Fogli Google e Numbers in italiano.
    </p>
  {/if}
</section>

<div class="actions">
  {#if canShare}<button class="btn light" disabled={!ready} onclick={share}>Condividi</button>{/if}
  <button class="btn primary" disabled={!ready} onclick={save}>Salva file</button>
</div>

<style>
  .intro {
    padding: 10px 20px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .intro h1 {
    font-size: 30px;
    line-height: 1.12;
    letter-spacing: -0.5px;
  }

  .badge {
    width: 76px;
    height: 76px;
    flex-shrink: 0;
    border-radius: 38px;
    background: var(--surface);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .block {
    margin: 14px 16px 0;
    padding: 18px;
    border-radius: var(--r-section);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  h2 {
    padding-left: 4px;
    font-size: 16px;
    font-weight: 700;
  }

  .sources {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .source {
    min-height: 56px;
    padding: 0 10px 0 18px;
    border: 0;
    border-radius: var(--r-section);
    background: var(--surface);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font: inherit;
    font-size: 15px;
    text-align: left;
  }

  .source[aria-checked='true'] {
    background: var(--text);
    color: var(--on-accent);
    font-weight: 700;
  }

  .lbl {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tick {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 18px;
    background: var(--surface-2);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .wrap {
    flex-wrap: wrap;
    padding: 0;
  }

  .preview {
    margin: 0;
    padding: 14px;
    border-radius: 24px;
    background: var(--surface-2);
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    line-height: 1.6;
    color: var(--muted);
    overflow-x: auto;
  }

  .note {
    margin: 0;
    padding: 0 4px;
    font-size: 12px;
    color: var(--muted);
  }

  .actions {
    padding: 16px 16px 24px;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 10px;
  }
</style>
