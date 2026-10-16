<script>
  // @ts-check
  // Profile › Impostazioni: one page per setting (language, quality and prices, editions,
  // images and storage), each with what it does and why.
  import { settings, setSetting } from '../lib/stores/settings.svelte.js';
  import { LANG_LABELS } from '../lib/domain/cards.js';
  import { CONDITIONS, DEFAULT_CONDITION_FACTORS } from '../lib/domain/collection.js';
  import { clearImageCache, imageCacheInfo } from '../lib/data/imageCache.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import BackHeader from '../lib/ui/BackHeader.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';

  /** @type {{ key: string }} */
  let { key } = $props();

  const TITLES = /** @type {Record<string, string>} */ ({
    lingua: 'Lingua delle carte',
    qualita: 'Qualità e prezzi',
    edizioni: 'Edizioni',
    immagini: 'Immagini e spazio',
  });

  // ---------- quality ----------
  /** @param {string} code @param {string} value */
  function setFactor(code, value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 0 || n > 300) return;
    setSetting('conditionFactors', { ...settings.conditionFactors, [code]: n });
  }
  const isDefault = $derived(CONDITIONS.every(([c]) => (settings.conditionFactors[c] ?? DEFAULT_CONDITION_FACTORS[c]) === DEFAULT_CONDITION_FACTORS[c]));

  // ---------- images ----------
  /** @type {{ images: number, usageMb: number | null } | null} */
  let cache = $state(null);
  let confirmClear = $state(false);
  const refreshCache = () => imageCacheInfo().then((c) => (cache = c));
  $effect(() => {
    if (key === 'immagini') refreshCache();
  });
</script>

<BackHeader title={TITLES[key] ?? 'Impostazioni'} big fallback={hrefFor('profile')} />

<div class="page">
  {#if key === 'lingua'}
    <p class="intro">Lingua in cui l’app mostra nomi, ricerca e immagini delle carte. Le copie possono essere in un’altra lingua: la scegli su ogni carta.</p>
    <ul class="choices card" role="radiogroup" aria-label="Lingua delle carte">
      {#each Object.entries(LANG_LABELS) as [code, label] (code)}
        <li>
          <button role="radio" aria-checked={settings.cardLang === code} onclick={() => setSetting('cardLang', code)}>
            <span>{label}</span>
            <span class="dot" aria-hidden="true"></span>
          </button>
        </li>
      {/each}
    </ul>
    <p class="note">Se una carta non esiste nella lingua scelta (succede con le carte vecchie), l’app mostra quella inglese.</p>
  {:else if key === 'qualita'}
    <section class="explain card">
      <h2>Come si calcola il valore</h2>
      <p>
        I prezzi arrivano da Cardmarket tramite TCGdex e sono <strong>medie di tutte le lingue e di tutte le condizioni</strong>:
        una carta Near Mint e una rovinata finiscono nella stessa media.
      </p>
      <p>
        Per avvicinarsi al valore reale delle tue copie, l’app applica al prezzo una <strong>percentuale in base alla condizione</strong>
        che hai indicato (Near Mint se non l’hai cambiata). Il risultato è una <strong>stima</strong>: vale per il valore della
        collezione, delle edizioni, delle raccolte e per le statistiche.
      </p>
      <h2>Perché non il prezzo esatto</h2>
      <p>
        Cardmarket ha i prezzi per condizione, ma li dà solo ai venditori registrati, con un’autorizzazione da richiedere e un
        server che custodisca le credenziali. Deckflix è gratuita e senza server, quindi usa le medie pubbliche e la stima.
      </p>
      <p>Per il prezzo vero apri la carta su Cardmarket dalla sua scheda: vedi le offerte nella lingua e nella condizione della tua copia.</p>
    </section>

    <h2 class="label">Percentuale del prezzo per condizione</h2>
    <ul class="factors card">
      {#each CONDITIONS as [code, label] (code)}
        <li>
          <label for={`f-${code}`}>
            <strong>{label}</strong>
            <span class="muted">{code}</span>
          </label>
          <span class="pct">
            <input
              id={`f-${code}`}
              type="number"
              inputmode="numeric"
              min="0"
              max="300"
              step="5"
              value={settings.conditionFactors[code] ?? DEFAULT_CONDITION_FACTORS[code]}
              onchange={(e) => setFactor(code, e.currentTarget.value)}
            />
            <span aria-hidden="true">%</span>
          </span>
        </li>
      {/each}
    </ul>
    <button class="btn" disabled={isDefault} onclick={() => setSetting('conditionFactors', { ...DEFAULT_CONDITION_FACTORS })}>Ripristina i valori consigliati</button>
    <p class="note">Valori orientativi usati da molti collezionisti. Near Mint al 100% corrisponde al prezzo Cardmarket.</p>
  {:else if key === 'edizioni'}
    <label class="toggle card">
      <span>
        <strong>Carte mancanti in grigio</strong>
        <span class="muted">Nel raccoglitore di ogni edizione le carte che non hai mostrano l’immagine in grigio.</span>
      </span>
      <input class="switch" type="checkbox" role="switch" checked={settings.missingImages} onchange={(e) => setSetting('missingImages', e.currentTarget.checked)} />
    </label>
    <p class="note">Spento, le mancanti mostrano solo il numero: la pagina si carica più in fretta e usa meno dati.</p>
  {:else if key === 'immagini'}
    <section class="explain card">
      <h2>Immagini salvate</h2>
      <p class="num">
        {!cache
          ? 'Calcolo…'
          : `${cache.images} ${cache.images === 1 ? 'immagine' : 'immagini'} di carte sul telefono${cache.usageMb != null ? ` · l’app occupa ${cache.usageMb} MB in tutto` : ''}.`}
      </p>
      <p>Servono per vedere le carte anche offline. Svuotandole si riscaricano quando apri le carte; la collezione non cambia.</p>
      <button class="btn" disabled={!cache || cache.images === 0} onclick={() => (confirmClear = true)}>Svuota la cache immagini</button>
    </section>
    <section class="explain card">
      <h2>Dati protetti sul telefono</h2>
      <p>
        {settings.persisted === null
          ? 'Verifica in corso…'
          : settings.persisted
            ? 'Sì: il browser non cancella la collezione quando manca spazio.'
            : 'No: se manca spazio il browser potrebbe cancellare i dati. Installare l’app (Aggiungi a schermata Home) aiuta; il backup su Google Drive li mette comunque al sicuro.'}
      </p>
    </section>
  {:else}
    <p class="intro">Impostazione non trovata.</p>
  {/if}
</div>

<ConfirmDialog
  open={confirmClear}
  title="Svuotare la cache delle immagini?"
  text="Le immagini delle carte verranno scaricate di nuovo quando le apri. La collezione non cambia."
  confirmLabel="Svuota"
  onconfirm={() => clearImageCache().then(refreshCache)}
  onclose={() => (confirmClear = false)}
/>

<style>
  .page {
    padding: 0 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .intro,
  .note {
    margin: 0;
    padding: 0 4px;
    font-size: 13px;
    color: var(--muted);
  }

  .intro {
    font-size: 14px;
  }

  .muted {
    font-size: 12px;
    color: var(--muted);
  }

  .card {
    border-radius: var(--r-section);
    background: var(--surface);
  }

  .choices,
  .factors {
    list-style: none;
    margin: 0;
    padding: 4px;
  }

  .choices button {
    width: 100%;
    min-height: 56px;
    padding: 0 16px;
    border: 0;
    border-radius: 24px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 15px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .dot {
    width: 22px;
    height: 22px;
    border-radius: 11px;
    border: 2px solid var(--line-2);
  }

  .choices button[aria-checked='true'] .dot {
    border: 7px solid var(--accent);
  }

  .explain {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--muted);
  }

  .explain h2 {
    font-size: 16px;
    color: var(--text);
  }

  .explain p {
    margin: 0;
  }

  .explain strong {
    color: var(--text);
  }

  .label {
    margin: 8px 4px 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .factors li {
    min-height: 56px;
    padding: 4px 12px 4px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .factors li + li {
    border-top: 1px solid var(--line);
  }

  .factors label {
    display: flex;
    flex-direction: column;
  }

  .pct {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
  }

  .pct input {
    width: 76px;
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--line-2);
    border-radius: 14px;
    background: var(--bg);
    color: var(--text);
    font: inherit;
    font-weight: 700;
    text-align: right;
  }

  .toggle {
    min-height: 72px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .toggle > span {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .switch {
    appearance: none;
    flex-shrink: 0;
    width: 52px;
    height: 32px;
    margin: 0;
    border-radius: 16px;
    background: var(--line-2);
    position: relative;
    cursor: pointer;
    transition: background 150ms;
  }

  .switch::after {
    content: '';
    position: absolute;
    top: 4px;
    left: 4px;
    width: 24px;
    height: 24px;
    border-radius: 12px;
    background: var(--muted);
    transition: transform 150ms;
  }

  .switch:checked {
    background: var(--accent);
  }

  .switch:checked::after {
    background: var(--on-accent);
    transform: translateX(20px);
  }
</style>
