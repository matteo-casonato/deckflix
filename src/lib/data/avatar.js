// @ts-check
// Player photos: cropped on the phone to the square the user framed, shrunk to 192 px, so they
// weigh a few KB in IndexedDB and in the Drive backup (no image leaves the phone otherwise).

const SIZE = 192;

/**
 * Loads a picked image file.
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Non riesco a leggere questa immagine'));
    };
    img.src = url;
  });
}

/**
 * JPEG data URL (SIZE × SIZE) of a square of the image.
 * @param {HTMLImageElement} img
 * @param {{ cx: number, cy: number, side: number }} crop centre and side, in image pixels
 */
export function avatarFromCrop(img, { cx, cy, side }) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, SIZE, SIZE);
  return canvas.toDataURL('image/jpeg', 0.85);
}
