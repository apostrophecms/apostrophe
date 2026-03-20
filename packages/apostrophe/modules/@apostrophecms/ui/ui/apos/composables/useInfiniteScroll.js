import { onBeforeUnmount, unref } from 'vue';

/**
 * Reactive infinite scroll via IntersectionObserver.
 * Observes a sentinel element and calls `onLoadMore` when it enters the viewport.
 * Automatically disconnects the observer on component unmount.
 * See implementation in AposRecentlyEdited.vue for example usage.
 *
 * @param {import('vue').Ref<HTMLElement>} sentinel
 *   Template ref for the observed element
 * @param {() => Promise<void>|void} onLoadMore
 *   Called when sentinel is visible; the caller is responsible
 *   for its own guards (e.g. "already loading")
 * @param {{ rootMargin?: string }} [options]
 * @returns {{ start: () => void, stop: () => void }}
 */
export function useInfiniteScroll(sentinel, onLoadMore, options = {}) {
  const { rootMargin = '100px' } = options;
  let observer = null;

  function handleIntersect(entries) {
    if (entries[0]?.isIntersecting) {
      onLoadMore();
    }
  }

  function start() {
    stop();
    const el = unref(sentinel);
    if (!el) {
      return;
    }
    observer = new IntersectionObserver(handleIntersect, {
      root: null,
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

  return {
    start,
    stop
  };
}
