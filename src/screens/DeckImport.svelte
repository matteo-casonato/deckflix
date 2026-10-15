<script>
  // @ts-check
  // Import a deck list (SPEC § 4.2 bis): paste, preview recognised and unrecognised lines,
  // name, create. Unrecognised lines are shown for manual correction, never dropped.
  import { createDeck, resolveDecklist } from '../lib/data/decks.js';
  import { parseDecklist } from '../lib/domain/decklist.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { navigate } from '../lib/router.svelte.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';

  let text = $state('');
  let name = $state('');
  /** @type {Awaited<ReturnType<typeof resolveDecklist>> | null} */
  let result = $state(null);
  let checking = $state(false);
  let progress = $state({ done: 0, total: 0 });

  const parsed = $derived(parseDecklist(text));
  const count = $derived(parsed.lines.reduce((n, l) => n + l.qty, 0));

  async function check() {
    checking = true;
    result = null;
    try {
      result = await resolveDecklist(text, (done, total) => (progress = { done, total }));
    } finally {
      checking = false;
    }
  }

  async function create() {
    if (!result) return;
    const id = await createDeck(name || 'Deck importato', result.cards);
    showToast(`Deck creato · ${result.cards.reduce((n, c) => n + c.qty, 0)} carte`);
    navigate(hrefFor('deckDetail', { id }));
  }

  async function paste() {
    try {
      text = await navigator.clipboard.readText();
    } catch {
      showToast('Incolla la lista nel riquadro');
    }
  }
</script>

<BackHeader title="Importa lista" big fallback={hrefFor('deck')} />

<div class="pad">
  <p class="muted">Incolla una lista da Pokémon TCG Live o da un sito di tornei (es. Limitless): quantità, nome inglese, sigla e numero.</p>
  <label class="visually-hidden" for="deck-text">Lista del deck</label>
  <textarea
    id="deck-text"
    bind:value={text}
    oninput={() => (result = null)}
    rows="12"
    placeholder={'Pokémon: 16\n3 Miraidon ex SVI 81\n…\nTrainer: 34\n4 Nest Ball SVI 181\n…\nEnergy: 10\n10 Basic {L} Energy SVE 4'}
    spellcheck="false"
    autocapitalize="off"
  ></textarea>
  <div class="row">
    <button class="btn" onclick={paste}>Incolla</button>
    <span class="muted num">{parsed.lines.length} righe · {count} carte{parsed.errors.length ? ` · ${parsed.errors.length} da correggere` : ''}</span>
  </div>

  {#if parsed.errors.length}
    <section class="errors">
      <strong>Righe non riconosciute</strong>
      <ul>
        {#each parsed.errors as e (e.line)}<li><span class="num">Riga {e.line}:</span> “{e.raw}”</li>{/each}
      </ul>
      <span class="muted">Correggile nel riquadro (es. “3 Miraidon ex SVI 81”) o cancellale.</span>
    </section>
  {/if}

  <button class="btn primary" disabled={!parsed.lines.length || checking} onclick={check}>
    {checking ? `Cerco le carte… ${progress.done}/${progress.total}` : 'Controlla la lista'}
  </button>

  {#if result}
    <section class="result card">
      <strong class="num">
        {result.resolved.length} di {result.lines} righe trovate · {result.cards.reduce((n, c) => n + c.qty, 0)} carte
      </strong>
      {#if result.unresolved.length}
        <ul class="bad">
          {#each result.unresolved as u (u.line)}<li><span class="num">Riga {u.line}:</span> {u.raw} — {u.reason}</li>{/each}
        </ul>
        <span class="muted">Correggi le righe nel riquadro e ricontrolla, oppure crea il deck senza queste carte.</span>
      {/if}
      <label class="field">
        <span>Nome del deck</span>
        <input bind:value={name} placeholder="Es. Elettrico veloce" />
      </label>
      <button class="btn primary" disabled={!result.cards.length} onclick={create}>Crea deck</button>
    </section>
  {/if}
</div>

<style>
  .pad {
    padding: 8px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .muted {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  textarea {
    width: 100%;
    padding: 14px 16px;
    border-radius: var(--r-control);
    border: 1px solid var(--line-2);
    background: var(--surface);
    color: var(--text);
    font: 14px/1.5 ui-monospace, 'SF Mono', Menlo, monospace;
    resize: vertical;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .errors {
    padding: 14px 16px;
    border-radius: var(--r-control);
    border: 1px solid color-mix(in srgb, var(--danger) 50%, transparent);
    background: color-mix(in srgb, var(--danger) 8%, var(--surface));
    font-size: 14px;
  }

  .errors ul,
  .bad {
    margin: 6px 0;
    padding-left: 18px;
    font-size: 13px;
  }

  .bad {
    color: var(--danger);
  }

  .result {
    padding: 16px;
    border-radius: var(--r-section);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }

  .field input {
    min-height: 48px;
    padding: 0 16px;
    border-radius: var(--r-control);
    border: 1px solid var(--line-2);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    font-size: 16px;
  }
</style>
