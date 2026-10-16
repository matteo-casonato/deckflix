<script>
  // @ts-check
  // Scan › Foto: one photo of several cards laid out in a grid (a 3×3 binder page). The user
  // frames the grid and picks its size; each cell is read like a single scan, then all the
  // cards found go to the same review as the burst ("Rivedi N carte").
  import { ArrowLeft01Icon, Camera01Icon, Image01Icon } from '@hugeicons/core-free-icons';
  import Icon from '../../lib/ui/Icon.svelte';
  import BurstReview from './BurstReview.svelte';
  import { saveItems } from './saveItems.js';
  import { GRIDS, gridCells, moveCorner } from '../../lib/domain/grid.js';
  import { loadImage } from '../../lib/data/avatar.js';
  import { printsFor, recognize } from '../../lib/scan/pipeline.js';
  import { hrefFor } from '../../lib/domain/routes.js';
  import { back, replace } from '../../lib/router.svelte.js';
  import { showToast } from '../../lib/stores/toast.svelte.js';

  /** @typedef {import('./BurstReview.svelte').Item} Item */

  /** @type {HTMLImageElement | null} */
  let photo = $state(null);
  let rows = $state(3);
  let cols = $state(3);
  /** @type {import('../../lib/domain/grid.js').Frame} */
  let frame = $state({ x0: 0, y0: 0, x1: 1, y1: 1 });
  let phase = $state(/** @type {'pick' | 'frame' | 'work' | 'review'} */ ('pick'));
  let done = $state(0);
  /** @type {Item[]} */
  let items = $state([]);
  /** Cells not read or not found: their crop, to show and add by hand. */
  /** @type {{ n: number, src: string }[]} */
  let missed = $state([]);

  /** @param {Event & { currentTarget: HTMLInputElement }} e */
  async function pickFile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      if (photo) URL.revokeObjectURL(photo.src);
      photo = await loadImage(file);
      frame = { x0: 0, y0: 0, x1: 1, y1: 1 };
      phase = 'frame';
    } catch {
      showToast('Non riesco a leggere questa foto');
    }
  }

  // ---------- frame corners ----------
  /** @type {HTMLElement | null} */
  let stage = $state(null);
  /** @type {'tl' | 'tr' | 'bl' | 'br' | null} */
  let dragging = null;

  /** @param {'tl' | 'tr' | 'bl' | 'br'} corner @param {PointerEvent} e */
  function grab(corner, e) {
    dragging = corner;
    /** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
  }
  /** @param {PointerEvent} e */
  function drag(e) {
    if (!dragging || !stage) return;
    const r = stage.getBoundingClientRect();
    frame = moveCorner(frame, dragging, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }
  const drop = () => (dragging = null);

  // ---------- recognition ----------
  const total = $derived(rows * cols);

  async function run() {
    if (!photo) return;
    phase = 'work';
    done = 0;
    items = [];
    missed = [];
    const cells = gridCells({ width: photo.naturalWidth, height: photo.naturalHeight }, frame, rows, cols);
    let n = 0;
    for (const cell of cells) {
      n++;
      // Same size as a scan from the camera: enough for the small number at the bottom.
      const k = Math.min(1, 2400 / cell.h);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(cell.w * k));
      canvas.height = Math.max(1, Math.round(cell.h * k));
      /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true })).drawImage(
        photo,
        cell.x,
        cell.y,
        cell.w,
        cell.h,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      try {
        const r = await recognize(canvas);
        if (r.status === 'found') {
          const p = await printsFor(r.candidates[0], r);
          items.push({ id: Date.now() + n, rec: r, chosen: 0, lang: r.lang, variant: p.preselect, options: p.options });
        } else missed.push({ n, src: thumb(canvas) });
      } catch (err) {
        console.error(err);
        missed.push({ n, src: thumb(canvas) });
      }
      done = n;
    }
    phase = 'review';
  }

  /** Small preview of a cell for the "not read" list. @param {HTMLCanvasElement} canvas */
  function thumb(canvas) {
    const t = document.createElement('canvas');
    const k = 160 / canvas.height;
    t.width = Math.round(canvas.width * k);
    t.height = 160;
    /** @type {CanvasRenderingContext2D} */ (t.getContext('2d')).drawImage(canvas, 0, 0, t.width, t.height);
    return t.toDataURL('image/jpeg', 0.7);
  }

  async function save() {
    const list = items;
    items = [];
    await saveItems(list);
  }
</script>

{#if phase === 'review'}
  <BurstReview
    {items}
    onsave={save}
    onback={() => (phase = 'frame')}
    backLabel="Torna alla foto"
    onremove={(id) => (items = items.filter((i) => i.id !== id))}
  >
    {#if missed.length}
      <section class="missed card">
        <strong>{missed.length === 1 ? '1 carta non riconosciuta' : `${missed.length} carte non riconosciute`}</strong>
        <span class="muted">Aggiungile dopo con Scansiona o Per numero, o rifai la foto più vicina e con meno riflessi.</span>
        <div class="thumbs">
          {#each missed as m (m.n)}<figure><img src={m.src} alt="" /><figcaption class="num">{m.n}</figcaption></figure>{/each}
        </div>
      </section>
    {/if}
  </BurstReview>
{:else}
  <div class="photo">
    <header>
      <button class="round" aria-label="Esci dalla scansione" onclick={() => back(hrefFor('home'))}><Icon icon={ArrowLeft01Icon} size={20} /></button>
      <div class="modes" role="tablist" aria-label="Modalità">
        <button role="tab" aria-selected="false" onclick={() => replace(hrefFor('scan'))}>Singola</button>
        <button role="tab" aria-selected="false" onclick={() => replace(hrefFor('scan', {}, { mode: 'burst' }))}>Raffica</button>
        <button role="tab" aria-selected="true" class="on">Foto</button>
      </div>
      <span class="round-spacer"></span>
    </header>

    {#if phase === 'pick'}
      <section class="intro">
        <h1>Più carte in una foto</h1>
        <p class="muted">
          Metti le carte in griglia, dritte e vicine (per esempio una pagina del raccoglitore 3×3), con buona luce e senza
          riflessi. Poi inquadra solo le carte: l’app legge il numero in basso di ognuna.
        </p>
        <label class="btn primary file">
          <Icon icon={Camera01Icon} size={20} /> Scatta una foto
          <input class="visually-hidden" type="file" accept="image/*" capture="environment" onchange={pickFile} />
        </label>
        <label class="btn file">
          <Icon icon={Image01Icon} size={20} /> Scegli dalla galleria
          <input class="visually-hidden" type="file" accept="image/*" onchange={pickFile} />
        </label>
        <p class="muted small">Fino a 9–12 carte per foto: più sono piccole nella foto, più è difficile leggerle.</p>
      </section>
    {:else if photo}
      <p class="muted hint">Trascina gli angoli sulle carte esterne e scegli quante righe e colonne ci sono.</p>
      <div
        class="stage"
        bind:this={stage}
        style:aspect-ratio="{photo.naturalWidth} / {photo.naturalHeight}"
        style:width="min(100%, calc(62dvh * {photo.naturalWidth} / {photo.naturalHeight}))"
      >
        <img src={photo.src} alt="Foto delle carte" draggable="false" />
        <div
          class="frame"
          style:left="{frame.x0 * 100}%"
          style:top="{frame.y0 * 100}%"
          style:width="{(frame.x1 - frame.x0) * 100}%"
          style:height="{(frame.y1 - frame.y0) * 100}%"
        >
          {#each { length: cols - 1 } as _, i (i)}<span class="vline" style:left="{((i + 1) / cols) * 100}%"></span>{/each}
          {#each { length: rows - 1 } as _, i (i)}<span class="hline" style:top="{((i + 1) / rows) * 100}%"></span>{/each}
        </div>
        {#each [['tl', frame.x0, frame.y0], ['tr', frame.x1, frame.y0], ['bl', frame.x0, frame.y1], ['br', frame.x1, frame.y1]] as [c, x, y] (c)}
          <button
            class="handle"
            aria-label="Sposta l’angolo"
            style:left="{Number(x) * 100}%"
            style:top="{Number(y) * 100}%"
            disabled={phase === 'work'}
            onpointerdown={(e) => grab(/** @type {'tl' | 'tr' | 'bl' | 'br'} */ (c), e)}
            onpointermove={drag}
            onpointerup={drop}
            onpointercancel={drop}
          ></button>
        {/each}
      </div>

      <div class="chips" role="radiogroup" aria-label="Griglia">
        {#each GRIDS as [r, c] (`${r}x${c}`)}
          <button class="chip" role="radio" aria-checked={rows === r && cols === c} aria-pressed={rows === r && cols === c} disabled={phase === 'work'} onclick={() => ((rows = r), (cols = c))}>
            <span class="num">{r}×{c}</span>
          </button>
        {/each}
      </div>

      {#if phase === 'work'}
        <div class="progress" role="status">
          <span class="num">Leggo la carta {Math.min(done + 1, total)} di {total}…</span>
          <span class="bar"><span style:width="{(done / total) * 100}%"></span></span>
        </div>
      {:else}
        <div class="actions">
          <label class="btn file">
            Altra foto
            <input class="visually-hidden" type="file" accept="image/*" capture="environment" onchange={pickFile} />
          </label>
          <button class="btn primary" onclick={run}>Riconosci {total} carte</button>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .photo {
    min-height: 100dvh;
    max-width: 560px;
    margin-inline: auto;
    padding: calc(14px + var(--safe-top)) 16px calc(24px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    gap: 14px;
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

  .intro {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h1 {
    font-size: 26px;
  }

  .muted {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.45;
  }

  .small {
    font-size: 12px;
  }

  .file {
    gap: 8px;
    cursor: pointer;
  }

  .hint {
    font-size: 13px;
  }

  /* Width from the photo's proportions, so the frame (in %) sits exactly on the image. */
  .stage {
    position: relative;
    margin-inline: auto;
    border-radius: 12px;
    overflow: visible;
    touch-action: none;
    user-select: none;
  }

  .stage img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 12px;
    pointer-events: none;
  }

  .frame {
    position: absolute;
    border: 2px solid var(--accent);
    box-shadow: 0 0 0 9999px rgb(0 0 0 / 0.45);
    pointer-events: none;
  }

  .vline,
  .hline {
    position: absolute;
    background: rgb(255 203 69 / 0.8);
  }

  .vline {
    top: 0;
    bottom: 0;
    width: 1px;
  }

  .hline {
    left: 0;
    right: 0;
    height: 1px;
  }

  /* 44 px touch area, a 20 px dot. */
  .handle {
    position: absolute;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    touch-action: none;
    cursor: grab;
  }

  .handle::after {
    content: '';
    position: absolute;
    inset: 12px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 3px rgb(0 0 0 / 0.5);
  }

  .chips {
    flex-wrap: wrap;
    justify-content: center;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 10px;
  }

  .progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
  }

  .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }

  .missed {
    padding: 14px 16px;
    border-radius: var(--r-card);
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    color: var(--muted);
  }

  figure img {
    height: 80px;
    border-radius: 6px;
  }
</style>
