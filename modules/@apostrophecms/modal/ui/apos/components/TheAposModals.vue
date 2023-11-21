<template>
  <div
    id="apos-modals"
    :class="themeClass"
  >
    <component
      v-bind="modal.props"
      :is="modal.componentName"
      v-for="modal in stack"
      :key="modal.id"
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
      return new Promise((resolve) => {
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
    },

    async confirm(content, options = {}) {
      return this.execute(apos.modal.components.confirm, {
        content,
        mode: 'confirm',
        options
      });
    },

    async alert(alertContent, options = {}) {
      return this.execute(apos.modal.components.confirm, {
        content: alertContent,
        mode: 'alert',
        options
      });
    },

    onTopOf(el1, el2) {
      if (!el1.isConnected) {
        // If el1 is no longer in the DOM we can't make a proper determination,
        // returning true prevents unwanted things like click-outside-element
        // events from firing
        return true;
      }
      if (!el1.matches('[data-apos-modal]')) {
        el1 = el1.closest('[data-apos-modal]') || document;
      }
      if (!el2.matches('[data-apos-modal]')) {
        el2 = el2.closest('[data-apos-modal]') || document;
      }
      if (el1 === document) {
        return false;
      }
      if (el2 === document) {
        return true;
      }
      const index1 = this.stack.findIndex(modal => modal.$el === el1);
      const index2 = this.stack.findIndex(modal => modal.$el === el2);
      if (index1 === -1) {
        throw new Error('apos.modal.onTopOf: el1 is not in the modal stack');
      }
      if (index2 === -1) {
        throw new Error('apos.modal.onTopOf: el2 is not in the modal stack');
      }
      return index1 > index2;
    }
  }
};
</script>
