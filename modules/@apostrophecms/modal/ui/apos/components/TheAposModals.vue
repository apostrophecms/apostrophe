<template>
  <div id="apos-modals" ref="modals">
    <component
      v-for="modal in stack" :key="modal.id"
      :is="modal.componentName"
      v-bind="modal.props"
      @modal-result="modal.result = $event"
      @safe-close="resolve(modal)"
    />
  </div>
</template>

<script>
import cuid from 'cuid';

export default {
  name: 'TheAposModals',
  props: {
    modals: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      stack: []
    };
  },
  mounted() {
    window.apos.util.addClass(this.$refs.modals, `apos-theme--primary-${window.apos.ui.theme.primary}`);
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
        await this.execute(item.componentName, {
          ...item.props,
          moduleName: item.moduleName || this.getModuleName(item.itemName)
        });
      }
    });
  },
  methods: {
    async execute(componentName, props) {
      return new Promise((resolve, reject) => {
        this.stack.push({
          id: cuid(),
          componentName,
          resolve,
          props: props || {}
        });
      });
    },
    resolve(modal) {
      this.stack = this.stack.filter(_modal => modal.id !== _modal.id);
      modal.resolve(modal.result);
    },
    getModuleName(itemName) {
      if (!itemName) {
        return null;
      }
      return (itemName.indexOf(':') > -1) ? itemName.split(':')[0] : itemName;
    }
  }
};
</script>
