<template>
  <div id="apos-modals">
    <div v-for="modal in modals">
      <component :is="modal" v-if="active[modal]" @close="setIsActive(modal, false)">
      </component>
    </div>
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
    setIsActive(modal, state) {
      // https://vuejs.org/v2/guide/reactivity.html#Change-Detection-Caveats
      this.$set(this.active, modal, state);
    }
  },
  props: {
    modals: Array
  },
  mounted() {
    apos.bus.$on('adminBarItem', (modal) => {
      this.setIsActive(modal, true);
    });
  }
};
</script>
