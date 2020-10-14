<template>
  <div id="apos-modals">
    <portal to="modal-target">
      <component
        v-for="modal in activeModals" :key="modal.itemName"
        :is="modal.componentName" :module-name="getModuleName(modal.itemName)"
        v-bind="activeProps[modal.itemName]"
        @safe-close="finishExit(modal.itemName)"
      />
    </portal>
    <portal-target name="modal-target" multiple />
  </div>
</template>

<script>
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
      active: {},
      activeProps: {}
    };
  },
  computed: {
    activeModals() {
      return this.modals.filter(modal => {
        return this.active[modal.itemName];
      });
    }
  },
  mounted() {
    // If you need to pass props into the modal, emit an object instead of the
    // itemName string. The object should have a `name` property, which would be
    // the itemName if not using props. Then include any props on a `props`
    // object that will be passed in using the `v-bind` directive.
    apos.bus.$on('admin-menu-click', (itemName) => {
      if (typeof itemName === 'object') {
        this.setIsActive(itemName.name, true);
        this.activeProps[itemName.name] = itemName.props
          ? { ...itemName.props } : {};
      } else {
        this.setIsActive(itemName, true);
        this.activeProps[itemName] = {};
      }
    });
  },
  methods: {
    setIsActive(itemName, state) {
      // https://vuejs.org/v2/guide/reactivity.html#Change-Detection-Caveats
      this.$set(this.active, itemName, state);
    },
    finishExit: function (moduleName) {
      this.setIsActive(moduleName, false);
      delete this.activeProps[moduleName];
    },
    getModuleName(itemName) {
      return (itemName.indexOf(':') > -1) ? itemName.split(':')[0] : itemName;
    }
  }
};
</script>
