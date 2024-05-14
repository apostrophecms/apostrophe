import { defineStore } from 'pinia';
import { ref } from 'vue';
import cuid from 'cuid';

export const useModalStore = defineStore('modal', () => {
  const stack = ref([]);

  function add(modal) {
    stack.value.push(modal);
  }

  function get(id) {
    return stack.value.find(modal => id === modal.id);
  }

  function getAt(index) {
    const last = stack.value.length - 1;
    const target = index < 0
      ? last + 1 + index
      : index > stack.value.length
        ? last
        : index;

    const modal = stack.value[target] || {};

    return modal;
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
        id: `modal:${cuid()}`,
        componentName,
        resolve,
        props: props || {}
        /* elementsToFocus: [], */
        /* focusedElement: null */
      };

      stack.value.push(item);
      apos.bus.$emit('modal-launched', item);
    });
  }

  function updateModalData(id, data) {
    stack.value = stack.value.map((modal) => {
      return modal.id === id ? {
        ...modal,
        ...data
      } : modal;
    });
  }

  function setModalResult(modalId, result) {
    console.log('modalId', modalId);
    console.log('result', result);
    stack.value = stack.value.map((modal) => {
      return modal.id === modalId
        ? {
          ...modal,
          result
        }
        : modal;
    });
  }

  function resolve(modal) {
    stack.value = stack.value.filter(_modal => modal.id !== _modal.id);

    console.log('modal.result', modal.result);
    modal.resolve(modal.result);
    apos.bus.$emit('modal-resolved', modal);
  }

  return {
    stack,
    add,
    get,
    getAt,
    getProperties,
    execute,
    updateModalData,
    setModalResult,
    resolve
  };
});
