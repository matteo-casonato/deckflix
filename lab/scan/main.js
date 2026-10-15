// @ts-check
// Phase 0 scan prototype: camera → crop top/bottom strips → Tesseract.js → TCGdex lookup.
// No persistence except the test log in localStorage. The photo is never stored.
import { createWorker, PSM } from 'tesseract.js';
import { parseCollectorNumber, parseSetCode, detectLanguage } from './recognize.js';
import { findWithCorrections } from './tcgdex.js';

/** @template {HTMLElement} T @param {string} id @returns {T} */
const $ = (id) => /** @type {T} */ (document.getElementById(id));

const video = /** @type {HTMLVideoElement} */ ($('video'));
const viewer = $('viewer');
const guide = $('guide');
const shootBtn = /** @type {HTMLButtonElement} */ ($('shoot'));
const torchBtn = /** @type {HTMLButtonElement} */ ($('torch'));
const statusEl = $('status');
const viewerMsg = $('viewerMsg');

const controls = {
  topEnd: /** @type {HTMLInputElement} */ ($('topEnd')),
  bottomStart: /** @type {HTMLInputElement} */ ($('bottomStart')),
  contrast: /** @type {HTMLInputElement} */ ($('contrast')),
  scale: /** @type {HTMLInputElement} */ ($('scale')),
  threshold: /** @type {HTMLInputElement} */ ($('threshold')),
  invert: /** @type {HTMLInputElement} */ ($('invert')),
  ocrLangs: /** @type {HTMLSelectElement} */ ($('ocrLangs')),
};

const SETTINGS_KEY = 'deckflix-lab-settings';
const LOG_KEY = 'deckflix-lab-log';

// ---------- settings ----------

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    for (const [k, el] of Object.entries(controls)) {
      if (!(k in saved)) continue;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = saved[k];
      else el.value = saved[k];
    }
  } catch {}
}

function readSettings() {
  return {
    topEnd: Number(controls.topEnd.value) / 100,
    bottomStart: Number(controls.bottomStart.value) / 100,
    contrast: Number(controls.contrast.value),
    scale: Number(controls.scale.value),
    threshold: controls.threshold.checked,
    invert: controls.invert.checked,
    ocrLangs: controls.ocrLangs.value,
  };
}

function renderSettings() {
  const s = readSettings();
  $('topOut').textContent = `0–${Math.round(s.topEnd * 100)}%`;
  $('bottomOut').textContent = `${Math.round(s.bottomStart * 100)}%`;
  $('contrastOut').textContent = `×${s.contrast.toFixed(1)}`;
  $('scaleOut').textContent = `×${s.scale}`;
  $('topBand').style.height = `${s.topEnd * 100}%`;
  $('bottomBand').style.height = `${(1 - s.bottomStart) * 100}%`;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

// ---------- OCR worker ----------

/** @type {import('tesseract.js').Worker | null} */
let worker = null;
let workerLangs = '';

async function ensureWorker() {
  const langs = readSettings().ocrLangs;
  if (worker && workerLangs === langs) return worker;
  if (worker) await worker.terminate();
  worker = null;
  shootBtn.disabled = true;
  statusEl.textContent = `Caricamento OCR (${langs})…`;
  const w = await createWorker(langs.split('+'), 1, {
    logger: (m) => {
      if (m.status && m.progress < 1) statusEl.textContent = `OCR: ${m.status} ${Math.round(m.progress * 100)}%`;
    },
  });
  worker = w;
  workerLangs = langs;
  statusEl.textContent = 'Pronto. Inquadra la carta dentro la cornice.';
  shootBtn.disabled = !video.srcObject;
  return w;
}

// ---------- camera ----------

/** @type {MediaStreamTrack | null} */
let track = null;

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    viewerMsg.textContent = 'Fotocamera non disponibile: serve HTTPS. Usa "Carica foto".';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    track = stream.getVideoTracks()[0];
    viewerMsg.textContent = '';
    shootBtn.disabled = !worker;
    const caps = /** @type {any} */ (track.getCapabilities?.() ?? {});
    if (caps.torch) torchBtn.hidden = false;
  } catch (err) {
    console.error(err);
    viewerMsg.textContent =
      'Accesso alla fotocamera negato. Riattivalo dalle impostazioni del sito in Chrome, oppure usa "Carica foto".';
  }
}

torchBtn.addEventListener('click', async () => {
  if (!track) return;
  const on = torchBtn.getAttribute('aria-pressed') !== 'true';
  try {
    await track.applyConstraints(/** @type {any} */ ({ advanced: [{ torch: on }] }));
    torchBtn.setAttribute('aria-pressed', String(on));
    torchBtn.setAttribute('aria-label', on ? 'Spegni la torcia' : 'Accendi la torcia');
  } catch (err) {
    console.error(err);
  }
});

/**
 * Copies the part of the video under the card guide into a canvas.
 * The video uses object-fit: cover, so map guide coordinates back to video pixels.
 */
function grabCardFromVideo() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const box = viewer.getBoundingClientRect();
  const g = guide.getBoundingClientRect();
  const scale = Math.max(box.width / vw, box.height / vh);
  const offX = (box.width - vw * scale) / 2;
  const offY = (box.height - vh * scale) / 2;
  const sx = (g.left - box.left - offX) / scale;
  const sy = (g.top - box.top - offY) / scale;
  const sw = g.width / scale;
  const sh = g.height / scale;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')).drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** An uploaded photo is assumed to be already cropped to the card. @param {File} file */
async function grabCardFromFile(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')).drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

// ---------- preprocessing ----------

/**
 * Crops a horizontal strip of the card and prepares it for OCR.
 * @param {HTMLCanvasElement} card
 * @param {number} y0 fraction of card height
 * @param {number} y1 fraction of card height
 * @param {HTMLCanvasElement} out
 * @param {ReturnType<typeof readSettings>} s
 */
function prepareStrip(card, y0, y1, out, s) {
  const sy = Math.round(card.height * y0);
  const sh = Math.max(1, Math.round(card.height * (y1 - y0)));
  out.width = Math.round(card.width * s.scale);
  out.height = Math.round(sh * s.scale);
  const ctx = /** @type {CanvasRenderingContext2D} */ (out.getContext('2d', { willReadFrequently: true }));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(card, 0, sy, card.width, sh, 0, 0, out.width, out.height);

  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const gray = new Uint8ClampedArray(d.length / 4);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gray[p] = (y - 128) * s.contrast + 128;
  }
  const t = s.threshold ? otsu(gray) : -1;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let v = t >= 0 ? (gray[p] > t ? 255 : 0) : gray[p];
    if (s.invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

/** @param {Uint8ClampedArray} gray */
function otsu(gray) {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, threshold = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return threshold;
}

// ---------- recognition ----------

/** @type {import('./tcgdex.js').Candidate[]} */
let candidates = [];
let chosen = 0;
/** @type {any} */
let current = null;

/** @param {HTMLCanvasElement} card */
async function recognize(card) {
  const s = readSettings();
  const w = await ensureWorker();
  shootBtn.disabled = true;
  statusEl.textContent = 'Lettura in corso…';
  const t0 = performance.now();

  const topCanvas = /** @type {HTMLCanvasElement} */ ($('topCanvas'));
  const bottomCanvas = /** @type {HTMLCanvasElement} */ ($('bottomCanvas'));
  prepareStrip(card, 0, s.topEnd, topCanvas, s);
  prepareStrip(card, s.bottomStart, 1, bottomCanvas, s);

  try {
    await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    let bottom = (await w.recognize(bottomCanvas)).data.text;
    let num = parseCollectorNumber(bottom);
    // Light numbers on coloured bands (e.g. Sword & Shield) need inverted or binarised input.
    const retries = [
      { ...s, invert: !s.invert },
      { ...s, threshold: true, invert: !s.invert },
    ];
    let attempts = 1;
    for (const alt of retries) {
      if (num) break;
      attempts++;
      prepareStrip(card, s.bottomStart, 1, bottomCanvas, alt);
      const text = (await w.recognize(bottomCanvas)).data.text;
      bottom += `\n--- tentativo ${attempts} ---\n${text}`;
      num = parseCollectorNumber(text);
    }
    await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const top = (await w.recognize(topCanvas)).data.text;
    const tOcr = performance.now() - t0;
    $('topText').textContent = top || '(vuoto)';
    $('bottomText').textContent = bottom || '(vuoto)';

    const { lang, scores } = detectLanguage(`${top}\n${bottom}`);
    const setCode = parseSetCode(bottom);
    candidates = [];
    chosen = 0;
    /** @type {string | null} */
    let corrected = null;
    if (num) {
      statusEl.textContent = 'Ricerca su TCGdex…';
      const found = await findWithCorrections({ number: num.number, total: num.total, lang: lang ?? 'it', nameText: top, setCode });
      corrected = found.corrected ?? null;
      candidates = [...found];
    }
    const tTotal = performance.now() - t0;

    current = {
      at: new Date().toISOString(),
      number: num ? `${num.number}/${num.total}` : null,
      corrected,
      setCode,
      lang,
      langScores: scores,
      attempts,
      ocrMs: Math.round(tOcr),
      totalMs: Math.round(tTotal),
      topText: top.trim(),
      bottomText: bottom.trim(),
      candidates: candidates.slice(0, 5).map((c) => ({ id: c.id, name: c.name, score: +c.nameScore.toFixed(2) })),
      settings: s,
    };
    renderResult();
    statusEl.textContent = num
      ? candidates.length
        ? 'Controlla il risultato e segna l\'esito.'
        : 'Numero letto, ma nessuna carta trovata su TCGdex.'
      : 'Non riesco a leggere il numero. Riprova avvicinando la carta o cambia le regolazioni.';
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Errore: ${err instanceof Error ? err.message : err}. Riprova.`;
  } finally {
    shootBtn.disabled = false;
  }
}

const LANG_NAMES = { it: 'Italiano', en: 'Inglese', de: 'Tedesco', fr: 'Francese', es: 'Spagnolo', pt: 'Portoghese' };

function renderResult() {
  $('result').hidden = false;
  $('rNumber').textContent = current.corrected ? `${current.corrected} (letto ${current.number})` : current.number ?? 'non letto';
  $('rLang').textContent = current.lang ? LANG_NAMES[/** @type {keyof LANG_NAMES} */ (current.lang)] : 'incerta';
  $('rTime').textContent = `${(current.totalMs / 1000).toFixed(1)} s`;
  /** @type {HTMLInputElement} */ ($('note')).value = '';
  const list = $('candidates');
  list.replaceChildren();
  if (!candidates.length) {
    const li = document.createElement('li');
    li.className = 'muted small';
    li.textContent = 'Nessuna carta candidata.';
    list.append(li);
    return;
  }
  candidates.slice(0, 6).forEach((c, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(i === chosen));
    const img = c.image ? Object.assign(document.createElement('img'), { src: `${c.image}/low.webp`, alt: '', loading: 'lazy' }) : null;
    if (img) img.onerror = () => img.replaceWith(Object.assign(document.createElement('span'), { className: 'ph' }));
    const text = document.createElement('span');
    text.innerHTML = '<strong></strong><small></small>';
    /** @type {HTMLElement} */ (text.firstChild).textContent = c.name;
    /** @type {HTMLElement} */ (text.lastChild).textContent =
      `${c.setName}${c.setCode ? ` (${c.setCode})` : ''} · ${c.localId} · ${c.lang.toUpperCase()} · nome ${Math.round(c.nameScore * 100)}%${c.codeMatch ? ' · sigla ✓' : ''}`;
    btn.append(img ?? Object.assign(document.createElement('span'), { className: 'ph' }), text);
    btn.addEventListener('click', () => {
      chosen = i;
      list.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    });
    li.append(btn);
    list.append(li);
  });
}

// ---------- log ----------

/** @returns {any[]} */
function readLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** @param {any[]} log */
function writeLog(log) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {}
  renderLog();
}

function renderLog() {
  const log = readLog();
  const ok = log.filter((e) => e.correct).length;
  const firstOk = log.filter((e) => e.correct && e.chosenIndex === 0).length;
  const avg = log.length ? log.reduce((a, e) => a + e.totalMs, 0) / log.length / 1000 : 0;
  $('stats').textContent = log.length
    ? `${log.length} prove · ${Math.round((ok / log.length) * 100)}% corrette (${firstOk} al primo colpo) · ${avg.toFixed(1)} s medi`
    : '0 prove';
  const list = $('log');
  list.replaceChildren(
    ...log
      .slice()
      .reverse()
      .map((e) => {
        const li = document.createElement('li');
        const mark = document.createElement('span');
        mark.className = e.correct ? 'ok' : 'ko';
        mark.textContent = e.correct ? '✓ ' : '✗ ';
        li.append(mark, `${e.number ?? '—'} · ${e.lang ?? '?'} · ${e.chosen ?? 'nessuna'} · ${(e.totalMs / 1000).toFixed(1)} s${e.note ? ` · ${e.note}` : ''}`);
        return li;
      }),
  );
}

/** @param {boolean} correct */
function mark(correct) {
  if (!current) return;
  const note = /** @type {HTMLInputElement} */ ($('note')).value.trim();
  const pick = candidates[chosen];
  writeLog([...readLog(), { ...current, correct, chosenIndex: correct ? chosen : null, chosen: pick ? `${pick.name} (${pick.id})` : null, note }]);
  current = null;
  $('result').hidden = true;
  statusEl.textContent = 'Registrato. Prossima carta.';
}

$('markOk').addEventListener('click', () => mark(true));
$('markKo').addEventListener('click', () => mark(false));
$('copyLog').addEventListener('click', async () => {
  const text = JSON.stringify(readLog(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = 'Registro copiato negli appunti.';
  } catch {
    statusEl.textContent = 'Copia non riuscita: apri "Dettagli OCR" e copia a mano.';
  }
});
$('clearLog').addEventListener('click', () => {
  if (confirm('Svuotare il registro delle prove?')) writeLog([]);
});

// ---------- wiring ----------

shootBtn.addEventListener('click', () => {
  if (!video.videoWidth) return;
  navigator.vibrate?.(30);
  recognize(grabCardFromVideo());
});

/** @type {HTMLInputElement} */ ($('file')).addEventListener('change', async (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  const file = input.files?.[0];
  input.value = '';
  if (file) recognize(await grabCardFromFile(file));
});

for (const el of Object.values(controls)) el.addEventListener('input', renderSettings);
controls.ocrLangs.addEventListener('change', () => ensureWorker());

// Keep the screen on while testing.
/** @type {WakeLockSentinel | null} */
let wakeLock = null;
async function lockScreen() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') lockScreen();
  else wakeLock?.release().catch(() => {});
});

loadSettings();
renderSettings();
renderLog();
lockScreen();
startCamera();
ensureWorker().catch((err) => {
  console.error(err);
  statusEl.textContent = 'Impossibile caricare l\'OCR. Controlla la connessione e ricarica.';
});
