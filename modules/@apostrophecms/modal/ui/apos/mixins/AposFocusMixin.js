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
    cycleElementsToFocus(e) {
      // console.log('this.elementsToFocus', this.elementsToFocus);

      if (!this.elementsToFocus.length) {
        console.log('nothing to focus');
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
          console.log('lastElementToFocus', lastElementToFocus);
          lastElementToFocus.focus();
          e.preventDefault();
        }
        return;
      }

      // If tab key is pressed
      if (document.activeElement === lastElementToFocus) {
        // Add focus for the first focusable element
        console.log('firstElementToFocus', firstElementToFocus);
        firstElementToFocus.focus();
        e.preventDefault();
      }
    },
    focusLastModalFocusedElement() {
      const lastModal = apos.modal.stack.at(-1);
      console.log('🚀 ~ file: AposModal.vue:230 ~ onLeave ~ lastModal:', lastModal);

      if (!lastModal) {
        return;
      }

      const { focusedElement, elementsToFocus } = lastModal;
      console.log('🚀 ~ file: AposModal.vue:235 ~ onLeave ~ focusedElement:', focusedElement);

      (focusedElement || elementsToFocus[0]).focus();
    },
    storeFocusedElement(e) {
      console.log('storeFocusedElement', e.target);
      this.focusedElement = e.target;
    }
  }
};