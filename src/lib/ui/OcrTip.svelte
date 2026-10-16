<script>
  // @ts-check
  // How to turn on Google's on-device text recognition in Chrome (Android), which makes card
  // scanning almost instant: why it is needed and the steps, with a button that copies the
  // flags address (chrome:// pages can't be opened from a link). Used by the first setup and
  // by Profile › Impostazioni › Scansione.
  import { showToast } from '../stores/toast.svelte.js';

  /** @type {{ title?: string | null }} */
  let { title = 'Scansione più veloce (facoltativo)' } = $props();

  const FLAG = 'chrome://flags/#enable-experimental-web-platform-features';
  function copyFlag() {
    navigator.clipboard
      .writeText(FLAG)
      .then(() => showToast('Indirizzo copiato: incollalo nella barra di Chrome'))
      .catch(() => showToast(FLAG));
  }
</script>

<section class="tip card">
  {#if title}<strong class="title">{title}</strong>{/if}
  <p>
    Senza fare niente la scansione funziona, ma è più lenta. Con il riconoscimento del testo di Google, già nel telefono, è
    quasi istantanea: va attivato una volta in Chrome.
  </p>
  <p>
    <strong>Perché serve:</strong> Chrome permette ai siti e alle app web di usare quel riconoscimento solo tra le funzioni
    “sperimentali”, che sono spente finché non le accendi tu. Attivarle non cambia altro nel telefono e si possono rispegnere
    quando vuoi; il riconoscimento avviene sul telefono, le foto non vengono inviate a nessuno.
  </p>
  <ol>
    <li>Tocca <strong>Copia l’indirizzo</strong> qui sotto.</li>
    <li>Apri Chrome, incollalo nella barra degli indirizzi e premi Invio.</li>
    <li>Alla voce <strong>Experimental Web Platform features</strong> scegli <strong>Enabled</strong>.</li>
    <li>Tocca <strong>Relaunch</strong> in basso, poi riapri Deckflix.</li>
  </ol>
  <button class="btn" onclick={copyFlag}>Copia l’indirizzo</button>
</section>

<style>
  .tip {
    padding: 14px 16px;
    border-radius: var(--r-card);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
  }

  .title {
    color: var(--text);
  }

  .tip p,
  .tip ol {
    margin: 0;
    color: var(--muted);
    line-height: 1.45;
  }

  .tip ol {
    padding-left: 20px;
  }

  .tip p strong,
  .tip li strong {
    color: var(--text);
  }
</style>
