<template>
  <div v-if="busy" class="apos-busy">
    <AposLoading class="apos-busy__spinner" />
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
      // TODO: Eventually add a counter to track if busy state was enabled
      // multiple times, to require clearing it an equal number of times.
      // Possibly add a check for `state.name === 'busy'` again.
      this.busy = state.active;
    });
  }
};
</script>

<style lang="scss" scoped>
.apos-busy {
  z-index: $z-index-busy;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--a-overlay);
    opacity: 0.5;
  }
}

.apos-busy__spinner {
  z-index: $z-index-default;
}
</style>
