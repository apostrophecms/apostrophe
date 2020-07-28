<template>
  <VueDraggable
    tag="ol"
    class="apos-tree__list"
    :list="myRows"
    :group="{ name: treeId }"
    @start="startDrag"
    @end="endDrag"
    :data-list-id="listId"
    :disabled="!draggable"
    handle=".apos-tree__row__handle"
  >
    <li
      class="apos-tree__row"
      :class="{ 'apos-tree__row--parent': row.children && row.children.length > 0 }"
      v-for="row in myRows" :key="row.id"
      :data-row-id="row.id"
    >
      <div class="apos-tree__row-data">
        <button
          v-if="row.children && row.children.length > 0"
          class="apos-tree__row__toggle"
          aria-label="Toggle section"
          @click="toggleSection($event)"
        >
          <chevron-down-icon :size="16" class="apos-tree__row__toggle-icon" />
        </button>
        <component
          v-for="(col, index) in headers"
          :key="`${index}-${col.name}`"
          :is="col.name === 'url' ? 'a' : 'span'"
          :href="col.name === 'url' ? row[col.name] : false"
          :target="col.name === 'url' ? '_blank' : false"
          :class="getCellClasses(col, row)"
          :data-col="col.name"
          :style="getCellStyles(col.name, index)"
        >
          <drag-icon
            v-if="draggable && index === 0" class="apos-tree__row__handle"
            :size="20"
          />
          <component
            v-if="col.icon" :is="col.icon"
            class="apos-tree__cell__icon"
          />
          <span v-show="!col.iconOnly">
            {{ row[col.name] }}
          </span>
        </component>
      </div>
      <AposTreeRows
        v-if="row.children"
        data-apos-tree-branch
        :rows="row.children"
        :headers="headers"
        :col-widths="colWidths"
        :level="level + 1"
        :nested="nested"
        :list-id="row.id"
        :tree-id="treeId"
        :draggable="draggable"
        @busy="$emit('busy', $event)"
        @update="$emit('update', $event)"
      />
    </li>
  </VueDraggable>
</template>

<script>
import VueDraggable from 'vuedraggable';

export default {
  name: 'AposTreeRows',
  components: {
    VueDraggable
  },
  props: {
    headers: {
      type: Array,
      required: true
    },
    rows: {
      type: Array,
      required: true
    },
    colWidths: {
      type: Object,
      default () {
        return {};
      }
    },
    level: {
      type: Number,
      required: true
    },
    nested: {
      type: Boolean,
      required: true
    },
    draggable: {
      type: Boolean,
      required: true
    },
    listId: {
      type: String,
      required: true
    },
    treeId: {
      type: String,
      required: true
    }
  },
  emits: ['busy', 'update'],
  data () {
    return {
      myRows: this.rows
    };
  },
  computed: {
    isOpen() {
      return true;
    }
  },
  mounted() {
    // Use $nextTick to make sure attributes like `clientHeight` are settled.
    this.$nextTick(() => {
      const branches = this.$el.querySelectorAll('[data-apos-tree-branch]');

      branches.forEach(branch => {
        // Add padding to the max-height to avoid needing a `resize`
        // event listener updating values.
        const height = branch.clientHeight + 20;
        branch.setAttribute('data-apos-tree-branch', `${height}px`);
        branch.style.maxHeight = `${height}px`;
      });
    });
  },
  methods: {
    startDrag() {
      this.$emit('busy', true);
    },
    endDrag(event) {
      this.$emit('update', event);
    },
    toggleSection(event) {
      const row = event.target.closest('.apos-tree__row');
      const rowList = row.querySelector('[data-apos-tree-branch]');

      if (rowList && rowList.style.maxHeight === '0px') {
        rowList.style.maxHeight = rowList.getAttribute('data-apos-tree-branch');
        row.classList.remove('is-collapsed');
      } else if (rowList) {
        rowList.style.maxHeight = 0;
        row.classList.add('is-collapsed');
      }
    },
    getCellClasses(col, row) {
      const classes = ['apos-tree__cell'];
      classes.push(`apos-tree__cell--${col.name}`);

      if (col.iconOnly) {
        classes.push('apos-tree__cell--icon');
      }

      // TODO: How does this work for i18n?
      if (col.name === 'published' && row[col.name] === 'Unpublished') {
        classes.push('apos-tree__cell--disabled');
      }

      return classes;
    },
    getCellStyles(name, index) {
      const styles = {};
      if (this.nested && index === 0 && this.colWidths && this.colWidths[name]) {
        styles.width = `${this.colWidths[name] - (24 * this.level)}px`;
      } else if (this.colWidths && this.colWidths[name]) {
        styles.width = `${this.colWidths[name]}px`;
      }

      return styles;
    }
  }
};
</script>

<style lang="scss">
  .apos-tree__list {
    transition: max-height 0.3s ease;

    .apos-tree__row.is-collapsed & {
      overflow-y: auto;
    }
  }

  .apos-tree__row__toggle-icon {
    transition: transform 0.3s ease;

    .apos-tree__row.is-collapsed & {
      transform: rotate(-90deg) translateY(0.25em);
    }
  }
</style>
