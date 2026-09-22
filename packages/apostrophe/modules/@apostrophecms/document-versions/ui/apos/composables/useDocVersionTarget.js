import { onBeforeUnmount } from 'vue';
import scroll from '../utils/scroll.js';

/**
 * The element in the modal body the change navigator points at: a field
 * wrapper or a widget. It is scrolled into view, marked with `attribute`
 * and made focusable, so a keyboard user can move into it. One target at
 * a time; `clear()` puts the previous one back as it was.
 *
 * @param {{ attribute: string }} options
 */
export function useDocVersionTarget({ attribute }) {
  let target = null;
  let addedTabindex = false;

  function clear() {
    if (!target) {
      return;
    }
    target.removeAttribute(attribute);
    if (addedTabindex) {
      target.removeAttribute('tabindex');
    }
    target = null;
    addedTabindex = false;
  }

  // Resolves `false` when `el` is missing or not rendered
  function show(el) {
    clear();
    if (!el || !el.getClientRects().length) {
      return false;
    }
    target = el;
    addedTabindex = !el.hasAttribute('tabindex');
    if (addedTabindex) {
      el.setAttribute('tabindex', '-1');
    }
    el.setAttribute(attribute, '');
    // Its own scroller alone, centred on it: a smooth `scrollIntoView`
    // is cancelled by the change list's own smooth scroll in some browsers
    const scroller = getScroller(el);
    if (scroller) {
      const box = scroller.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      scroller.scrollBy({
        top: rect.top - box.top - ((box.height - rect.height) / 2),
        behavior: scroll.getScrollBehavior()
      });
    }
    return true;
  }

  function getScroller(el) {
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const { overflowY } = getComputedStyle(parent);
      if (
        [ 'auto', 'scroll' ].includes(overflowY) &&
        parent.scrollHeight > parent.clientHeight
      ) {
        return parent;
      }
    }
    return null;
  }

  onBeforeUnmount(clear);

  return {
    show,
    clear
  };
}
