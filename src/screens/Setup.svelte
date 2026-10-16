<script>
  // @ts-check
  // First setup, after the Google screen: card language, home city for the tournaments, the
  // Play! player and the first card. Every step can be skipped; it can be run again from Profile.
  import Logo from '../lib/ui/Logo.svelte';
  import { account } from '../lib/stores/account.svelte.js';
  import { settings, setSetting } from '../lib/stores/settings.svelte.js';
  import { LANG_LABELS } from '../lib/domain/cards.js';
  import { ageDivision, validPlayerId } from '../lib/domain/players.js';
  import { currentPosition, geocodeCity } from '../lib/data/geocode.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { navigate } from '../lib/router.svelte.js';
  import { hasGoogleOcr } from '../lib/scan/ocr.js';
  import { showToast } from '../lib/stores/toast.svelte.js';

  // Faster scanning: Google's on-device text recognition needs a Chrome setting (Android).
  const FLAG = 'chrome://flags/#enable-experimental-web-platform-features';
  const isAndroid = /Android/i.test(navigator.userAgent);
  function copyFlag() {
    navigator.clipboard
      .writeText(FLAG)
      .then(() => showToast('Indirizzo copiato: incollalo nella barra di Chrome'))
      .catch(() => showToast(FLAG));
  }

  const STEPS = ['lang', 'city', 'player', 'card'];
  let step = $state(0);

  // ---------- city ----------
  let city = $state(settings.homePlace?.name ?? '');
  let locating = $state(false);
  /** @type {string | null} */
  let placeError = $state(null);

  async function findCity() {
    if (!city.trim()) return;
    locating = true;
    placeError = null;
    try {
      const place = await geocodeCity(city, settings.homePlace?.country || 'IT');
      if (!place) placeError = `Non trovo “${city.trim()}”: controlla il nome.`;
      else {
        await setSetting('homePlace', place);
        city = place.name;
      }
    } catch (err) {
      placeError = err instanceof Error ? err.message : String(err);
    } finally {
      locating = false;
    }
  }

  async function usePosition() {
    locating = true;
    placeError = null;
    try {
      const { lat, lng } = await currentPosition();
      await setSetting('homePlace', { name: 'La mia posizione', country: 'IT', lat, lng });
      city = 'La mia posizione';
    } catch (err) {
      placeError = err instanceof Error ? err.message : String(err);
    } finally {
      locating = false;
    }
  }

  // ---------- player ----------
  const me = settings.players[0];
  let name = $state(me?.name ?? account.user?.name ?? '');
  let playerId = $state(me?.playerId ?? '');
  let birthYear = $state(me ? String(me.birthYear) : '');
  const thisYear = new Date().getFullYear();
  const playerValid = $derived(
    name.trim().length > 1 && validPlayerId(playerId) && Number(birthYear) >= 1920 && Number(birthYear) <= thisYear,
  );

  async function savePlayer() {
    if (!playerValid) return;
    const player = { id: me?.id ?? crypto.randomUUID(), name: name.trim(), playerId: playerId.trim(), birthYear: Number(birthYear), avatar: me?.avatar ?? null };
    await setSetting('players', me ? settings.players.map((p) => (p.id === me.id ? player : p)) : [...settings.players, player]);
  }

  // ---------- flow ----------
  async function next() {
    if (STEPS[step] === 'player' && playerValid) await savePlayer();
    if (step < STEPS.length - 1) step += 1;
  }

  /** @param {string} [to] where to go after the setup */
  async function finish(to = hrefFor('home')) {
    await setSetting('setupDone', true);
    account.setup = false;
    navigate(to);
  }
</script>

<div class="setup">
  <header>
    <Logo size={22} />
    <button class="skip" onclick={() => finish()}>Salta tutto</button>
  </header>

  <ol class="dots" aria-label={`Passo ${step + 1} di ${STEPS.length}`}>
    {#each STEPS as s, i (s)}<li class:on={i <= step}></li>{/each}
  </ol>

  <section class="body">
    {#if STEPS[step] === 'lang'}
      <h1>In che lingua sono le tue carte?</h1>
      <p class="lead">Deckflix mostra nomi, ricerca e scansione in questa lingua. Le copie in altre lingue le aggiungi carta per carta.</p>
      <div class="choices" role="radiogroup" aria-label="Lingua delle carte">
        {#each Object.entries(LANG_LABELS) as [code, label] (code)}
          <button role="radio" aria-checked={settings.cardLang === code} onclick={() => setSetting('cardLang', code)}>{label}</button>
        {/each}
      </div>
    {:else if STEPS[step] === 'city'}
      <h1>Dove giochi?</h1>
      <p class="lead">Con la tua città vedi i tornei Play! Pokémon vicini: Challenge, Cup e pre-release, con la distanza.</p>
      <form
        class="row"
        onsubmit={(e) => {
          e.preventDefault();
          findCity();
        }}
      >
        <input bind:value={city} placeholder="Es. Treviso" autocomplete="address-level2" aria-label="Città" />
        <button class="btn" disabled={!city.trim() || locating}>{locating ? 'Cerco…' : 'Cerca'}</button>
      </form>
      <button class="btn" disabled={locating} onclick={usePosition}>Usa la posizione del telefono</button>
      {#if placeError}<p class="warn">{placeError}</p>{/if}
      {#if settings.homePlace}
        <p class="ok">✓ {settings.homePlace.name}</p>
        <div class="choices" role="radiogroup" aria-label="Raggio">
          {#each [25, 50, 100, 200] as km (km)}
            <button role="radio" aria-checked={settings.eventRadius === km} onclick={() => setSetting('eventRadius', km)}>{km} km</button>
          {/each}
        </div>
      {/if}
    {:else if STEPS[step] === 'player'}
      <h1>Giochi ai tornei?</h1>
      <p class="lead">Con il tuo ID giocatore Play! Pokémon l’app mostra il codice QR per la lega e la tua divisione.</p>
      <label><span>Nome e cognome</span><input bind:value={name} autocomplete="name" placeholder="Es. Alessio Rossi" /></label>
      <label><span>ID giocatore</span><input bind:value={playerId} inputmode="numeric" placeholder="Es. 4359311" maxlength="10" /></label>
      <label><span>Anno di nascita</span><input bind:value={birthYear} inputmode="numeric" placeholder="Es. 2015" maxlength="4" /></label>
      {#if Number(birthYear) >= 1920 && Number(birthYear) <= thisYear}
        <p class="ok">Divisione: {ageDivision(Number(birthYear), Date.now()) ?? '—'}</p>
      {/if}
      <p class="lead small">Altri giocatori (i tuoi figli, per esempio) e la foto li aggiungi da Play! › Giocatori.</p>
    {:else}
      <h1>Aggiungi la prima carta</h1>
      <p class="lead">Inquadra una carta e l’app la riconosce, oppure scrivi il numero stampato in basso, come 182/165.</p>
      <div class="cta">
        <button class="btn primary" onclick={() => finish(hrefFor('scan'))}>Scansiona una carta</button>
        <button class="btn" onclick={() => finish(hrefFor('quick'))}>Inserisci per numero</button>
      </div>
      {#if !hasGoogleOcr && isAndroid}
        <section class="tip card">
          <strong>Scansione più veloce (facoltativo)</strong>
          <p>
            Senza fare niente la scansione funziona, ma è più lenta. Con il riconoscimento del testo di Google, già nel telefono,
            è quasi istantanea: va attivato una volta in Chrome.
          </p>
          <p>
            <strong>Perché serve:</strong> Chrome permette ai siti e alle app web di usare quel riconoscimento solo tra le
            funzioni “sperimentali”, che sono spente finché non le accendi tu. Attivarle non cambia altro nel telefono e si possono
            rispegnere quando vuoi; il riconoscimento avviene sul telefono, le foto non vengono inviate a nessuno.
          </p>
          <ol>
            <li>Tocca <strong>Copia l’indirizzo</strong> qui sotto.</li>
            <li>Apri Chrome, incollalo nella barra degli indirizzi e premi Invio.</li>
            <li>Alla voce <strong>Experimental Web Platform features</strong> scegli <strong>Enabled</strong>.</li>
            <li>Tocca <strong>Relaunch</strong> in basso, poi riapri Deckflix.</li>
          </ol>
          <button class="btn" onclick={copyFlag}>Copia l’indirizzo</button>
        </section>
      {/if}
    {/if}
  </section>

  <footer>
    {#if step > 0}<button class="back" onclick={() => (step -= 1)}>Indietro</button>{/if}
    {#if STEPS[step] === 'card'}
      <button class="btn" onclick={() => finish()}>Più tardi</button>
    {:else}
      {@const filled = STEPS[step] === 'lang' || (STEPS[step] === 'city' && !!settings.homePlace) || (STEPS[step] === 'player' && playerValid)}
      <button class="btn" class:primary={filled} onclick={next}>{filled ? 'Avanti' : 'Salta'}</button>
    {/if}
  </footer>
</div>

<style>
  .setup {
    min-height: 100dvh;
    max-width: 480px;
    margin-inline: auto;
    padding: calc(14px + var(--safe-top)) 16px calc(20px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .skip {
    min-height: 48px;
    padding: 0 6px;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }

  .dots {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 6px;
  }

  .dots li {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--surface-2);
  }

  .dots li.on {
    background: var(--accent);
  }

  .body {
    flex: 1;
    padding-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  h1 {
    font-size: 28px;
    line-height: 1.15;
  }

  .lead {
    margin: 0;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.45;
  }

  .lead.small {
    font-size: 13px;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .choices button {
    min-height: 48px;
    padding: 0 18px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-chip);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .choices button[aria-checked='true'] {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }

  .row {
    display: flex;
    gap: 8px;
  }

  .row input {
    flex: 1;
    min-width: 0;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }

  input {
    min-height: 48px;
    padding: 0 16px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-control);
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }

  .ok {
    margin: 0;
    color: var(--success);
    font-weight: 600;
  }

  .warn {
    margin: 0;
    color: var(--danger);
    font-size: 14px;
  }

  .cta {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .tip {
    margin-top: 6px;
    padding: 14px 16px;
    border-radius: var(--r-card);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
  }

  .tip p strong {
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

  .tip li strong {
    color: var(--text);
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  footer .btn {
    min-width: 120px;
  }

  .back {
    margin-right: auto;
    min-height: 48px;
    padding: 0 6px;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>
