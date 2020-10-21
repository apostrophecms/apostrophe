<template>
  <div id="apos-modals">
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
    // Open one of the standard top level admin bar menus by name
    apos.bus.$on('admin-menu-click', async (itemName) => {
      const item = apos.modal.modals.find(modal => modal.itemName === itemName);
      if (item) {
        await this.execute(item.componentName, {
          ...item.options,
          moduleName: this.getModuleName(item.itemName)
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
      return (itemName.indexOf(':') > -1) ? itemName.split(':')[0] : itemName;
    }
  }
};
</script>
