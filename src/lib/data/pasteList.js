// @ts-check
// One-tap import of a list copied from Limitless ("Copy to Clipboard") or Pokémon TCG Live.
// The clipboard is read inside the tap (browsers require a user gesture), then handed to the
// import screen.
import { parseDecklist } from '../domain/decklist.js';

let pending = '';

/**
 * Reads the clipboard; returns the text only when it looks like a deck list.
 * @returns {Promise<{ text: string } | { error: 'denied' | 'not-a-list' }>}
 */
export async function readListFromClipboard() {
  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch {
    return { error: 'denied' };
  }
  return parseDecklist(text).lines.length ? { text } : { error: 'not-a-list' };
}

/** @param {string} text */
export const setPendingList = (text) => (pending = text);

/** The list waiting for the import screen (read once). */
export function takePendingList() {
  const t = pending;
  pending = '';
  return t;
}

/** Message for a failed paste. @param {'denied' | 'not-a-list'} error */
export const pasteErrorText = (error) =>
  error === 'denied'
    ? 'Non posso leggere gli appunti: incolla la lista nel riquadro'
    : 'Negli appunti non c’è una lista di carte. Su Limitless tocca “Copy to Clipboard” e riprova';
