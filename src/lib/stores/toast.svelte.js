// @ts-check
// Snackbar for short confirmations, with an optional "Annulla" (CLAUDE.md UI guidelines).

export const toast = $state({
  /** @type {string | null} */
  message: null,
  /** @type {(() => void) | null} */
  undo: null,
  id: 0,
});

/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;

/**
 * @param {string} message
 * @param {(() => void) | null} [undo]
 */
export function showToast(message, undo = null) {
  clearTimeout(timer);
  toast.message = message;
  toast.undo = undo;
  toast.id++;
  timer = setTimeout(hideToast, undo ? 5000 : 3000);
}

export function hideToast() {
  clearTimeout(timer);
  toast.message = null;
  toast.undo = null;
}
