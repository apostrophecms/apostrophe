import { ref } from 'vue';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

export function useAposFocus() {
  const elementsToFocus = ref([]);
  const focusedElement = ref(null);

  const modalStore = useModalStore();

  return {
    elementsToFocus,
    focusedElement,
    activeModal: modalStore.activeModal,
    activeModalElementsToFocus: modalStore.activeModal?.elementsToFocus,
    activeModalFocusedElement: modalStore.activeModal?.focusedElement,
    cycleElementsToFocus,
    focusLastModalFocusedElement,
    storeFocusedElement,
    focusElement,
    isElementVisible,
    findPriorityElementOrFirst
  };

  // Adapted from https://uxdesign.cc/how-to-trap-focus-inside-modal-to-make-it-ada-compliant-6a50f9a70700
  // All the elements inside modal which you want to make focusable.
  //
  // This has been adapted to Vue logic with `this.elementsToFocus` array as a
  // data so that any elements, not only from a modal but a menu for instance,
  // can be focusable. `cycleElementsToFocus` listeners relies on this dynamic
  // list which has the advantage of taking new or less elements to focus, after
  // an update has happened inside a modal, like an XHR call to get the pieces
  // list in the AposDocsManager modal, for instance. If the fnFocus argument is
  // provided, it will be called with the event and the element to focus.
  // Otherwise, the default behavior is to focus the element and prevent the
  // default event behavior.
  /**
   * @param {KeyboardEvent} e event
   * @param {HTMLElement[]} elements
   * @param {
   *  (event: KeyboardEvent, element: HTMLElement) => void
   * } [fnFocus] optional function to focus the element
   * @returns {void}
   */
  function cycleElementsToFocus(e, elements, fnFocus) {
    const elems = elements || elementsToFocus.value;
    if (!elems.length) {
      return;
    }

    const isTabPressed = e.key === 'Tab' || e.code === 'Tab';
    if (!isTabPressed) {
      return;
    }

    let firstElementToFocus = elems.at(0);
    let lastElementToFocus = elems.at(-1);

    // Take into account radio inputs with the same name, the
    // browser will cycle through them as a group, stepping on
    // the active one per stack.
    const firstElementRadioStack = getInputRadioStack(firstElementToFocus, elems);
    const lastElementRadioStack = getInputRadioStack(lastElementToFocus, elems);
    firstElementToFocus = getInputCheckedOrCurrent(
      firstElementToFocus,
      firstElementRadioStack
    );
    lastElementToFocus = getInputCheckedOrCurrent(
      lastElementToFocus,
      lastElementRadioStack
    );

    const focus = fnFocus || ((ev, el) => {
      el.focus();
      ev.preventDefault();
    });

    // If shift key pressed for shift + tab combination
    if (e.shiftKey) {
      if (document.activeElement === firstElementToFocus ||
        firstElementRadioStack.includes(document.activeElement)
      ) {
        // Add focus for the last focusable element
        focus(e, lastElementToFocus);
      }
      return;
    }

    // If tab key is pressed
    if (document.activeElement === lastElementToFocus ||
      lastElementRadioStack.includes(document.activeElement)
    ) {
      // Add focus for the first focusable element
      focus(e, firstElementToFocus);
    }
  }

  /**
   * Returns an array of radio inputs with the same name attribute
   * as the current element. If the current element is not a radio input,
   * an empty array is returned.
   *
   * @param {HTMLElement} currentElement
   * @param {HTMLElement[]} elements
   * @returns {HTMLElement[]}
   */
  function getInputRadioStack(currentElement, elements) {
    return currentElement.getAttribute('type') === 'radio'
      ? elements.filter(
        e => (e.getAttribute('type') === 'radio' &&
          e.getAttribute('name') === currentElement.getAttribute('name'))
      )
      : [];
  }

  /**
   *
   * @param {HTMLElement} currentElement
   * @param {HTMLElement[]} elements
   * @returns
   */
  function getInputCheckedOrCurrent(currentElement, elements = []) {
    const checked = elements.find(el => (el.hasAttribute('checked')));

    if (checked) {
      return checked;
    }

    return currentElement;
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

    focusElement(focusedElement, findPriorityElementOrFirst(elementsToFocus));
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

  function findPriorityElementOrFirst(elements) {
    return elements.find(e => e.hasAttribute('data-apos-focus-priority')) || elements[0];
  }
}
