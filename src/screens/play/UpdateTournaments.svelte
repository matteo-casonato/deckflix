<script>
  // @ts-check
  // "Aggiorna i tornei" from the tournaments list: the two steps (open pokedata's list, import
  // the saved file) without going to the settings.
  import Sheet from '../../lib/ui/Sheet.svelte';
  import { settings } from '../../lib/stores/settings.svelte.js';
  import { showToast } from '../../lib/stores/toast.svelte.js';
  import { importTournaments } from '../../lib/data/tournaments.js';
  import { nearbyEventsData } from '../../lib/domain/players.js';
  import { hrefFor } from '../../lib/domain/routes.js';

  /** @type {{ open: boolean, onclose: () => void }} */
  let { open, onclose } = $props();

  /** @param {Event & { currentTarget: HTMLInputElement }} e */
  async function pick(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const n = await importTournaments(file);
      showToast(`${n} tornei importati`);
      onclose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'File non valido');
    }
  }
</script>

<Sheet {open} title="Aggiorna i tornei" {onclose}>
  {#if settings.homePlace}
    <a class="btn" href={nearbyEventsData(settings.homePlace, settings.eventRadius, Date.now())} target="_blank" rel="noopener noreferrer">
      1 · Apri l’elenco dei tornei
    </a>
    <p class="note">Si apre una pagina di testo: in Chrome tocca ⋮ in alto e poi ⬇ per scaricarla (oppure Condividi › Salva su file).</p>
    <label class="btn primary file">
      2 · Importa il file scaricato
      <input class="visually-hidden" type="file" accept=".json,.ics,.txt,application/json,text/calendar,text/plain" onchange={pick} />
    </label>
    <p class="note">
      Usa questo elenco e non il calendario (.ics): solo l’elenco ha città, distanza e tipo di torneo.
      <a href={hrefFor('settings', { key: 'tornei' })}>{settings.homePlace.name} · {settings.eventRadius} km</a>
    </p>
  {:else}
    <a class="btn primary" href={hrefFor('settings', { key: 'tornei' })}>Imposta la città</a>
  {/if}
</Sheet>

<style>
  .note {
    margin: -4px 4px 0;
    font-size: 12px;
    color: var(--muted);
  }

  .note a {
    color: var(--accent);
  }

  .file {
    cursor: pointer;
  }
</style>
