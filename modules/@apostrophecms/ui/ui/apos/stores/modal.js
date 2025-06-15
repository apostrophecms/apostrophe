import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createId } from '@paralleldrive/cuid2';

export const useModalStore = defineStore('modal', () => {
  const stack = ref([]);
  const activeId = ref(null);
  let keyDownListeners = [];

  window.addEventListener('keydown', handleKeyDown);

  const activeModal = computed(() => {
    return stack.value.find(modal => activeId.value === modal.id);
  });

  function add(modal) {
    stack.value.push(modal);
  }

  function remove(id) {
    const modal = get(id);
    if (!modal) {
      return;
    }

    modal.resolve(modal.result);
    apos.bus.$emit('modal-resolved', modal);
    stack.value = stack.value.filter(modal => id !== modal.id);
    const current = getAt(-1);
    activeId.value = current.id || null;
  }

  function getActiveLocale() {
    return activeModal.value?.locale || apos.i18n.locale;
  }

  function get(id) {
    return id
      ? stack.value.find(modal => id === modal.id)
      : stack.value;
  }

  function getDepth() {
    return stack.value.length;
  }

  // Listens for keystrokes globally, but delivers them only
  // if "el" is currently in the topmost modal (if any)
  function onKeyDown(el, fn) {
    if (!
      (
        (el instanceof Element) &&
        ((typeof fn) === 'function')
      )
    ) {
      throw new Error('pass el, fn where el is your DOM element');
    }
    keyDownListeners.push({
      el,
      fn
    });
  }

  // Reverse of onKeyDown. Note you call it with just fn
  function offKeyDown(fn) {
    if ((typeof fn) !== 'function') {
      throw new Error('Call offKeyDown with just fn');
    }
    keyDownListeners = keyDownListeners.filter(({ fn: fnFound }) => fnFound !== fn);
  }

  function handleKeyDown(e) {
    const top = stack.value.at(-1)?.modalEl;
    for (const { el, fn } of keyDownListeners) {
      if (top && (getDepthOf(el) < getDepthOf(top))) {
        continue;
      }
      fn(e);
    }
  }

  function getAt(index) {
    const last = stack.value.length - 1;
    const target = index < 0
      ? last + 1 + index
      : index > stack.value.length
        ? last
        : index;

    return stack.value[target] || {};
  }

  function getProperties(id) {
    const stackModal = stack.value.find(modal => id === modal.id);
    if (!stackModal || !apos.modal.modals) {
      return {};
    }

    const properties = {
      ...apos.modal.modals
        .find(modal => modal.componentName === stackModal.componentName &&
          modal.props.moduleName === stackModal.props.moduleName)
    };

    return properties;
  }

  async function execute(componentName, props) {
    return new Promise((resolve) => {
      const item = {
        id: `modal:${createId()}`,
        componentName,
        resolve,
        props: props || {},
        elementsToFocus: [],
        focusedElement: null,
        locale: activeModal.value?.locale || apos.i18n.locale,
        hasContextLocale: activeModal.value
          ? (activeModal.value.hasContextLocale ||
              activeModal.value.locale !== apos.i18n.locale)
          : false
      };

      activeId.value = item.id;
      stack.value.push(item);
      apos.bus.$emit('modal-launched', item);
    });
  }

  function updateModalData(id, data) {
    stack.value = stack.value.map((modal) => {
      return modal.id === id
        ? {
          ...modal,
          ...data
        }
        : modal;
    });
  }

  function setModalResult(modalId, result) {
    stack.value = stack.value.map((modal) => {
      return modal.id === modalId
        ? {
          ...modal,
          result
        }
        : modal;
    });
  }

  async function confirm(content, options = {}) {
    return execute(apos.modal.components.confirm, {
      content,
      mode: 'confirm',
      options
    });
  }

  async function alert(alertContent, options = {}) {
    return execute(apos.modal.components.confirm, {
      content: alertContent,
      mode: 'alert',
      options
    });
  }

  async function report(content, options = {}) {
    const {
      items, headers, ...rest
    } = content;
    return execute(apos.modal.components.report, {
      items,
      headers,
      content: rest,
      options
    });
  }

  // Returns true if el1 is "on top of" el2 in the
  // modal stack, as viewed by the user. If el1 is a
  // modal that appears later in the stack than el2
  // (visually stacked on top), this method returns true.
  // If el2 is `document` and el1 is a modal, this
  // method returns true. For convenenience, if el1
  // or el2 is not a modal, it is treated as its DOM
  // parent modal, or as `document`.
  //
  // If el1 is no longer connected to the DOM then it
  // is also considered to be "on top" e.g. not something
  // that should concern `v-click-outside-element` and
  // similar functionality. This is necessary because
  // sometimes Vue removes elements from the DOM before
  // we can examine their relationships.
  //
  // If el1 is part of a notification, it is always considered
  // to be on top of el2. This prevents unwanted dismissals of
  // intermediate modals beneath notifications.
  function onTopOf(el1, el2) {
    if (el1.closest('[data-apos-notification]')) {
      return true;
    }
    // Why is this here? Things can be stacked above context menus.
    // But, I'm afraid to remove it -Tom
    if (el2.matches('[data-apos-menu]')) {
      return false;
    }
    if (!el1.isConnected) {
      // If el1 is no longer in the DOM we can't make a proper determination,
      // returning true prevents unwanted things like click-outside-element
      // events from firing
      return true;
    }
    const index1 = getDepthOf(el1);
    const index2 = getDepthOf(el2);
    return index1 > index2;
  }

  // Returns the depth of el in the modal stack, where higher numbers
  // are higher in the stack ("on top"). Returns -1 if el is not
  // in any modal. If el is not in the DOM -1 is always returned
  function getDepthOf(el) {
    if (!el.isConnected) {
      return -1;
    }
    if (!el.matches('[data-apos-modal]')) {
      el = el.closest('[data-apos-modal]') || document;
    }
    if (el === document) {
      return -1;
    }
    return stack.value.findIndex(modal => modal.modalEl === el);
  }

  return {
    stack,
    activeId,
    activeModal,
    getActiveLocale,
    add,
    remove,
    get,
    getAt,
    getDepth,
    getProperties,
    execute,
    updateModalData,
    setModalResult,
    confirm,
    alert,
    report,
    onTopOf,
    onKeyDown,
    offKeyDown
  };
});
