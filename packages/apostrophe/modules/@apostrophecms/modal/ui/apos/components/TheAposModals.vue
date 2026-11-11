<template>
  <div
    :class="themeClass"
    @keydown.tab="onKeydownTab"
  >
    <component
      v-bind="modal.props"
      :is="modal.componentName"
      v-for="modal in store.stack"
      :key="modal.id"
      :modal-data="modal"
      @modal-result="store.setModalResult(modal.id, $event)"
    />
    <AposWindowTrigger
      v-for="trigger in shownTriggers"
      :key="trigger.name"
      :trigger="trigger"
    />
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useAposTheme } from 'Modules/@apostrophecms/ui/composables/AposTheme';
import { useAposFocus } from 'Modules/@apostrophecms/modal/composables/AposFocus';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

export default {
  name: 'TheAposModals',
  setup() {
    const { themeClass } = useAposTheme();
    const { cycleAcrossGroups, getStackedFocusGroups } = useAposFocus();
    const store = useModalStore();

    // A trigger hides while its window is open
    const shownTriggers = computed(() => (apos.modal.triggers || [])
      .filter(trigger => !store.stack
        .some(modal => modal.componentName === trigger.componentName)));

    onMounted(() => {
      // Open one of the server-side configured top level admin bar menus by
      // name. To allow for injecting additional props dynamically, if itemName
      // is an object, it must have an itemName property and a props property.
      // The props property is merged with the props supplied by the server-side
      // configuration.

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

    // Tab from a window above every modal, or a trigger, stays in the cycle
    // of the modal under it that traps focus
    function onKeydownTab(event) {
      if (!event.target.closest?.('[data-apos-stacking="top"]')) {
        return;
      }
      const modal = store.activeModal;
      if (!modal?.modalEl || !modal.trapsFocus) {
        return;
      }
      const groups = getStackedFocusGroups(modal.modalEl);
      if (groups) {
        cycleAcrossGroups(event, groups);
      }
    }

    function getModuleName(itemName) {
      if (!itemName) {
        return null;
      }
      return (itemName.indexOf(':') > -1) ? itemName.split(':')[0] : itemName;
    }

    return {
      themeClass,
      store,
      shownTriggers,
      onKeydownTab
    };
  }
};
</script>
