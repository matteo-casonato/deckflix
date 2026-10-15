// @ts-check
// Player photos: cropped to a centered square and shrunk on the phone, so they weigh a few
// KB in IndexedDB and in the Drive backup (no image leaves the phone otherwise).

const SIZE = 192;

/**
 * @param {File} file image chosen by the user
 * @returns {Promise<string>} JPEG data URL, SIZE × SIZE
 */
export async function avatarFromFile(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}
