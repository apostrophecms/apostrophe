<template>
  <div class="apos-busy">
    <div v-if="busy" class="busy"></div>
  </div>
</template>

<script>
export default {
  name: 'TheApostropheBusy',
  data() {
    return {
      busy: false
    }
  },
  mounted() {
    apos.bus.$on('apos-busy', state => (this.busy = state));
  }
};
</script>

<style scoped>
.busy {
  background: #e9e9e9;
  position: absolute;
  pointer-events: none;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  opacity: 0.5;
}
</style>
