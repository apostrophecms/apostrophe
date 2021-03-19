<template>
  <div
    class="apos-busy"
    :class="classes"
  >
    <AposSpinner class="apos-busy__spinner" />
  </div>
</template>

<script>
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';
export default {
  name: 'TheAposBusy',
  mixins: [ AposThemeMixin ],
  data() {
    return {
      busy: false,
      busyCount: 0
    };
  },
  computed: {
    classes() {
      const classes = [];
      if (this.busy) {
        classes.push('is-busy');
      }
      return [].concat(classes, this.themeClass);
    }
  },
  mounted() {
    apos.bus.$on('busy', state => {
      // TODO: Possibly add a check for `state.name === 'busy'` again if other
      // busy contexts are added.
      if (state.active === false && this.busyCount >= 0) {
        this.busyCount--;
      }

      if (this.busyCount === 0) {
        this.busy = state.active;
      }

      if (state.active === true) {
        this.busyCount++;
      }
    });
  }
};
</script>

<style lang="scss" scoped>
.apos-busy {
  z-index: $z-index-busy;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  width: 100%;
  height: 100%;
  justify-content: center;
  align-items: center;
  background: var(--a-overlay);
  transition: opacity 0.5s ease;
  transition-delay: 0.3s;
  opacity: 0;
  pointer-events: none;
}

.apos-busy.is-busy {
  opacity: 1;
  pointer-events: auto;
}

.apos-busy__spinner {
  z-index: $z-index-default;
  width: 60px;
  height: 60px;
  & /deep/ svg {
    width: 100%;
    height: 100%;
  }
}
</style>
