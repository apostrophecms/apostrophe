<template>
  <div class="apos-busy">
    <div v-if="busy" class="busy" />
  </div>
</template>

<script>
export default {
  name: 'TheAposBusy',
  data() {
    return {
      busy: false
    };
  },
  mounted() {
    apos.bus.$on('apos-busy', state => {
      if (state.name === 'busy') {
        this.busy = state.active;
      }
    });
  }
};
</script>

<style lang="scss" scoped>
.busy {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: #e9e9e9;
  pointer-events: none;
  opacity: 0.5;
}
</style>
