<template>
  <div
    class="apos-tree__row-data apos-tree__header" :class="headerClasses"
    :aria-hidden="spacerOnly"
  >
    <span
      v-for="(col, index) in headers"
      :key="`${index}-${col.property}`"
      class="apos-tree__cell"
      :class="`apos-tree--column-${col.property}`"
      :data-spacer="spacerOnly && col.property"
      :style="getCellStyles(col)"
    >
      <component
        v-if="col.columnHeaderIcon" :is="icons[col.columnHeaderIcon]"
        class="apos-tree__cell__icon"
      />
      {{ col.columnHeader }}
    </span>
  </div>
</template>

<script>
export default {
  name: 'AposTreeHeader',
  props: {
    headers: {
      type: Array,
      required: true
    },
    icons: {
      type: Object,
      default() {
        return {};
      }
    },
    hidden: {
      type: Boolean,
      default: false
    },
    spacerOnly: {
      type: Boolean,
      default: false
    },
    colWidths: {
      type: Object,
      default () {
        return {};
      }
    }
  },
  emits: [ 'calculated' ],
  computed: {
    headerClasses() {
      if (this.spacerOnly || this.hidden) {
        return 'apos-tree__header--hidden';
      }
      return '';
    }
  },
  watch: {
    headers() {
      if (this.spacerOnly) {
        // Give this a moment to make sure we have the final widths.
        this.$nextTick(() => {
          this.calculateWidths();
        });
      }
    }
  },
  mounted() {
    if (this.spacerOnly) {
      this.calculateWidths();

      window.addEventListener('resize', debounce(this.calculateWidths, 100));
    }
  },
  destroyed() {
    if (this.spacerOnly) {
      window.removeEventListener('resize', debounce(this.calculateWidths, 100));
    }
  },
  methods: {
    calculateWidths() {
      // TODO: widths should be calculated from a full-table perspective so that
      // every cell's content has the opportunity to inform the overall column width.
      const colWidths = {};

      this.headers.forEach(col => {
        const ref = this.$el.querySelector(`[data-spacer="${col.property}"]`);

        if (!ref) {
          return;
        }

        // Set the column width to the spacer width plus 15 for extra wiggle
        // room.
        colWidths[col.property] = ref.clientWidth + 15;
      });
      this.$emit('calculated', colWidths);
    },
    getCellStyles (cell) {
      const styles = {};
      if (this.colWidths && this.colWidths[cell.property]) {
        styles.width = `${this.colWidths[cell.property]}px`;
      }
      return styles;
    }
  }
};

// Debounce function from https://davidwalsh.name/javascript-debounce-function
function debounce(func, wait, immediate) {
  let timeout;

  return function() {
    const context = this;
    const args = arguments;
    const later = function() {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
};
</script>

<style lang="scss" scoped>
@import '../scss/shared/_table-vars';
@import '../scss/shared/_table-rows';

.apos-tree__header {
  color: var(--a-base-3);
}

.apos-tree__header.apos-tree__header--hidden {
  display: block;
  height: 0;
  visibility: hidden;
}
</style>
