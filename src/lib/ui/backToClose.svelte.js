// @ts-check
// Android back closes sheets and dialogs first (CLAUDE.md UI guidelines). Bits UI dialogs are
// not native <dialog>s, so the back gesture is wired by hand: opening pushes a history entry
// (same URL), the back gesture pops it and closes; closing another way pops it too.
// Entries carry their depth, so with a sheet over another one (photo cropper over the player
// form) popping the top entry closes only the top sheet. When one overlay closes as another
// opens (player form → delete confirmation) the new one takes over the entry: going back
// there would pop the new overlay's entry instead and close it. A choice made in the sheet that
// changes the address (a filter: ?type=Fuoco) is carried over the back step, not undone by it.

/** Depth of the entry an overlay just left, until someone takes it or it is popped. */
let handoff = 0;
const current = () => Number(history.state?.overlay) || 0;

/**
 * Call during component init.
 * @param {() => boolean} isOpen
 * @param {() => void} close
 */
export function backToClose(isOpen, close) {
  /** Depth of this overlay's history entry; 0 when it has none. */
  let depth = 0;
  /** Address when the entry was pushed. */
  let pushedUrl = '';

  $effect(() => {
    const open = isOpen();
    if (open && !depth) {
      if (handoff && current() === handoff) {
        depth = handoff;
        handoff = 0;
        pushedUrl = location.href;
      } else {
        depth = current() + 1;
        history.pushState({ ...history.state, overlay: depth }, '');
        pushedUrl = location.href;
      }
    } else if (!open && depth) {
      const mine = depth;
      depth = 0;
      if (current() !== mine) return;
      handoff = mine;
      setTimeout(() => {
        if (handoff !== mine) return;
        handoff = 0;
        if (current() !== mine) return;
        // The sheet changed the address (replace()): keep it on the entry we go back to. popstate
        // comes before hashchange, so the router then reads the new address.
        const changed = location.href !== pushedUrl ? location.href : null;
        if (changed) addEventListener('popstate', () => history.replaceState(history.state, '', changed), { once: true });
        history.back();
      });
    }
  });

  $effect(() => {
    const onPop = () => {
      if (!depth || current() >= depth) return;
      depth = 0;
      close();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Unmounted while open (e.g. navigation): drop the extra entry.
      if (depth && current() === depth) history.back();
    };
  });
}
