// @ts-check
// Saves the reviewed cards of a burst or a group photo, with "Annulla", and opens the recent
// additions.
import { changeCopies, restoreEntry } from '../../lib/data/collection.js';
import { collectionKey } from '../../lib/domain/collection.js';
import { hrefFor } from '../../lib/domain/routes.js';
import { navigate } from '../../lib/router.svelte.js';
import { showToast } from '../../lib/stores/toast.svelte.js';

/** @param {import('./BurstReview.svelte').Item[]} items */
export async function saveItems(items) {
  const saved = [];
  for (const it of items) {
    const c = it.rec.candidates[it.chosen];
    if (!c) continue;
    const copy = { cardId: c.id, lang: it.lang, variant: it.variant };
    saved.push({ key: collectionKey(copy.cardId, copy.lang, copy.variant), before: await changeCopies(copy, 1) });
  }
  const n = saved.length;
  showToast(`${n} ${n === 1 ? 'carta salvata' : 'carte salvate'} nella collezione`, async () => {
    for (const s of saved.reverse()) await restoreEntry(s.key, s.before);
  });
  navigate(hrefFor('collection', {}, { tab: 'all', view: 'recent' }));
}
