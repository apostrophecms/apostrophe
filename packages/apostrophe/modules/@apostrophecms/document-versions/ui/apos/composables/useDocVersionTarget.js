import { onBeforeUnmount } from 'vue';

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
    el.scrollIntoView({ block: 'center' });
    return true;
  }

  onBeforeUnmount(clear);

  return {
    show,
    clear
  };
}
