<script>
  // @ts-check
  // The two steps to bring pokedata's list into the app: open it, then copy all the text and
  // paste it here (Chrome on Android has no reliable "download" for a text page). A file saved
  // some other way can still be imported.
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { showToast } from '../../lib/stores/toast.svelte.js';
  import { importTournaments, importTournamentsText } from '../../lib/data/tournaments.js';
  import { nearbyEventsData } from '../../lib/domain/players.js';

  /** @type {{ ondone?: () => void }} */
  let { ondone } = $props();

  /** Shown when the clipboard can't be read: the user pastes by hand. */
  let manual = $state(false);
  let pasted = $state('');

  /** @param {string} text */
  async function load(text) {
    try {
      const n = await importTournamentsText(text);
      showToast(`${n} tornei importati`);
      manual = false;
      pasted = '';
      ondone?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Testo non valido');
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) return load(text);
      showToast('Gli appunti sono vuoti: copia prima il testo dell’elenco');
    } catch {
      manual = true;
    }
  }

  /** @param {Event & { currentTarget: HTMLInputElement }} e */
  async function pickFile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const n = await importTournaments(file);
      showToast(`${n} tornei importati`);
      ondone?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'File non valido');
    }
  }
</script>

{#if settings.homePlace}
  <a class="btn" href={nearbyEventsData(settings.homePlace, settings.eventRadius, Date.now())} target="_blank" rel="noopener noreferrer">
    1 · Apri l’elenco dei tornei
  </a>
  <p class="note">Si apre una pagina di testo: tieni premuto sul testo, tocca <strong>Seleziona tutto</strong> e poi <strong>Copia</strong>. Poi torna qui.</p>
  <button class="btn primary" onclick={paste}>2 · Incolla l’elenco</button>
  {#if manual}
    <label class="manual">
      <span>Tieni premuto nel riquadro e scegli Incolla</span>
      <textarea bind:value={pasted} rows="3" placeholder="Incolla qui il testo dell’elenco" oninput={() => pasted.trim().endsWith(']') && load(pasted)}></textarea>
    </label>
    {#if pasted.trim()}<button class="btn" onclick={() => load(pasted)}>Importa il testo incollato</button>{/if}
  {/if}
  <label class="file-link">
    Hai salvato l’elenco come file? <span>Importa il file</span>
    <input class="visually-hidden" type="file" accept=".json,.ics,.txt,application/json,text/calendar,text/plain" onchange={pickFile} />
  </label>
{:else}
  <p class="note">Prima imposta la tua città.</p>
{/if}

<style>
  .note {
    margin: -4px 4px 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--muted);
  }

  .manual {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }

  textarea {
    padding: 12px 14px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-control);
    background: var(--bg);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    resize: vertical;
  }

  .file-link {
    min-height: 44px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
    cursor: pointer;
  }

  .file-link span {
    color: var(--accent);
    font-weight: 700;
  }
</style>
