<template>
  <div id="apos-modals">
    <component v-for="modal in modals" :is="modal.componentName" :options="modal.options" v-if="active[modal.itemName]" @close="setIsActive(modal.itemName, false)">
    </component>
  </div>
</template>

<script>
export default {
  name: 'TheApostropheModals',
  data() {
    return {
      active: {}
    }
  },
  methods: {
    setIsActive(itemName, state) {
      // https://vuejs.org/v2/guide/reactivity.html#Change-Detection-Caveats
      this.$set(this.active, itemName, state);
    }
  },
  props: {
    modals: Array
  },
  mounted() {
    apos.bus.$on('adminBarItem', (itemName) => {
      this.setIsActive(itemName, true);
    });
  }
};
</script>
