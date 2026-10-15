// @ts-check
// Rear camera for the scanner (SPEC § 4.1): high-resolution stream, continuous focus,
// zoom (default ×1.2: the card stays at a distance where autofocus works), torch.
// The photo is never stored: frames only live in memory while being read.

export const DEFAULT_ZOOM = 1.2;
const ZOOM_KEY = 'deckflix-scan-zoom';

export class CameraError extends Error {
  /** @param {'denied' | 'unavailable' | 'insecure'} kind @param {string} message */
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

/**
 * @typedef {{ stream: MediaStream, track: MediaStreamTrack, torch: boolean, zoom: { min: number, max: number, step: number } | null }} Camera
 */

/**
 * Opens the rear camera into `video`.
 * @param {HTMLVideoElement} video
 * @returns {Promise<Camera>}
 */
export async function openCamera(video) {
  if (!window.isSecureContext) throw new CameraError('insecure', 'La fotocamera funziona solo su HTTPS');
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unavailable', 'Fotocamera non disponibile in questo browser');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
      audio: false,
    });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraError('denied', 'Accesso alla fotocamera negato');
    throw new CameraError('unavailable', 'Nessuna fotocamera disponibile');
  }
  video.srcObject = stream;
  await video.play().catch(() => {});
  const track = stream.getVideoTracks()[0];
  const caps = /** @type {any} */ (track.getCapabilities?.() ?? {});
  if (caps.focusMode?.includes('continuous')) {
    await track.applyConstraints(/** @type {any} */ ({ advanced: [{ focusMode: 'continuous' }] })).catch(() => {});
  }
  const zoom = caps.zoom && caps.zoom.max > caps.zoom.min ? { min: caps.zoom.min, max: Math.min(caps.zoom.max, 5), step: caps.zoom.step || 0.1 } : null;
  if (zoom) await setZoom(track, savedZoom(zoom));
  return { stream, track, torch: !!caps.torch, zoom };
}

/** @param {Camera | null} cam */
export function closeCamera(cam) {
  cam?.stream.getTracks().forEach((t) => t.stop());
}

/** @param {{ min: number, max: number }} range */
export function savedZoom(range) {
  let z = DEFAULT_ZOOM;
  try {
    z = Number(localStorage.getItem(ZOOM_KEY) ?? DEFAULT_ZOOM);
  } catch {}
  return Math.min(range.max, Math.max(range.min, z));
}

/**
 * @param {MediaStreamTrack} track
 * @param {number} zoom
 */
export async function setZoom(track, zoom) {
  try {
    localStorage.setItem(ZOOM_KEY, String(zoom));
  } catch {}
  await track.applyConstraints(/** @type {any} */ ({ advanced: [{ zoom }] })).catch(() => {});
}

/**
 * @param {MediaStreamTrack} track
 * @param {boolean} on
 */
export function setTorch(track, on) {
  return track.applyConstraints(/** @type {any} */ ({ advanced: [{ torch: on }] }));
}

/**
 * Rectangle of the guide as fractions of the video frame (the video uses object-fit: cover).
 * @param {HTMLVideoElement} video
 * @param {HTMLElement} guide
 */
function guideInVideo(video, guide) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const box = video.getBoundingClientRect();
  const g = guide.getBoundingClientRect();
  const scale = Math.max(box.width / vw, box.height / vh);
  const offX = (box.width - vw * scale) / 2;
  const offY = (box.height - vh * scale) / 2;
  return {
    x: (g.left - box.left - offX) / scale,
    y: (g.top - box.top - offY) / scale,
    w: g.width / scale,
    h: g.height / scale,
  };
}

/**
 * The card under the guide, as a canvas (optionally downscaled).
 * @param {HTMLVideoElement} video
 * @param {HTMLElement} guide
 * @param {number} [maxHeight]
 */
export function grabCard(video, guide, maxHeight = Infinity) {
  const r = guideInVideo(video, guide);
  const k = Math.min(1, maxHeight / r.h);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(r.w * k));
  canvas.height = Math.max(1, Math.round(r.h * k));
  /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true })).drawImage(
    video,
    r.x,
    r.y,
    r.w,
    r.h,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

/**
 * Movement detector for burst mode, on a tiny grey frame of the guide area:
 * `diff` = mean absolute difference (0–255) from the previous frame (low for a few samples =
 * card still, and in focus); `contrast` = standard deviation (low = no card, just a table).
 */
export function createMotionMeter() {
  /** @type {Uint8ClampedArray | null} */
  let previous = null;
  const W = 24;
  const H = 34;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
  return {
    /**
     * @param {HTMLVideoElement} video
     * @param {HTMLElement} guide
     */
    sample(video, guide) {
      const r = guideInVideo(video, guide);
      ctx.drawImage(video, r.x, r.y, r.w, r.h, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      const grey = new Uint8ClampedArray(W * H);
      for (let i = 0, p = 0; p < grey.length; i += 4, p++) grey[p] = (d[i] + d[i + 1] + d[i + 2]) / 3;
      let diff = 255;
      if (previous) {
        let sum = 0;
        for (let p = 0; p < grey.length; p++) sum += Math.abs(grey[p] - previous[p]);
        diff = sum / grey.length;
      }
      previous = grey;
      let mean = 0;
      for (const v of grey) mean += v;
      mean /= grey.length;
      let variance = 0;
      for (const v of grey) variance += (v - mean) ** 2;
      return { diff, contrast: Math.sqrt(variance / grey.length) };
    },
    reset() {
      previous = null;
    },
  };
}
