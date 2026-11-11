import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';

export const useModalStore = defineStore('modal', () => {
  const stack = ref([]);

  // The modal the editor works in: the last one opened, leaving out windows
  // stacked above every modal
  const activeModal = computed(() => {
    return stack.value.findLast(modal => !isStackedOnTop(modal));
  });
  const activeId = computed(() => activeModal.value?.id || null);

  // The corner of each window trigger, by trigger name
  const triggerCorners = ref({});

  function getTriggerCorner(name) {
    return triggerCorners.value[name] || null;
  }

  function setTriggerCorner(name, corner) {
    triggerCorners.value = {
      ...triggerCorners.value,
      [name]: corner
    };
  }

  const hasChooserModal = computed(() => {
    return stack.value.some(modal =>
      modal.props.hasRelationshipField === true || !!modal.props.relationshipField
    );
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
  }

  function isStackedOnTop(modal) {
    return modal.stacking === 'top';
  }

  // Windows stacked above every modal, in the order they were opened
  function getStackedOnTop() {
    return stack.value.filter(isStackedOnTop);
  }

  function getActiveLocale() {
    return activeModal.value?.locale || apos.i18n.locale;
  }

  function getActiveDirection() {
    const locale = getActiveLocale();
    return apos.i18n.locales[locale]?.direction;
  }

  function getAdminContentDirectionClass() {
    const direction = getActiveDirection();

    if (direction === 'rtl') {
      return 'apos-rtl';
    }

    return null;
  }

  function getAdminDirectionClass() {
    const direction = getActiveDirection();

    if (direction === 'rtl') {
      return 'apos-ltr';
    }

    // Always force LTR if the page locale direction is RTL
    const pageLocaleDirection = apos.i18n.locales[apos.i18n.locale]?.direction;
    if (pageLocaleDirection === 'rtl') {
      return 'apos-ltr';
    }

    return null;
  }

  // Only force RTL, the input fields are already LTR by default
  // (because the admin UI is always LTR)
  function getAdminFieldDirectionClass(overrideDirection) {
    const direction = getActiveDirection() || 'ltr';

    if (overrideDirection) {
      return overrideDirection === 'rtl' ? 'apos-rtl' : null;
    }

    if (direction === 'rtl') {
      return 'apos-rtl';
    }

    return null;
  }

  function get(id) {
    return id
      ? stack.value.find(modal => id === modal.id)
      : stack.value;
  }

  function getDepth() {
    return stack.value.length;
  }

  // The modals that block the page: all but those without an overlay,
  // such as a window the page stays usable around
  function getBlockingDepth() {
    return stack.value.filter(modal => modal.overlay !== 'none').length;
  }

  // Windows stacked above every modal are left out
  function getAt(index) {
    const layered = stack.value.filter(modal => !isStackedOnTop(modal));
    const last = layered.length - 1;
    const target = index < 0
      ? last + 1 + index
      : index > layered.length
        ? last
        : index;

    return layered[target] || {};
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
    const pipeline = componentName.split('|');
    componentName = pipeline.pop();
    const transformers = pipeline;
    for (const transformer of transformers) {
      props = await apos.ui.transformers[transformer](props);
    }
    return new Promise((resolve) => {
      const modalLocale = props?.locale ||
        activeModal.value?.locale ||
        apos.i18n.locale;
      const item = {
        id: `modal:${createId()}`,
        componentName,
        resolve,
        props: props || {},
        elementsToFocus: [],
        focusedElement: null,
        locale: modalLocale,
        hasContextLocale: activeModal.value
          ? (activeModal.value.hasContextLocale ||
              activeModal.value.locale !== apos.i18n.locale)
          : modalLocale !== apos.i18n.locale
      };

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

  function isTopManager(component) {
    // The stack doesn't contain actual components, it contains records of
    // information about them. Locate the right record in the stack by
    // its modalEl
    const manager = stack.value.find(c => c.modalEl === component.$el);
    const topManager = stack.value.findLast(c => {
      return (c.componentName || '').endsWith('Manager');
    });
    return manager?.id === topManager?.id;
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
  // are higher in the stack ("on top"). Windows stacked above every modal
  // come after all others, and so do window triggers. Returns -1 if el is
  // not in any modal. If el is not in the DOM -1 is always returned
  function getDepthOf(el) {
    if (!el.isConnected) {
      return -1;
    }
    if (el.closest('[data-apos-window-trigger]')) {
      return stack.value.length * 2;
    }
    if (!el.matches('[data-apos-modal]')) {
      el = el.closest('[data-apos-modal]') || document;
    }
    if (el === document) {
      return -1;
    }
    const index = stack.value.findIndex(modal => modal.modalEl === el);
    return (index > -1) && isStackedOnTop(stack.value[index])
      ? stack.value.length + index
      : index;
  }

  // A window stacked above every modal is on top for its own events, and
  // never takes that from the modal under it
  function isOnTop(el) {
    const own = el.closest?.('[data-apos-modal]');
    const stacked = own && stack.value
      .some(modal => modal.modalEl === own && isStackedOnTop(modal));
    if (stacked) {
      return true;
    }
    const top = activeModal.value?.modalEl;

    return (top && getDepthOf(el) === getDepthOf(top)) || false;
  }

  return {
    stack,
    activeId,
    activeModal,
    hasChooserModal,
    getActiveLocale,
    getActiveDirection,
    getAdminDirectionClass,
    getAdminContentDirectionClass,
    getAdminFieldDirectionClass,
    add,
    remove,
    get,
    getAt,
    getDepth,
    getBlockingDepth,
    getStackedOnTop,
    getTriggerCorner,
    setTriggerCorner,
    getProperties,
    execute,
    updateModalData,
    setModalResult,
    confirm,
    alert,
    report,
    onTopOf,
    isOnTop,
    isTopManager
  };
});
