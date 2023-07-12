<template>
  <div
    id="apos-modals" :class="themeClass"
  >
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
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';
export default {
  name: 'TheAposModals',
  mixins: [ AposThemeMixin ],
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
        const item = {
          id: cuid(),
          componentName,
          resolve,
          props: props || {}
        };

        this.stack.push(item);
        apos.bus.$emit('modal-launched', item);
      });
    },
    resolve(modal) {
      this.stack = this.stack.filter(_modal => modal.id !== _modal.id);
      modal.resolve(modal.result);
      apos.bus.$emit('modal-resolved', modal);
    },
    getModuleName(itemName) {
      if (!itemName) {
        return null;
      }
      return (itemName.indexOf(':') > -1) ? itemName.split(':')[0] : itemName;
    },
    getAt(index) {
      const last = this.stack.length - 1;
      const target = index < 0
        ? last + 1 + index
        : index > this.stack.length
          ? last
          : index;

      const modal = this.stack[target] || {};

      return modal;
    },
    getProperties(id) {
      const [ stackModal = null ] = this.stack.filter(modal => id === modal.id);
      if (!stackModal || !this.modals) {
        return {};
      }

      const properties = {
        ...this.modals
          .find(modal => modal.componentName === stackModal.componentName &&
            modal.props.moduleName === stackModal.props.moduleName)
      };

      return properties;
    }
  }
};
</script>
