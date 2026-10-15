<script>
  // @ts-check
  // Scanner (SPEC § 4.1, docs/mockups/Raffica.html). Single: tap the camera to scan, then
  // confirm in the sheet. Burst: automatic shot when the card is still, queue, review and save.
  import { onMount } from 'svelte';
  import { ArrowLeft01Icon, FlashIcon, PauseIcon, Tick02Icon } from '@hugeicons/core-free-icons';
  import Icon from '../lib/ui/Icon.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';
  import ResultSheet from './scan/ResultSheet.svelte';
  import BurstReview from './scan/BurstReview.svelte';
  import { CameraError, closeCamera, createMotionMeter, grabCard, openCamera, setTorch, setZoom } from '../lib/scan/camera.js';
  import { hasGoogleOcr } from '../lib/scan/ocr.js';
  import { printsFor, recognize } from '../lib/scan/pipeline.js';
  import { changeCopies, restoreEntry } from '../lib/data/collection.js';
  import { collectionKey } from '../lib/domain/collection.js';
  import { hrefFor } from '../lib/domain/routes.js';
  import { back, navigate, replace } from '../lib/router.svelte.js';
  import { showToast } from '../lib/stores/toast.svelte.js';
  import { account } from '../lib/stores/account.svelte.js';

  /** @type {{ query: Record<string, string> }} */
  let { query } = $props();

  const mode = $derived(query.mode === 'burst' ? 'burst' : 'single');

  /** @type {HTMLVideoElement} */
  let video;
  /** @type {HTMLElement} */
  let guide;
  /** @type {import('../lib/scan/camera.js').Camera | null} */
  let cam = $state(null);
  /** @type {CameraError | null} */
  let camError = $state(null);
  let zoom = $state(1);
  let torch = $state(false);
  let busy = $state(false);

  /** @type {import('../lib/scan/pipeline.js').Recognition | null} */
  let rec = $state(null);

  /** @type {import('./scan/BurstReview.svelte').Item[]} */
  let items = $state([]);
  let paused = $state(false);
  let reviewing = $state(false);
  let confirmExit = $state(false);
  /** @type {{ text: string, ok: boolean } | null} */
  let pill = $state(null);
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let pillTimer;

  /** @param {string} text @param {boolean} ok */
  function flash(text, ok) {
    clearTimeout(pillTimer);
    pill = { text, ok };
    pillTimer = setTimeout(() => (pill = null), 2200);
  }

  /** @param {boolean} ok */
  const buzz = (ok) => navigator.vibrate?.(ok ? 30 : [30, 60, 30]);

  // ---------- camera, screen wake lock ----------

  /** @type {WakeLockSentinel | null} */
  let wakeLock = null;
  async function keepAwake() {
    try {
      wakeLock = await navigator.wakeLock?.request('screen');
    } catch {}
  }

  async function start() {
    camError = null;
    try {
      cam = await openCamera(video);
      zoom = cam.zoom ? Number((/** @type {any} */ (cam.track.getSettings()).zoom ?? cam.zoom.min)) : 1;
    } catch (err) {
      camError = err instanceof CameraError ? err : new CameraError('unavailable', String(err));
    }
  }

  function onVisibility() {
    if (document.visibilityState === 'visible') keepAwake();
    else {
      wakeLock?.release().catch(() => {});
      paused = true;
    }
  }

  onMount(() => {
    start();
    keepAwake();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('popstate', onPopState);
    return () => {
      closeCamera(cam);
      wakeLock?.release().catch(() => {});
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('popstate', onPopState);
      clearInterval(loop);
    };
  });

  // ---------- single mode ----------

  /** Android back closes the sheet first (CLAUDE.md UI guidelines). */
  function onPopState() {
    if (rec) rec = null;
  }

  function closeSheet() {
    if (history.state?.scanSheet) history.back();
    else rec = null;
  }

  async function shoot() {
    if (!cam || busy || rec || !video.videoWidth) return;
    busy = true;
    try {
      const r = await recognize(grabCard(video, guide, 2400));
      buzz(r.status === 'found' && !r.uncertain);
      rec = r;
      history.pushState({ ...history.state, scanSheet: true }, '');
    } catch (err) {
      flash('Errore nella lettura: riprova', false);
      console.error(err);
    } finally {
      busy = false;
    }
  }

  /** @param {{ cardId: string, lang: string, variant: string, name: string, localId: string }} s */
  async function addFromSheet(s) {
    const before = await changeCopies(s, 1);
    buzz(true);
    showToast(`${s.name} · ${s.localId} ${before ? `→ ${before.qty + 1}` : 'aggiunta'}`, () =>
      restoreEntry(collectionKey(s.cardId, s.lang, s.variant), before),
    );
    closeSheet();
  }

  // ---------- burst mode ----------

  const meter = createMotionMeter();
  /** Needs movement before the next shot, so the same card isn't taken twice. */
  let armed = true;
  let still = 0;
  let nextId = 1;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let loop;

  const MOVING = 10;
  const STILL = 3.5;
  const NO_CARD = 14;

  async function burstTick() {
    if (mode !== 'burst' || paused || busy || reviewing || !cam || !video.videoWidth) return;
    const { diff, contrast } = meter.sample(video, guide);
    // No card in the guide (a plain table): wait, and count it as movement for the next card.
    if (contrast < NO_CARD) {
      armed = true;
      still = 0;
      return;
    }
    if (diff > MOVING) {
      armed = true;
      still = 0;
      return;
    }
    still = diff < STILL ? still + 1 : 0;
    if (!armed || still < 3) return;
    armed = false;
    busy = true;
    try {
      const canvas = grabCard(video, guide, 2400);
      const r = await recognize(canvas);
      if (r.status !== 'found') {
        buzz(false);
        flash(r.status === 'unread' ? 'Numero non letto: muovi la carta e riprova' : 'Carta non trovata', false);
        armed = true;
        return;
      }
      const c = r.candidates[0];
      const last = items.at(-1);
      if (last && last.rec.candidates[last.chosen]?.id === c.id && Date.now() - last.id < 4000) {
        flash('Già in coda', true);
        return;
      }
      const p = await printsFor(c, r);
      items.push({ id: Date.now() + nextId++, rec: r, chosen: 0, lang: r.lang, variant: p.preselect, options: p.options });
      buzz(!r.uncertain);
      flash(`${c.name} · ${c.localId}/${c.official || '?'} ${r.uncertain ? 'da verificare' : 'aggiunta'}`, !r.uncertain);
    } catch (err) {
      console.error(err);
      armed = true;
    } finally {
      busy = false;
    }
  }

  $effect(() => {
    clearInterval(loop);
    if (mode === 'burst') {
      meter.reset();
      armed = true;
      loop = setInterval(burstTick, 250);
    }
    return () => clearInterval(loop);
  });

  async function saveAll() {
    const saved = [];
    for (const it of items) {
      const c = it.rec.candidates[it.chosen];
      if (!c) continue;
      const copy = { cardId: c.id, lang: it.lang, variant: it.variant };
      saved.push({ key: collectionKey(copy.cardId, copy.lang, copy.variant), before: await changeCopies(copy, 1) });
    }
    const n = saved.length;
    items = [];
    reviewing = false;
    showToast(`${n} ${n === 1 ? 'carta salvata' : 'carte salvate'} nella collezione`, async () => {
      for (const s of saved.reverse()) await restoreEntry(s.key, s.before);
    });
    navigate(hrefFor('collection', {}, { view: 'recent' }));
  }

  function exit() {
    if (items.length) confirmExit = true;
    else back(hrefFor('home'));
  }

  /** @param {'single' | 'burst'} m */
  const setMode = (m) => replace(hrefFor('scan', {}, { mode: m === 'burst' ? 'burst' : null }));
</script>

{#if reviewing}
  <BurstReview {items} onsave={saveAll} onback={() => (reviewing = false)} onremove={(id) => (items = items.filter((i) => i.id !== id))} />
{:else}
  <div class="scan">
    <header>
      <button class="round" aria-label="Esci dalla scansione" onclick={exit}><Icon icon={ArrowLeft01Icon} size={20} /></button>
      <div class="modes" role="tablist" aria-label="Modalità">
        <button role="tab" aria-selected={mode === 'single'} class:on={mode === 'single'} onclick={() => setMode('single')}>Singola</button>
        <button role="tab" aria-selected={mode === 'burst'} class:on={mode === 'burst'} onclick={() => setMode('burst')}>
          Raffica{items.length ? ` · ${items.length}` : ''}
        </button>
      </div>
      {#if cam?.torch}
        <button
          class="round"
          class:on={torch}
          aria-pressed={torch}
          aria-label={torch ? 'Spegni la torcia' : 'Accendi la torcia'}
          onclick={() => cam && setTorch(cam.track, !torch).then(() => (torch = !torch)).catch(() => {})}
        >
          <Icon icon={FlashIcon} size={20} />
        </button>
      {:else}
        <span class="round-spacer"></span>
      {/if}
    </header>

    <button
      class="viewer"
      aria-label={mode === 'single' ? 'Tocca per riconoscere la carta' : 'Inquadratura della fotocamera'}
      disabled={mode !== 'single' || !cam || busy || !!rec}
      onclick={shoot}
    >
      <video bind:this={video} playsinline muted></video>
      <span class="guide" bind:this={guide}></span>
      {#if pill}
        <span class="pill" class:bad={!pill.ok} role="status">
          {#if pill.ok}<span class="tick"><Icon icon={Tick02Icon} size={16} /></span>{/if}
          {pill.text}
        </span>
      {/if}
      {#if camError}
        <span class="msg">
          {#if camError.kind === 'denied'}
            Accesso alla fotocamera negato. In Chrome tocca il lucchetto accanto all’indirizzo → Autorizzazioni → Fotocamera → Consenti, poi ricarica.
          {:else}
            {camError.message}.
          {/if}
        </span>
      {:else if busy}
        <span class="hint">Riconosco la carta…</span>
      {:else if cam}
        <span class="hint">
          {mode === 'single' ? 'Tocca per scattare' : paused ? 'In pausa' : 'Scatto automatico quando la carta è ferma'}
        </span>
      {:else}
        <span class="hint">Avvio fotocamera…</span>
      {/if}
    </button>

    {#if cam?.zoom}
      <label class="zoom">
        <span>Zoom <span class="num">×{zoom.toFixed(1)}</span></span>
        <input
          type="range"
          min={cam.zoom.min}
          max={cam.zoom.max}
          step={cam.zoom.step}
          bind:value={zoom}
          oninput={() => cam && setZoom(cam.track, zoom)}
        />
      </label>
    {/if}

    {#if camError}
      <div class="row-actions">
        <a class="btn" href={hrefFor('quick')}>Inserimento rapido</a>
        <button class="btn primary" onclick={start}>Riprova</button>
      </div>
    {/if}

    {#if !hasGoogleOcr && cam}
      <p class="note">
        Riconoscimento lento: per l’OCR di Google apri <span class="num">chrome://flags</span>, attiva “Experimental Web Platform features” e
        riavvia Chrome.
      </p>
    {/if}

    {#if mode === 'burst'}
      <section class="queue card">
        <div class="qhead">
          <strong>In coda</strong>
          <span class="muted">
            {items.length
              ? `Verranno salvate nella ${account.user ? `collezione di ${account.user.givenName || account.user.name}` : 'tua collezione'}`
              : 'Le carte riconosciute compaiono qui'}
          </span>
        </div>
        {#if items.length}
          <div class="thumbs">
            {#each items.slice(-5) as it (it.id)}
              {@const c = it.rec.candidates[it.chosen]}
              {#if c?.image}<img src={`${c.image}/low.webp`} alt={c.name} class:warn={it.rec.uncertain} />{:else}<span class="t"></span>{/if}
            {/each}
            {#if items.length > 5}<span class="t more num">+{items.length - 5}</span>{/if}
          </div>
        {/if}
        <div class="qactions">
          <button class="round big" aria-pressed={paused} aria-label={paused ? 'Riprendi' : 'Pausa'} onclick={() => (paused = !paused)}>
            <Icon icon={PauseIcon} size={22} />
          </button>
          <button class="btn primary save" disabled={!items.length} onclick={() => (reviewing = true)}>
            Rivedi e salva {items.length} {items.length === 1 ? 'carta' : 'carte'}
          </button>
        </div>
      </section>
    {/if}
  </div>
{/if}

{#if rec}
  <button class="scrim" aria-label="Chiudi" onclick={closeSheet}></button>
  <ResultSheet {rec} onadd={addFromSheet} onretry={closeSheet} />
{/if}

<ConfirmDialog
  open={confirmExit}
  title="Uscire senza salvare?"
  text={`Hai ${items.length} ${items.length === 1 ? 'carta' : 'carte'} in coda che non sono ancora nella collezione.`}
  confirmLabel="Esci"
  danger
  onconfirm={() => back(hrefFor('home'))}
  onclose={() => (confirmExit = false)}
/>

<style>
  .scan {
    min-height: 100dvh;
    max-width: 560px;
    margin-inline: auto;
    padding: calc(14px + var(--safe-top)) 16px calc(16px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .round,
  .round-spacer {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }

  .round {
    border: 0;
    border-radius: var(--r-card);
    background: var(--surface);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .round.on,
  .round[aria-pressed='true'] {
    background: var(--accent);
    color: var(--on-accent);
  }

  .modes {
    display: flex;
    padding: 4px;
    gap: 4px;
    border-radius: 26px;
    background: var(--surface);
  }

  .modes button {
    min-height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 22px;
    background: transparent;
    color: var(--muted);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .modes button.on {
    background: var(--line-2);
    color: var(--text);
  }

  .viewer {
    position: relative;
    aspect-ratio: 63 / 88;
    width: min(100%, calc(64svh * 63 / 88));
    margin-inline: auto;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 40px;
    overflow: hidden;
    background: #08090b;
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }

  .viewer:disabled {
    cursor: default;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .guide {
    position: absolute;
    left: 50%;
    top: 50%;
    height: 90%;
    aspect-ratio: 63 / 88;
    transform: translate(-50%, -50%);
    border: 2px solid var(--accent);
    border-radius: 18px;
    box-shadow: 0 0 0 100vmax rgb(8 9 11 / 0.45);
    pointer-events: none;
  }

  .pill {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100% - 32px);
    min-height: 40px;
    padding: 6px 14px 6px 6px;
    border-radius: 26px;
    background: var(--surface-2);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    animation: drop var(--dur) var(--ease);
  }

  .pill.bad {
    padding-left: 14px;
    color: var(--danger);
  }

  .tick {
    width: 28px;
    height: 28px;
    border-radius: 14px;
    background: var(--text);
    color: var(--on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  @keyframes drop {
    from {
      transform: translate(-50%, -8px);
      opacity: 0;
    }
  }

  .hint,
  .msg {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 2px;
    text-align: center;
    font-size: 13px;
    color: var(--text);
    text-shadow: 0 1px 4px rgb(0 0 0 / 0.8);
  }

  .msg {
    top: 50%;
    bottom: auto;
    transform: translateY(-50%);
    font-size: 14px;
    line-height: 1.45;
  }

  .zoom {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: var(--muted);
  }

  .zoom input {
    flex: 1;
    min-height: 40px;
    accent-color: var(--accent);
  }

  .row-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .note {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }

  .queue {
    padding: 16px;
    border-radius: var(--r-section);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .qhead {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .qhead strong {
    font-size: 17px;
  }

  .muted {
    font-size: 12px;
    color: var(--muted);
  }

  .thumbs {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
  }

  .thumbs img,
  .t {
    width: 100%;
    aspect-ratio: 63 / 88;
    border-radius: 8px;
    background: var(--surface-2);
    object-fit: cover;
  }

  .thumbs img.warn {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .more {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: var(--muted);
  }

  .qactions {
    display: flex;
    gap: 10px;
  }

  .round.big {
    width: 56px;
    height: 56px;
    background: var(--surface-2);
  }

  .save {
    flex: 1;
    min-height: 56px;
    font-size: 16px;
  }

  .scrim {
    position: fixed;
    inset: 0;
    z-index: 24;
    border: 0;
    background: rgb(0 0 0 / 0.45);
  }
</style>
