<template>
  <div id="apos-modals">
    <component
      v-for="modal in activeModals" :key="modal.itemName"
      :is="modal.componentName" :module-name="modal.itemName"
      @safe-close="setIsActive(modal.itemName, false)"
    />
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
      active: {}
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
    apos.bus.$on('adminBarItem', (itemName) => {
      this.setIsActive(itemName, true);
    });
  },
  methods: {
    setIsActive(itemName, state) {
      // https://vuejs.org/v2/guide/reactivity.html#Change-Detection-Caveats
      this.$set(this.active, itemName, state);
    },
    finishExit: function () {
      this.active = false;
    }

  }
};
</script>
