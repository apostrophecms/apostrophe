import { useAposFocus } from 'Modules/@apostrophecms/modal/composables/AposFocus';
import {
  computed, ref, unref, nextTick
} from 'vue';

/**
 * Handle focus trapping inside a modal or any other element.
 *
 * Options:
 * - `retries`: Number of retries to focus (trap) the first element in the given
 *   container. Default is 3.
 * - `refreshOnCycle`: If true, the elements to focus will be refreshed (query)
 *   on each cycle. Default is false.
 * - `withPriority`: If true, 'data-apos-focus-priority' attribute will be used
 *   to find the first element to focus. Default is true.
 * - `triggerRef`: (optional) A ref to the element that will trigger the focus
 * trap.
 *   It's used as a focus target when exiting the current element focusable
 *   elements. If boolean `true` is passed, the active modal focused element
 *   will be used.
 * - `onExit`: (optional) A callback to be called when exiting the focus trap.
 *
 * @param {{
 *  retries?: number;
 *  refreshOnCycle?: boolean;
 *  withPriority?: boolean;
 *  triggerRef?: import('vue').Ref<HTMLElement |
 *  import('vue').ComponentPublicInstance>
 *    | HTMLElement | boolean;
 *  onExit?: () => void;
 * }} options
 * @returns {{
 *   runTrap: (containerRef:  import('vue').Ref<HTMLElement> | HTMLElement) =>
 *   Promise<void>;
 *  hasRunningTrap: import('vue').ComputedRef<boolean>;
 *  stopTrap: () => void;
 *  resetTrap: () => void;
 *  onTab: (event: KeyboardEvent) => void;
 * }}
 */
export function useFocusTrap({
  triggerRef,
  refreshOnCycle = false,
  onExit = () => {},
  retries = 3,
  withPriority = true
}) {
  const {
    activeModalFocusedElement,
    findPriorityElementOrFirst,
    cycleElementsToFocus: parentCycleElementsToFocus,
    focusElement
  } = useAposFocus();

  const shouldRun = ref(false);
  const isRunning = ref(false);
  const currentRetries = ref(0);
  const rootRef = ref(null);
  const elementsToFocus = ref([]);
  const hasRunningTrap = computed(() => {
    return isRunning.value;
  });
  const triggerRefElement = computed(() => {
    const value = unref(triggerRef);
    if (value === true) {
      return activeModalFocusedElement;
    }
    if (value) {
      const element = value.$el || value;
      if (element instanceof HTMLElement) {
        return element.hasAttribute('tabindex')
          ? element
          : (element.querySelector('[tabindex]') || element);
      }
    }
    return null;
  });

  const selectors = [
    '[tabindex]',
    '[href]',
    'input',
    'select',
    'textarea',
    'button',
    '[data-apos-focus-priority]'
  ];
  const selector = selectors
    .map(addExcludingAttributes)
    .join(', ');

  return {
    runTrap: run,
    hasRunningTrap,
    stopTrap: stop,
    resetTrap: reset,
    onTab: cycle
  };

  /**
   * The internal implementation of the focus trap.
   */
  async function trapFocus(containerRef) {
    if (!unref(containerRef) || !shouldRun.value) {
      return;
    }
    const elements = [ ...unref(containerRef).querySelectorAll(selector) ];
    const firstElementToFocus = unref(withPriority)
      ? findPriorityElementOrFirst(elements)
      : elements[0];
    const isPriorityElement = unref(withPriority)
      ? firstElementToFocus?.hasAttribute('data-apos-focus-priority')
      : firstElementToFocus;

    if (!isPriorityElement && unref(retries) > currentRetries.value) {
      currentRetries.value++;
      await wait(20);
      return trapFocus(containerRef);
    }
    await nextTick();

    if (shouldRun.value) {
      focusElement(findChecked(firstElementToFocus, elements));
      elementsToFocus.value = elements;
      rootRef.value = unref(containerRef);
    }
  }

  /**
   * Run the focus trap
   */
  async function run(containerRef) {
    if (isRunning.value) {
      return;
    }
    shouldRun.value = true;
    isRunning.value = true;
    await trapFocus(containerRef);
    isRunning.value = false;
    shouldRun.value = false;
  }

  /**
   * Stop the focus trap
   */
  function stop() {
    shouldRun.value = false;
  }

  /**
   * Reset the focus trap
   */
  function reset() {
    shouldRun.value = false;
    isRunning.value = false;
    currentRetries.value = 0;
    elementsToFocus.value = [];
  }

  /**
   * Cycle through the elements to focus in the container element.
   * If no modal is active, it will use the natural focusable elements.
   *
   * @param {KeyboardEvent} event
   */
  function cycle(event) {
    if (refreshOnCycle && rootRef.value) {
      const elements = [ ...unref(rootRef).querySelectorAll(selector) ];
      elementsToFocus.value = elements;
    }
    const elements = unref(elementsToFocus);
    parentCycleElementsToFocus(event, elements, focus);

    // Keep the if branches for better readability and future changes.
    function focus(ev, element) {
      let toFocusEl;
      const currentFocused = triggerRefElement.value;

      // If no trigger element is found, fallback to the original behavior.
      if (!currentFocused) {
        element.focus();
        ev.preventDefault();
      }

      // We did a full cycle and are returning back to the first element.
      // We don't want that, but to exit the cycle and continue to the next
      // modal element to focus or the next natural focusable element (if
      // not inside a modal).
      if (element === elements[0]) {
        toFocusEl = currentFocused;
      }

      // We are shift + tabbing from the first element. We want to focus the
      // modal last focused element if available.
      if (element === elements.at(-1)) {
        toFocusEl = currentFocused;
      }

      if (toFocusEl) {
        toFocusEl.focus();
        ev.preventDefault();
      }

      // The focus handler is called ONLY when we are exiting the container
      // element. No matter if we find a focusable element or not, we should
      // call the onExit callback - the focus should be outside the container
      // element.
      onExit();
    }
  }
};

function addExcludingAttributes(selector) {
  return `${selector}:not([tabindex="-1"]):not([disabled]):not([type="hidden"]):not([aria-hidden])`;
}

function findChecked(element, elements) {
  if (element?.getAttribute('type') === 'radio') {
    return elements.find(
      el => (el.getAttribute('type') === 'radio' &&
        el.getAttribute('name') === element.getAttribute('name') &&
        el.hasAttribute('checked'))
    ) || element;
  }

  return element;
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
