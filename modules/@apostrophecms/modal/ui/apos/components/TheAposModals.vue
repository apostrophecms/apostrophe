<template>
  <div :class="themeClass">
    <component
      v-bind="modal.props"
      :is="modal.componentName"
      v-for="modal in store.stack"
      :key="modal.id"
      :modal-data="modal"
      @modal-result="store.setModalResult(modal.id, $event)"
    />
  </div>
</template>

<script>
import { onMounted } from 'vue';
import { useAposTheme } from 'Modules/@apostrophecms/ui/composables/AposTheme';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

export default {
  name: 'TheAposModals',
  setup() {
    const { themeClass } = useAposTheme();
    const store = useModalStore();

    onMounted(() => {
      // Open one of the server-side configured top level admin bar menus by name.
      // To allow for injecting additional props dynamically, if itemName is an
      // object, it must have an itemName property and a props property. The props
      // property is merged with the props supplied by the server-side configuration.

      apos.bus.$on('admin-menu-click', async (itemName) => {
        let item;
        if (itemName === '@apostrophecms/global:singleton-editor') {
          // Special case: the global doc is a singleton, and we know its
          // _id in browserland
          item = {
            ...apos.modal.modals.find(modal => modal.itemName === '@apostrophecms/global:editor'),
            props: {
              docId: apos.modules['@apostrophecms/global']._id
            }
          };
        } else if ((typeof itemName) === 'object') {
          item = {
            ...apos.modal.modals.find(modal => modal.itemName === itemName.itemName),
            ...itemName
          };
        } else {
          item = apos.modal.modals.find(modal => modal.itemName === itemName);
        }
        if (item) {
          await store.execute(item.componentName, {
            ...item.props,
            moduleName: item.moduleName || getModuleName(item.itemName)
          });
        }
      });
    });

    function getModuleName(itemName) {
      if (!itemName) {
        return null;
      }
      return (itemName.indexOf(':') > -1) ? itemName.split(':')[0] : itemName;
    }

    return {
      themeClass,
      store
    };
  }
};
</script>
