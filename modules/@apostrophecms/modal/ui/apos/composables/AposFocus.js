import { ref } from 'vue';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

export function useAposFocus() {
  const elementsToFocus = ref([]);
  const focusedElement = ref(null);

  const modalStore = useModalStore();

  return {
    elementsToFocus,
    focusedElement,
    cycleElementsToFocus,
    focusLastModalFocusedElement,
    storeFocusedElement,
    focusElement,
    isElementVisible
  };

  // Adapted from https://uxdesign.cc/how-to-trap-focus-inside-modal-to-make-it-ada-compliant-6a50f9a70700
  // All the elements inside modal which you want to make focusable.
  //
  // This has been adapted to Vue logic with `this.elementsToFocus` array as a data
  // so that any elements, not only from a modal but a menu for instance, can be focusable.
  // `cycleElementsToFocus` listeners relies on this dynamic list which has the advantage of
  // taking new or less elements to focus, after an update has happened inside a modal,
  // like an XHR call to get the pieces list in the AposDocsManager modal, for instance.
  function cycleElementsToFocus(e, elements) {
    const elems = elements || elementsToFocus.value;
    if (!elems.length) {
      return;
    }

    const isTabPressed = e.key === 'Tab' || e.code === 'Tab';
    if (!isTabPressed) {
      return;
    }

    const firstElementToFocus = elems.at(0);
    const lastElementToFocus = elems.at(-1);

    // If shift key pressed for shift + tab combination
    if (e.shiftKey) {
      if (document.activeElement === firstElementToFocus) {
        // Add focus for the last focusable element
        lastElementToFocus.focus();
        e.preventDefault();
      }
      return;
    }

    // If tab key is pressed
    if (document.activeElement === lastElementToFocus) {
      // Add focus for the first focusable element
      firstElementToFocus.focus();
      e.preventDefault();
    }
  }

  // Focus the last focused element from the last modal.
  // If it is not focusable (not visible/not in the DOM),
  // fallbacks to the first focusable element from the last modal.
  function focusLastModalFocusedElement() {
    const lastModal = modalStore.activeModal;
    if (!lastModal) {
      return;
    }

    const { focusedElement, elementsToFocus } = lastModal;

    focusElement(focusedElement, elementsToFocus[0]);
  }

  function storeFocusedElement(e) {
    focusedElement.value = e.target;
  }

  // Iterate through elements given in arguments and
  // focus the first element that exists in the DOM.
  function focusElement(...elementsToFocus) {
    for (const element of elementsToFocus) {
      const isAlreadySelected = document.activeElement === element;

      if (!element || !isElementVisible(element)) {
        continue;
      }
      if (!isAlreadySelected) {
        element.focus();
      }
      // Element exists in the DOM and is focused, stop iterating.
      return;
    }
  }

  function isElementVisible(element) {
    return element.offsetParent !== null;
  }
}
