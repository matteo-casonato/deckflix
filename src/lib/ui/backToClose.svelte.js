// @ts-check
// Android back closes sheets and dialogs first (CLAUDE.md UI guidelines). Bits UI dialogs are
// not native <dialog>s, so the back gesture is wired by hand: opening pushes a history entry
// (same URL), the back gesture pops it and closes; closing another way pops it too.

/**
 * Call during component init.
 * @param {() => boolean} isOpen
 * @param {() => void} close
 */
export function backToClose(isOpen, close) {
  let pushed = false;

  $effect(() => {
    const open = isOpen();
    if (open && !pushed) {
      history.pushState({ ...history.state, overlay: true }, '');
      pushed = true;
    } else if (!open && pushed) {
      pushed = false;
      if (history.state?.overlay) history.back();
    }
  });

  $effect(() => {
    const onPop = () => {
      if (!pushed) return;
      pushed = false;
      close();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Unmounted while open (e.g. navigation): drop the extra entry.
      if (pushed && history.state?.overlay) history.back();
    };
  });
}
