/*
 * Provides:
 *
 * Methods to handle focus with keyboard.
 */
export default {
  data() {
    return {
      firstElementToFocus: null,
      lastElementToFocus: null
    };
  },
  methods: {
    // Adapted from https://uxdesign.cc/how-to-trap-focus-inside-modal-to-make-it-ada-compliant-6a50f9a70700
    // All the elements inside modal which you want to make focusable.
    cycleElementsToFocus(e) {
      if (!this.firstElementToFocus || !this.lastElementToFocus) {
        console.error('Both firstElementToFocus and lastElementToFocus must be defined to cycle through trapped focusable elements.');
      }

      const isTabPressed = e.key === 'Tab' || e.code === 'Tab';
      if (!isTabPressed) {
        return;
      }

      // If shift key pressed for shift + tab combination
      if (e.shiftKey) {
        if (document.activeElement === this.firstElementToFocus) {
          // Add focus for the last focusable element
          console.log('lastElementToFocus', this.lastElementToFocus);
          this.lastElementToFocus.focus();
          e.preventDefault();
        }
        return;
      }

      // If tab key is pressed
      if (document.activeElement === this.lastElementToFocus) {
        // Add focus for the first focusable element
        console.log('firstElementToFocus', this.firstElementToFocus);
        this.firstElementToFocus.focus();
        e.preventDefault();
      }
    },
    focusPreviousElement() {
      const previousModal = apos.modal.stack.at(-1);
      console.log('🚀 ~ file: AposModal.vue:230 ~ onLeave ~ previousModal:', previousModal);

      if (!previousModal) {
        return;
      }

      const { focusedElement, elementsToFocus } = previousModal;
      console.log('🚀 ~ file: AposModal.vue:235 ~ onLeave ~ focusedElement:', focusedElement);

      (focusedElement || elementsToFocus[0]).focus();
    }
  }
};
