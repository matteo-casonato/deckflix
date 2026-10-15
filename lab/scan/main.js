// @ts-check
// Phase 0 scan prototype: camera → crop top/bottom strips → Tesseract.js → TCGdex lookup.
// No persistence except the test log in localStorage. The photo is never stored.
import { createWorker, PSM } from 'tesseract.js';
import { parseCollectorNumber, parseSetCode, detectLanguage } from './recognize.js';
import { findReprints, findWithCorrections, getCard, knownTotals } from './tcgdex.js';
import { applyStampSuggestion, guessVariant, listVariants } from '../../src/lib/domain/variants.js';
import {
  CARD_H, CARD_W, LEARNED_THRESHOLD, STAMP_H, STAMP_W, cropFeatures, features, findStamp, templateFromJSON, templateToJSON,
} from './stamp.js';

/** @template {HTMLElement} T @param {string} id @returns {T} */
const $ = (id) => /** @type {T} */ (document.getElementById(id));

const video = /** @type {HTMLVideoElement} */ ($('video'));
const viewer = $('viewer');
const guide = $('guide');
// The whole camera area is the shutter: tap the card to scan it.
const shootBtn = /** @type {HTMLButtonElement} */ ($('viewer'));
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
  still: /** @type {HTMLInputElement} */ ($('still')),
  guideSize: /** @type {HTMLInputElement} */ ($('guideSize')),
  ocrLangs: /** @type {HTMLSelectElement} */ ($('ocrLangs')),
  engine: /** @type {HTMLSelectElement} */ ($('engine')),
};

const SETTINGS_KEY = 'deckflix-lab-settings-v5';
const LOG_KEY = 'deckflix-lab-log';

// ---------- settings ----------

function loadSettings() {
  // Chrome restores form values on reload: start from the defaults in the markup,
  // so stale values (e.g. an old 45% guide) don't come back.
  for (const el of Object.values(controls)) {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = el.defaultChecked;
    else if (el instanceof HTMLInputElement) el.value = el.defaultValue;
    else el.selectedIndex = Math.max(0, [...el.options].findIndex((o) => o.defaultSelected));
  }
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
    still: controls.still.checked,
    guideSize: Number(controls.guideSize.value) / 100,
    ocrLangs: controls.ocrLangs.value,
    engine: /** @type {'google' | 'tesseract'} */ (controls.engine.value),
  };
}

function renderSettings() {
  const s = readSettings();
  $('topOut').textContent = `0–${Math.round(s.topEnd * 100)}%`;
  $('bottomOut').textContent = `${Math.round(s.bottomStart * 100)}%`;
  $('contrastOut').textContent = `×${s.contrast.toFixed(1)}`;
  $('scaleOut').textContent = `×${s.scale}`;
  $('guideOut').textContent = `${Math.round(s.guideSize * 100)}%`;
  guide.style.height = `${s.guideSize * 100}%`;
  $('topBand').style.height = `${s.topEnd * 100}%`;
  $('bottomBand').style.height = `${(1 - s.bottomStart) * 100}%`;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

// ---------- OCR engines ----------

/**
 * Chrome's Shape Detection API. On Android it runs Google's on-device text recognition
 * (Play Services / ML Kit): free, offline, no keys. Behind chrome://flags
 * "Experimental Web Platform features" at the time of writing.
 */
const hasGoogleOcr = 'TextDetector' in window;

function useGoogle() {
  return readSettings().engine === 'google' && hasGoogleOcr;
}

/** Prepares the selected engine and enables the shutter when camera and OCR are ready. */
async function ensureEngine() {
  if (useGoogle()) {
    statusEl.textContent = 'Pronto (OCR Google). Inquadra la carta dentro la cornice.';
    shootBtn.disabled = !video.srcObject;
    return;
  }
  await ensureWorker();
}

function engineReady() {
  return useGoogle() || !!worker;
}


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

/** @type {ImageCapture | null} */
let imageCapture = null;

async function startCamera(deviceId = '') {
  if (!navigator.mediaDevices?.getUserMedia) {
    viewerMsg.textContent = 'Fotocamera non disponibile: serve HTTPS. Usa "Carica foto".';
    return;
  }
  track?.stop();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
        width: { ideal: 3840 },
        height: { ideal: 2160 },
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    track = stream.getVideoTracks()[0];
    viewerMsg.textContent = '';
    shootBtn.disabled = !engineReady();
    const caps = /** @type {any} */ (track.getCapabilities?.() ?? {});
    torchBtn.hidden = !caps.torch;
    setupZoom(caps.zoom);
    if (caps.focusMode?.includes('continuous')) {
      await track.applyConstraints(/** @type {any} */ ({ advanced: [{ focusMode: 'continuous' }] })).catch(() => {});
    }
    imageCapture = 'ImageCapture' in window ? new ImageCapture(track) : null;
    let photoInfo = '';
    if (imageCapture) {
      const pc = await imageCapture.getPhotoCapabilities().catch(() => null);
      if (pc?.imageWidth?.max) photoInfo = ` · foto fino a ${pc.imageWidth.max}×${pc.imageHeight?.max}`;
    }
    $('camInfo').textContent = `Video ${video.videoWidth}×${video.videoHeight}${photoInfo}`;
    await listCameras(track.getSettings().deviceId ?? '');
  } catch (err) {
    console.error(err);
    viewerMsg.textContent =
      'Accesso alla fotocamera negato. Riattivalo dalle impostazioni del sito in Chrome, oppure usa "Carica foto".';
  }
}

/** Fills the camera picker (labels are available only after permission). @param {string} activeId */
async function listCameras(activeId) {
  const select = /** @type {HTMLSelectElement} */ ($('camera'));
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  select.replaceChildren(
    ...cams.map((d, i) => {
      const o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || `Fotocamera ${i + 1}`;
      o.selected = d.deviceId === activeId;
      return o;
    }),
  );
}

const ZOOM_KEY = 'deckflix-lab-zoom-v2';
/** Chosen by the user on their phone: card at a comfortable distance and in focus. */
const DEFAULT_ZOOM = 1.2;
const zoomInput = /** @type {HTMLInputElement} */ ($('zoom'));

/**
 * Optical/digital zoom of the camera track, when supported: lets the user hold the card
 * farther away (where autofocus works) while it still fills the guide.
 * @param {{ min: number, max: number, step?: number } | undefined} range
 */
function setupZoom(range) {
  const ctl = $('zoomCtl');
  if (!range || !(range.max > range.min)) {
    ctl.hidden = true;
    return;
  }
  ctl.hidden = false;
  zoomInput.min = String(range.min);
  zoomInput.max = String(Math.min(range.max, 5));
  zoomInput.step = String(range.step || 0.1);
  let saved = DEFAULT_ZOOM;
  try {
    saved = Number(localStorage.getItem(ZOOM_KEY) ?? DEFAULT_ZOOM);
  } catch {}
  zoomInput.value = String(Math.min(Number(zoomInput.max), Math.max(range.min, saved)));
  applyZoom();
}

async function applyZoom() {
  const zoom = Number(zoomInput.value);
  $('zoomOut').textContent = `×${zoom.toFixed(1)}`;
  try {
    localStorage.setItem(ZOOM_KEY, String(zoom));
  } catch {}
  await track?.applyConstraints(/** @type {any} */ ({ advanced: [{ zoom }] })).catch((err) => console.error(err));
}

zoomInput.addEventListener('input', applyZoom);

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

/** Video short side from which frames are sharp enough and no still photo is taken. */
const STILL_BELOW = 1440;

/**
 * Guide rectangle as fractions of the video frame.
 * The video uses object-fit: cover, so map guide coordinates back to video pixels.
 */
function guideInVideo() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const box = viewer.getBoundingClientRect();
  const g = guide.getBoundingClientRect();
  const scale = Math.max(box.width / vw, box.height / vh);
  const offX = (box.width - vw * scale) / 2;
  const offY = (box.height - vh * scale) / 2;
  return {
    x: (g.left - box.left - offX) / scale / vw,
    y: (g.top - box.top - offY) / scale / vh,
    w: g.width / scale / vw,
    h: g.height / scale / vh,
  };
}

/**
 * Copies the card under the guide into a canvas. Uses a full-resolution still photo
 * (ImageCapture) only when the video stream is low resolution (often 720p): a still
 * is slower and some phones return it in landscape while the stream is portrait.
 * The video is assumed to be a centred crop of the photo when aspect ratios differ.
 * @returns {Promise<{ canvas: HTMLCanvasElement, source: string }>}
 */
async function grabCardFromCamera() {
  const r = guideInVideo();
  const va = video.videoWidth / video.videoHeight;
  /** @type {CanvasImageSource} */
  let src = video;
  let sw = video.videoWidth;
  let sh = video.videoHeight;
  let source = `video ${sw}×${sh}`;
  let ox = 0;
  let oy = 0;
  let fw = sw;
  let fh = sh;

  const sharpEnough = Math.min(sw, sh) >= STILL_BELOW;
  if (imageCapture && readSettings().still && !sharpEnough) {
    try {
      const bitmap = await createImageBitmap(await imageCapture.takePhoto());
      const pa = bitmap.width / bitmap.height;
      // A still in the other orientation cannot be mapped reliably: keep the video frame.
      if (pa > 1 === va > 1) {
        src = bitmap;
        sw = bitmap.width;
        sh = bitmap.height;
        fw = pa > va ? sh * va : sw;
        fh = pa > va ? sh : sw / va;
        ox = (sw - fw) / 2;
        oy = (sh - fh) / 2;
        source = `foto ${sw}×${sh}`;
      } else {
        source += ` (foto ${bitmap.width}×${bitmap.height} scartata: orientamento diverso)`;
      }
    } catch (err) {
      console.error(err);
      source += ' (foto non riuscita)';
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(r.w * fw);
  canvas.height = Math.round(r.h * fh);
  /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')).drawImage(
    src, ox + r.x * fw, oy + r.y * fh, r.w * fw, r.h * fh, 0, 0, canvas.width, canvas.height,
  );
  if (src instanceof ImageBitmap) src.close();
  return { canvas, source };
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
 * Crops are resized so the collector number (about 1.8% of the card height) is ~48 px tall:
 * Tesseract reads best there, and larger images only slow it down (seconds per pass on a phone).
 */
const NUMBER_HEIGHT_RATIO = 0.018;
const TARGET_TEXT_PX = 48;

/**
 * @typedef {{ contrast: number, scale: number, threshold: boolean, invert: boolean, adaptive?: boolean }} StripOptions
 */

/**
 * Crops a region of the card and prepares it for OCR.
 * @param {HTMLCanvasElement} card
 * @param {number} y0 fraction of card height
 * @param {number} y1 fraction of card height
 * @param {HTMLCanvasElement} out
 * @param {StripOptions} s
 * @param {number} [x0] fraction of card width
 * @param {number} [x1] fraction of card width
 */
function prepareStrip(card, y0, y1, out, s, x0 = 0, x1 = 1) {
  const sx = Math.round(card.width * x0);
  const sw = Math.max(1, Math.round(card.width * (x1 - x0)));
  const sy = Math.round(card.height * y0);
  const sh = Math.max(1, Math.round(card.height * (y1 - y0)));
  const k = Math.max(0.5, Math.min(s.scale, TARGET_TEXT_PX / (card.height * NUMBER_HEIGHT_RATIO)));
  out.width = Math.round(sw * k);
  out.height = Math.round(sh * k);
  const ctx = /** @type {CanvasRenderingContext2D} */ (out.getContext('2d', { willReadFrequently: true }));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(card, sx, sy, sw, sh, 0, 0, out.width, out.height);

  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const gray = new Uint8ClampedArray(d.length / 4);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gray[p] = (y - 128) * s.contrast + 128;
  }
  const bin = s.adaptive ? adaptiveThreshold(gray, out.width, out.height) : null;
  const t = !bin && s.threshold ? otsu(gray) : -1;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let v = bin ? bin[p] : t >= 0 ? (gray[p] > t ? 255 : 0) : gray[p];
    if (s.invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Bradley local threshold: compares each pixel with the mean of its neighbourhood,
 * which copes with holo foil and uneven light better than a global threshold.
 * @param {Uint8ClampedArray} gray
 * @param {number} w
 * @param {number} h
 */
function adaptiveThreshold(gray, w, h) {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.max(4, Math.round(h / 4));
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      out[y * w + x] = gray[y * w + x] < mean * 0.85 ? 0 : 255;
    }
  }
  return out;
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
/** @type {HTMLCanvasElement | null} */
let lastCard = null;
let ocrText = '';
/** @type {import('../../src/lib/domain/variants.js').VariantOption[]} */
let variantOptions = [];
/** @type {string | null} */
let chosenVariant = null;
/** @type {string[]} */
let highlightedVariants = [];
/** @type {any} */
let stampResult = null;

const DIGITS = '0123456789/';

/**
 * Small preview of the cropped card with the OCR zones, to check the crop at a glance.
 * With a stamp result, draws the box where the stamp was searched for (yellow if found).
 * @param {HTMLCanvasElement} card
 * @param {ReturnType<typeof readSettings>} s
 * @param {Awaited<ReturnType<typeof detectPlayStamp>> | null} [stamp]
 */
function drawPreview(card, s, stamp = null) {
  const out = /** @type {HTMLCanvasElement} */ ($('preview'));
  out.height = 240;
  out.width = Math.round((card.width / card.height) * out.height);
  const ctx = /** @type {CanvasRenderingContext2D} */ (out.getContext('2d'));
  ctx.drawImage(card, 0, 0, out.width, out.height);
  if (!stamp) {
    ctx.fillStyle = 'rgb(255 203 69 / 0.35)';
    ctx.fillRect(0, s.bottomStart * out.height, out.width * 0.45, out.height);
    ctx.fillRect(out.width * 0.55, s.bottomStart * out.height, out.width * 0.45, out.height);
    ctx.fillRect(0, 0, out.width, s.topEnd * out.height);
    return;
  }
  const { hit, detected } = stamp;
  ctx.strokeStyle = detected ? '#FFCB45' : '#9AA1AE';
  ctx.lineWidth = 3;
  ctx.setLineDash(detected ? [] : [6, 4]);
  ctx.strokeRect(hit.x * out.width - 3, hit.y * out.height - 3, hit.w * out.width + 6, hit.h * out.height + 6);
}

/**
 * @typedef {{ num: ReturnType<typeof parseCollectorNumber>, top: string, bottom: string, all: string, digitsText: string, attempts: number }} OcrResult
 */

/**
 * Tesseract: digits-only passes on each bottom corner (left on recent cards, right on
 * older ones), from cheapest to most aggressive preprocessing; then name and language.
 * @param {HTMLCanvasElement} card
 * @param {ReturnType<typeof readSettings>} s
 * @param {Set<number> | null} totals
 * @returns {Promise<OcrResult>}
 */
async function ocrTesseract(card, s, totals) {
  const w = await ensureWorker();
  const topCanvas = /** @type {HTMLCanvasElement} */ ($('topCanvas'));
  const bottomCanvas = /** @type {HTMLCanvasElement} */ ($('bottomCanvas'));
  await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: DIGITS });
  const looks = [
    { name: 'grigio', opts: { ...s } },
    { name: 'invertito', opts: { ...s, invert: !s.invert } },
    { name: 'soglia locale', opts: { ...s, threshold: false, adaptive: true } },
    { name: 'soglia locale invertita', opts: { ...s, threshold: false, adaptive: true, invert: !s.invert } },
  ];
  const passes = looks.flatMap((look) => CORNERS.map((c) => ({ ...look, ...c, name: `${look.name} ${c.name}` })));
  let digitsText = '';
  /** @type {OcrResult['num']} */
  let num = null;
  let attempts = 0;
  for (const pass of passes) {
    attempts++;
    prepareStrip(card, s.bottomStart, 1, bottomCanvas, pass.opts, pass.x0, pass.x1);
    const text = (await w.recognize(bottomCanvas)).data.text;
    digitsText += `[${pass.name}] ${text.trim()}\n`;
    num = parseCollectorNumber(text, totals);
    if (num) break;
  }

  let bottom = '';
  let top = '';
  if (num) {
    statusEl.textContent = 'Lettura di nome e lingua…';
    await w.setParameters({ tessedit_char_whitelist: '' });
    prepareStrip(card, s.bottomStart, 1, bottomCanvas, s);
    bottom = (await w.recognize(bottomCanvas)).data.text;
    await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    prepareStrip(card, 0, s.topEnd, topCanvas, s);
    top = (await w.recognize(topCanvas)).data.text;
  } else {
    prepareStrip(card, 0, s.topEnd, topCanvas, s);
  }
  await w.setParameters({ tessedit_char_whitelist: '' });
  return { num, top, bottom, all: `${top}\n${bottom}`, digitsText, attempts };
}

/**
 * Google on-device OCR (TextDetector): one pass on the whole card, then text blocks are
 * split by position into the top (name, HP) and bottom (number, set code) zones.
 * If the number is missing, retries on enlarged bottom corners.
 * @param {HTMLCanvasElement} card
 * @param {ReturnType<typeof readSettings>} s
 * @param {Set<number> | null} totals
 * @returns {Promise<OcrResult>}
 */
async function ocrGoogle(card, s, totals) {
  // @ts-ignore -- TextDetector is not in the DOM typings yet
  const detector = new TextDetector();
  /** @type {{ rawValue: string, boundingBox: DOMRectReadOnly }[]} */
  const blocks = await detector.detect(card);
  const lines = blocks
    .map((b) => ({ text: b.rawValue, y0: b.boundingBox.y / card.height, y1: (b.boundingBox.y + b.boundingBox.height) / card.height }))
    .sort((a, b) => a.y0 - b.y0);
  const top = lines.filter((l) => l.y0 < s.topEnd).map((l) => l.text).join('\n');
  const bottom = lines.filter((l) => l.y1 > s.bottomStart).map((l) => l.text).join('\n');
  let digitsText = `[carta intera] ${lines.map((l) => `${Math.round(l.y0 * 100)}% ${l.text}`).join(' | ')}\n`;
  let num = parseCollectorNumber(bottom, totals) ?? parseCollectorNumber(lines.map((l) => l.text).join('\n'), totals);
  let attempts = 1;

  const bottomCanvas = /** @type {HTMLCanvasElement} */ ($('bottomCanvas'));
  for (const c of CORNERS) {
    if (num) break;
    attempts++;
    prepareStrip(card, s.bottomStart, 1, bottomCanvas, s, c.x0, c.x1);
    const found = await detector.detect(bottomCanvas);
    const text = found.map((/** @type {any} */ b) => b.rawValue).join('\n');
    digitsText += `[angolo ${c.name}] ${text}\n`;
    num = parseCollectorNumber(text, totals);
  }
  prepareStrip(card, 0, s.topEnd, /** @type {HTMLCanvasElement} */ ($('topCanvas')), s);
  return { num, top, bottom, all: lines.map((l) => l.text).join('\n'), digitsText, attempts };
}

const CORNERS = [
  { name: 'sx', x0: 0, x1: 0.45 },
  { name: 'dx', x0: 0.55, x1: 1 },
];

/** @param {HTMLCanvasElement} card @param {string} source */
async function recognize(card, source) {
  const s = readSettings();
  const engine = useGoogle() ? 'google' : 'tesseract';
  shootBtn.disabled = true;
  statusEl.textContent = 'Lettura del numero…';
  const t0 = performance.now();
  lastCard = card;

  try {
    // Sets are listed in Italian and English; good enough to validate any language here.
    const totals = await knownTotals('it').catch(() => null);
    const { num, top, bottom, all, digitsText, attempts } =
      engine === 'google' ? await ocrGoogle(card, s, totals) : await ocrTesseract(card, s, totals);
    const tOcr = performance.now() - t0;
    $('topText').textContent = top || '(non letta)';
    $('bottomText').textContent = `${digitsText}${bottom ? `[testo] ${bottom}` : ''}`;
    drawPreview(card, s);
    $('cropInfo').textContent = `Sorgente: ${source} · carta ritagliata ${card.width}×${card.height} px · numero alto circa ${Math.round(card.height * NUMBER_HEIGHT_RATIO)} px`;

    // Google reads the whole card in one go: use all of it, so uploaded photos with
    // margins (where the zones don't line up) still find the name and set code.
    const nameText = engine === 'google' ? all : top;
    const { lang, scores } = detectLanguage(all);
    const setCode = parseSetCode(bottom) ?? parseSetCode(all);
    ocrText = all;
    candidates = [];
    chosen = 0;
    /** @type {string | null} */
    let corrected = null;
    if (num) {
      statusEl.textContent = 'Ricerca su TCGdex…';
      const found = await findWithCorrections({ number: num.number, total: num.total, lang: lang ?? 'it', nameText, setCode });
      corrected = found.corrected ?? null;
      candidates = [...found];
      // Classic-collection reprints keep the original number: add them by name.
      const names = candidates.filter((c) => c.nameScore >= 0.7).slice(0, 3).map((c) => c.name);
      const reprints = await findReprints(names, candidates[0]?.lang ?? lang ?? 'it', nameText).catch(() => []);
      candidates.push(...reprints.filter((r) => !candidates.some((c) => c.id === r.id)));
    }
    const tTotal = performance.now() - t0;

    current = {
      at: new Date().toISOString(),
      number: num ? `${num.number}/${num.total}` : null,
      corrected,
      setCode,
      lang,
      langScores: scores,
      engine,
      attempts,
      source,
      cardPx: `${card.width}×${card.height}`,
      ocrMs: Math.round(tOcr),
      totalMs: Math.round(tTotal),
      topText: top.trim(),
      bottomText: `${digitsText}${bottom}`.trim(),
      candidates: candidates.slice(0, 6).map((c) => ({ id: c.id, name: c.name, score: +c.nameScore.toFixed(2), ...(c.reprint ? { reprint: true } : {}) })),
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
      `${c.reprint ? 'Ristampa · ' : ''}${c.setName}${c.setCode ? ` (${c.setCode})` : ''} · ${c.localId} · ${c.lang.toUpperCase()} · nome ${Math.round(c.nameScore * 100)}%${c.codeMatch ? ' · sigla ✓' : ''}`;
    btn.append(img ?? Object.assign(document.createElement('span'), { className: 'ph' }), text);
    btn.addEventListener('click', () => {
      chosen = i;
      list.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
      loadVariants();
    });
    li.append(btn);
    list.append(li);
  });
  loadVariants();
}

const priceFormat = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

/** Loads the print variants of the chosen candidate and preselects the likely one. */
async function loadVariants() {
  const box = $('variants');
  const pick = candidates[chosen];
  variantOptions = [];
  chosenVariant = null;
  highlightedVariants = [];
  stampResult = null;
  $('stampInfo').textContent = '';
  box.replaceChildren();
  if (!pick) return;
  box.textContent = 'Carico le varianti…';
  try {
    const card = await getCard(pick.lang, pick.id);
    if (candidates[chosen] !== pick) return;
    const stamp = lastCard ? detectPlayStamp(lastCard) : null;
    stampResult = stamp;
    const listed = listVariants(card);
    const r = applyStampSuggestion(listed, guessVariant(listed, ocrText), stamp?.detected ? 'player-rewards-program' : null);
    variantOptions = r.options;
    chosenVariant = r.preselect;
    highlightedVariants = r.highlighted;
    if (lastCard) drawPreview(lastCard, readSettings(), stamp);
    renderStampInfo();
  } catch (err) {
    console.error(err);
  }
  renderVariants();
}

// ---------- Play! Pokémon stamp ----------

const STAMP_TEMPLATE_KEY = 'deckflix-lab-stamp-play';

/**
 * Features of an image resized to the working card size.
 * @param {CanvasImageSource} img
 * @param {number} w
 * @param {number} h
 */
function featuresOf(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d', { willReadFrequently: true }));
  ctx.drawImage(img, 0, 0, w, h);
  return features(ctx.getImageData(0, 0, w, h).data, w, h);
}

/**
 * Geometric drawing of the Play! Pokémon stamp (rounded box, red top and black bottom,
 * ball top left, light silhouette): close enough to find where the stamp is, not to
 * decide whether it is there. Not a copy of the logo.
 * @type {import('./stamp.js').Features | null}
 */
let drawnTemplate = null;
function getDrawnTemplate() {
  if (drawnTemplate) return drawnTemplate;
  const w = Math.round(STAMP_W * CARD_W * 4), h = Math.round(STAMP_H * CARD_H * 4);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const light = '#e8e8e8', red = '#d42a2a', dark = '#1c1c1c';
  x.fillStyle = light;
  x.beginPath();
  x.roundRect(0, 0, w, h, w * 0.08);
  x.fill();
  const m = w * 0.05;
  x.save();
  x.beginPath();
  x.roundRect(m, m, w - 2 * m, h - 2 * m, w * 0.06);
  x.clip();
  x.fillStyle = red;
  x.fillRect(0, 0, w, h * 0.55);
  x.fillStyle = dark;
  x.fillRect(0, h * 0.55, w, h);
  const bx = w * 0.24, by = h * 0.4, br = w * 0.17;
  x.fillStyle = light;
  x.beginPath();
  x.arc(bx, by, br, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#c42020';
  x.beginPath();
  x.arc(bx, by, br * 0.86, Math.PI, 0);
  x.fill();
  x.fillStyle = dark;
  x.fillRect(bx - br, by - br * 0.08, br * 2, br * 0.16);
  x.fillStyle = light;
  x.beginPath();
  x.arc(bx + br * 0.1, by, br * 0.28, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.arc(w * 0.7, h * 0.33, w * 0.095, 0, Math.PI * 2);
  x.fill();
  x.lineWidth = w * 0.09;
  x.lineCap = 'round';
  x.strokeStyle = light;
  x.beginPath();
  x.moveTo(w * 0.35, h * 0.22);
  x.lineTo(w * 0.55, h * 0.48);
  x.stroke();
  x.beginPath();
  x.ellipse(w * 0.66, h * 0.75, w * 0.17, h * 0.33, 0, 0, Math.PI * 2);
  x.fill();
  x.restore();
  drawnTemplate = featuresOf(c, Math.round(w / 4), Math.round(h / 4));
  return drawnTemplate;
}

/** Template cut from one of the user's stamped cards: stays on this device. */
function loadLearnedTemplate() {
  try {
    return templateFromJSON(JSON.parse(localStorage.getItem(STAMP_TEMPLATE_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

/**
 * Looks for the Play! stamp on the lower edge of the artwork. Only a learned template
 * can say "stamp present"; the drawn one just shows where it would be.
 * @param {HTMLCanvasElement} cardCanvas
 */
function detectPlayStamp(cardCanvas) {
  const card = featuresOf(cardCanvas, CARD_W, CARD_H);
  const learned = loadLearnedTemplate();
  const hit = findStamp(card, learned ?? getDrawnTemplate());
  return { hit, learned: !!learned, detected: !!learned && hit.score >= LEARNED_THRESHOLD, card };
}

function renderStampInfo() {
  const info = $('stampInfo');
  const stamp = stampResult;
  /** @type {HTMLButtonElement} */ ($('calibrate')).hidden = !stamp;
  if (!stamp) {
    info.textContent = '';
    return;
  }
  const where = stamp.hit.side === 'left' ? 'a sinistra' : 'a destra';
  const score = stamp.hit.score.toFixed(2);
  info.textContent = !stamp.learned
    ? `Timbro Play!: il riquadro tratteggiato è dove sarebbe (${where}, somiglianza ${score} col modello disegnato). Per riconoscerlo da solo, scansiona una carta con il timbro e tocca "Usa come modello del timbro".`
    : stamp.detected
      ? `Timbro Play! rilevato ${where} (somiglianza ${score}): variante con timbro evidenziata.`
      : `Nessun timbro Play! (somiglianza massima ${score}, serve ${LEARNED_THRESHOLD}).`;
}

/** Saves the stamp found on the current card as this device's template. */
function calibrateStamp() {
  if (!stampResult || !lastCard) return;
  const { hit, card } = stampResult;
  const t = cropFeatures(card, Math.round(hit.x * CARD_W), Math.round(hit.y * CARD_H), Math.round(hit.w * CARD_W), Math.round(hit.h * CARD_H));
  try {
    localStorage.setItem(STAMP_TEMPLATE_KEY, JSON.stringify(templateToJSON(t)));
  } catch {}
  statusEl.textContent =
    hit.side === 'right'
      ? 'Modello del timbro salvato. Se il timbro era tagliato dal bordo, rifallo con una carta Pokémon (timbro a sinistra).'
      : 'Modello del timbro salvato su questo telefono.';
  renderTemplateInfo();
  loadVariants();
}

function renderTemplateInfo() {
  const has = !!loadLearnedTemplate();
  $('templateInfo').textContent = has
    ? 'Modello del timbro Play!: salvato su questo telefono.'
    : 'Modello del timbro Play!: non ancora creato (usa una carta con il timbro).';
  /** @type {HTMLButtonElement} */ ($('clearTemplate')).hidden = !has;
}

function renderVariants() {
  const box = $('variants');
  box.replaceChildren();
  if (!variantOptions.length) {
    box.textContent = 'Varianti non disponibili.';
    return;
  }
  for (const v of variantOptions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.setAttribute('aria-pressed', String(v.key === chosenVariant));
    const hint = highlightedVariants.includes(v.key) ? '★ timbro rilevato · ' : '';
    if (hint) btn.classList.add('hinted');
    btn.textContent = `${hint}${v.label} · ${v.price != null ? priceFormat.format(v.price) : 'prezzo n.d.'}`;
    btn.addEventListener('click', () => {
      chosenVariant = v.key;
      renderVariants();
    });
    box.append(btn);
  }
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
        li.append(mark, `${e.number ?? '—'} · ${e.lang ?? '?'} · ${e.chosen ?? 'nessuna'}${e.variant ? ` · ${e.variant.label}` : ''} · ${(e.totalMs / 1000).toFixed(1)} s${e.note ? ` · ${e.note}` : ''}`);
        return li;
      }),
  );
}

/** @param {boolean} correct */
function mark(correct) {
  if (!current) return;
  const note = /** @type {HTMLInputElement} */ ($('note')).value.trim();
  const pick = candidates[chosen];
  const variant = variantOptions.find((v) => v.key === chosenVariant);
  writeLog([
    ...readLog(),
    {
      ...current,
      correct,
      chosenIndex: correct ? chosen : null,
      chosen: pick ? `${pick.name} (${pick.id})` : null,
      variant: variant ? { key: variant.key, label: variant.label, price: variant.price } : null,
      variantsAvailable: variantOptions.length,
      stamp: stampResult
        ? {
            detected: stampResult.detected,
            learned: stampResult.learned,
            score: +stampResult.hit.score.toFixed(2),
            side: stampResult.hit.side,
            at: [+stampResult.hit.x.toFixed(2), +stampResult.hit.y.toFixed(2)],
          }
        : null,
      note,
    },
  ]);
  current = null;
  $('result').hidden = true;
  statusEl.textContent = 'Registrato. Prossima carta.';
}

$('markOk').addEventListener('click', () => mark(true));
$('calibrate').addEventListener('click', calibrateStamp);
$('clearTemplate').addEventListener('click', () => {
  try {
    localStorage.removeItem(STAMP_TEMPLATE_KEY);
  } catch {}
  renderTemplateInfo();
});
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

shootBtn.addEventListener('click', async () => {
  if (!video.videoWidth) return;
  shootBtn.disabled = true;
  statusEl.textContent = 'Scatto…';
  navigator.vibrate?.(30);
  const { canvas, source } = await grabCardFromCamera();
  recognize(canvas, source);
});

/** @type {HTMLSelectElement} */ ($('camera')).addEventListener('change', (e) =>
  startCamera(/** @type {HTMLSelectElement} */ (e.target).value),
);

// Debug only, on explicit tap: lets the user send real crops to tune the prototype.
$('saveCrop').addEventListener('click', () => {
  if (!lastCard) return;
  lastCard.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `deckflix-carta-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/jpeg', 0.92);
});

/** @type {HTMLInputElement} */ ($('file')).addEventListener('change', async (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  const file = input.files?.[0];
  input.value = '';
  if (file) recognize(await grabCardFromFile(file), `file ${file.name}`);
});

for (const el of Object.values(controls)) el.addEventListener('input', renderSettings);
controls.ocrLangs.addEventListener('change', () => ensureEngine());
controls.engine.addEventListener('change', () => ensureEngine());

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

// @ts-ignore -- replaced at build time by Vite `define`
$('version').textContent = `Versione ${new Date(__BUILD_TIME__).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}`;
loadSettings();
renderSettings();
renderTemplateInfo();
renderLog();
lockScreen();
startCamera();
if (!hasGoogleOcr) {
  const opt = /** @type {HTMLOptionElement} */ (controls.engine.querySelector('option[value="google"]'));
  opt.disabled = true;
  opt.textContent += ' — non disponibile (vedi sotto)';
  controls.engine.value = 'tesseract';
}
$('engineInfo').textContent = hasGoogleOcr
  ? 'OCR Google disponibile su questo browser.'
  : 'OCR Google non disponibile: in Chrome apri chrome://flags, attiva "Experimental Web Platform features" e riavvia Chrome.';
ensureEngine().catch((err) => {
  console.error(err);
  statusEl.textContent = 'Impossibile caricare l\'OCR. Controlla la connessione e ricarica.';
});
