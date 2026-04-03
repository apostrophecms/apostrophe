import { onBeforeUnmount, unref } from 'vue';

/**
 * @typedef {import('vue').Ref<HTMLElement>} ElementRef
 */

/**
 * Reactive infinite scroll via IntersectionObserver.
 * Observes a sentinel element and calls `onLoadMore` when it enters
 * the visible area of the scroll container.
 * Automatically disconnects the observer on component unmount.
 * Handles edge cases when the results are shorter than the viewport,
 * with exposed `recheck()` method to force a fresh intersection check after
 * content changes. See `AposRecentlyEditedManager.vue` for an implementation
 * of infinite loading with rechecks after appending items.
 *
 * @param {ElementRef} sentinel
 *   Template ref for the observed element
 * @param {() => Promise<void>|void} onLoadMore
 *   Called when sentinel is visible; the caller is responsible
 *   for its own guards (e.g. "already loading")
 * @param {{ rootMargin?: string, root?: ElementRef|string }} [options]
 *   `root`: Ref to the scroll container element, or a CSS selector
 *   string resolved relative to the sentinel's ancestors.
 *   Defaults to the viewport when omitted.
 * @returns {{ start: () => void, stop: () => void }}
 */
export function useInfiniteScroll(sentinel, onLoadMore, options = {}) {
  const { rootMargin = '100px', root = null } = options;
  let observer = null;

  function handleIntersect(entries) {
    if (entries[0]?.isIntersecting) {
      onLoadMore();
    }
  }

  function resolveRoot(sentinelEl) {
    const raw = unref(root);
    if (raw instanceof HTMLElement) {
      return raw;
    }
    // CSS selector: walk up from sentinel to find the scroll container.
    if (typeof raw === 'string' && sentinelEl) {
      return sentinelEl.closest(raw) || null;
    }
    return null;
  }

  function start() {
    stop();
    const el = unref(sentinel);
    if (!el) {
      return;
    }
    const rootEl = resolveRoot(el);
    observer = new IntersectionObserver(handleIntersect, {
      root: rootEl,
      rootMargin,
      threshold: 0
    });
    observer.observe(el);
  }

  function stop() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  onBeforeUnmount(stop);

  // Force a fresh intersection check. Useful after content changes
  // (e.g. items appended) when the sentinel may already be visible
  // but no state transition occurred.
  function recheck() {
    const el = unref(sentinel);
    if (!observer || !el) {
      return;
    }
    observer.unobserve(el);
    observer.observe(el);
  }

  return {
    start,
    stop,
    recheck
  };
}
