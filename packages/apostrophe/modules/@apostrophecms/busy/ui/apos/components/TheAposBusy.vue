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
        classes.push('apos-is-busy');
      }
      return classes.concat(this.themeClass);
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
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--a-overlay);
  transition: opacity 500ms ease;
  transition-delay: 300ms;
  opacity: 0;
  pointer-events: none;
}

.apos-busy.apos-is-busy {
  opacity: 1;
  pointer-events: auto;
}

.apos-busy__spinner {
  z-index: $z-index-default;
  width: 60px;
  height: 60px;

  &:deep(svg) {
    width: 100%;
    height: 100%;
  }
}
</style>
