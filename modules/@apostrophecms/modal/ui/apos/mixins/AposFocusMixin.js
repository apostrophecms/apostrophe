/*
 * Provides:
 *
 * Methods to handle focus with keyboard.
 */
export default {
  data() {
    return {
      elementsToFocus: [],

      // specific to modals:
      focusedElement: null
    };
  },
  methods: {
    // Adapted from https://uxdesign.cc/how-to-trap-focus-inside-modal-to-make-it-ada-compliant-6a50f9a70700
    // All the elements inside modal which you want to make focusable.
    //
    // This has been adapted to Vue logic with `this.elementsToFocus` array as a data
    // so that any elements, not only from a modal but a menu for instance, can be focusable.
    // `cycleElementsToFocus` listeners relies on this dynamic list which has the advantage of
    // taking new or less elements to focus, after an update has happened inside a modal,
    // like an XHR call to get the pieces list in the AposDocsManager modal, for instance.
    cycleElementsToFocus(e) {
      if (!this.elementsToFocus.length) {
        return;
      }

      const isTabPressed = e.key === 'Tab' || e.code === 'Tab';
      if (!isTabPressed) {
        return;
      }

      const firstElementToFocus = this.elementsToFocus.at(0);
      const lastElementToFocus = this.elementsToFocus.at(-1);

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
    },
    // Focus the last focused element from the last modal.
    // If it is not focusable (not visible/not in the DOM),
    // fallbacks to the first focusable element from the last modal.
    focusLastModalFocusedElement() {
      const lastModal = apos.modal.stack.at(-1);

      if (!lastModal) {
        return;
      }

      const { focusedElement, elementsToFocus } = lastModal;

      this.focusElement(focusedElement, elementsToFocus[0]);
    },
    storeFocusedElement(e) {
      this.focusedElement = e.target;
    },
    // Iterate through elements given in arguments and
    // focus the first element that exists in the DOM.
    focusElement(...elementsToFocus) {
      for (const element of elementsToFocus) {
        const isAlreadySelected = document.activeElement === element;

        if (!element || !this.isElementVisible(element)) {
          continue;
        }
        if (!isAlreadySelected) {
          element.focus();
        }
        // Element exists in the DOM and is focused, stop iterating.
        return;
      }
    },
    isElementVisible(element) {
      return element.offsetParent !== null;
    }
  }
};
