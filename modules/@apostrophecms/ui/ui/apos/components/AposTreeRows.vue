<template>
  <VueDraggable
    tag="ol"
    class="apos-tree__list"
    :list="myRows"
    :group="{ name: treeId }"
    @start="startDrag"
    @end="endDrag"
    :data-list-id="listId"
    :disabled="!options.draggable"
    handle=".apos-tree__row__handle"
  >
    <li
      v-for="row in myRows" :key="row._id"
      :data-row-id="row._id" data-apos-tree-row
      :class="getRowClasses(row)"
      :aria-role="options.selectable ? 'button' : null"
      :tabindex="options.selectable ? 0 : null"
      v-on="options.selectable ? {
        'click': selectRow,
        'keydown': keydownRow
      } : {}"
    >
      <div class="apos-tree__row-data">
        <!-- {{ options.startCollapsed }} -->
        <button
          v-if="row.children && row.children.length > 0"
          class="apos-tree__row__toggle" data-apos-tree-toggle
          aria-label="Toggle section" :aria-expanded="!options.startCollapsed"
          @click="toggleSection($event)"
        >
          <chevron-down-icon :size="16" class="apos-tree__row__toggle-icon" />
        </button>
        <component
          v-for="(col, index) in headers"
          :key="`${col.name}-${index}`"
          :is="col.type === 'link' ? 'a' : col.type === 'button' ? 'button' : 'span'"
          :href="col.type === 'link' ? row[col.name] : false"
          :target="col.type === 'link' ? '_blank' : false"
          :class="getCellClasses(col, row)"
          :data-col="col.name"
          :style="getCellStyles(col.name, index)"
          @click="col.action ? $emit(col.action, row._id) : null"
        >
          <drag-icon
            v-if="options.draggable && index === 0" class="apos-tree__row__handle"
            :size="20"
            :fill-color="null"
          />
          <AposCheckbox
            v-if="options.bulkSelect && index === 0"
            class="apos-tree__row__checkbox"
            tabindex="-1"
            :field="{
              name: `${col.name}-${index}`,
              type: 'checkbox',
              hideLabel: true,
              label: `Toggle selection of ${row.title}`,
              disableFocus: true
            }"
            :status="{}"
            :choice="{ value: row._id }"
            v-model="checkedProxy"
          />
          <component
            v-if="col.icon" :is="icons[col.icon]"
            class="apos-tree__cell__icon"
          />
          <span v-show="!col.iconOnly">
            {{ row[col.name] }}
          </span>
        </component>
      </div>
      <AposTreeRows
        v-if="row.children"
        data-apos-branch-height
        ref="tree-branches"
        :rows="row.children"
        :headers="headers"
        :icons="icons"
        :col-widths="colWidths"
        :level="level + 1"
        :nested="nested"
        :list-id="row._id"
        :tree-id="treeId"
        :options="options"
        :class="{ 'is-collapsed': options.startCollapsed }"
        :style="{
          'max-height': options.startCollapsed ? '0' : null
        }"
        @busy="$emit('busy', $event)"
        @update="$emit('update', $event)"
        @edit="$emit('edit', $event)"
        v-model="checkedProxy"
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
  // Custom model to handle the v-model connection on the parent.
  model: {
    prop: 'checked',
    event: 'change'
  },
  props: {
    headers: {
      type: Array,
      required: true
    },
    icons: {
      type: Object,
      default () {
        return {};
      }
    },
    rows: {
      type: Array,
      required: true
    },
    checked: {
      type: Array,
      default() {
        // If this is not provided, we don't need to initiate an array.
        return null;
      }
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
    options: {
      type: Object,
      default () {
        return {};
      }
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
  emits: [ 'busy', 'update', 'change', 'edit' ],
  computed: {
    myRows() {
      return this.rows;
    },
    // Handle the local check state within this component.
    checkedProxy: {
      get() {
        return this.checked;
      },
      set(val) {
        this.$emit('change', val);
      }
    }
  },
  mounted() {
    // Use $nextTick to make sure attributes like `clientHeight` are settled.
    this.$nextTick(() => {
      if (!this.$refs['tree-branches']) {
        return;
      }
      this.setHeights();
    });
  },
  methods: {
    setHeights() {
      this.$refs['tree-branches'].forEach(branch => {
        // Add padding to the max-height to avoid needing a `resize`
        // event listener updating values.
        const height = branch.$el.clientHeight + 20;
        branch.$el.setAttribute('data-apos-branch-height', `${height}px`);
        branch.$el.style.maxHeight = `${height}px`;
      });
    },
    startDrag() {
      this.$emit('busy', true);
    },
    endDrag(event) {
      this.$emit('update', event);
      this.setHeights();
    },
    toggleSection(event, data) {
      const row = (data && data.row) ||
        event.target.closest('[data-apos-tree-row]');
      const rowList = row.querySelector('[data-apos-branch-height]');
      const toggle = (data && data.toggle) ||
        event.target.closest('[data-apos-tree-toggle]');

      if (toggle.getAttribute('aria-expanded') !== 'true') {
        rowList.style.maxHeight = rowList.getAttribute('data-apos-branch-height');
        toggle.setAttribute('aria-expanded', true);
        rowList.classList.remove('is-collapsed');
      } else if (rowList) {
        rowList.style.maxHeight = 0;
        toggle.setAttribute('aria-expanded', false);
        rowList.classList.add('is-collapsed');
      }
    },
    keydownRow(event) {
      if (event.key === ' ') {
        event.preventDefault();
        this.selectRow(event);
      }
    },
    selectRow(event) {
      const buttonParent = event.target.closest('[data-apos-tree-toggle]');

      if (buttonParent) {
        // If we've clicked on the toggle, don't select the row.
        return;
      }

      const row = event.target.closest('[data-row-id]');
      this.$emit('change', [ row.dataset.rowId ]);

      // Expand a row when the full parent row is selected.
      const toggle = row.querySelector('[data-apos-tree-toggle]');
      if (toggle && toggle.getAttribute('aria-expanded') !== 'true') {
        this.toggleSection(null, {
          row,
          toggle
        });
      }
    },
    getRowClasses(row) {
      return [
        'apos-tree__row',
        {
          'apos-tree__row--parent': row.children && row.children.length > 0,
          'apos-tree__row--selectable': this.options.selectable,
          'apos-tree__row--selected': this.options.selectable && this.checked[0] === row._id
        }
      ];
    },
    getCellClasses(col, row) {
      const classes = [ 'apos-tree__cell' ];
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

    &.is-collapsed {
      overflow-y: auto;
    }
  }

  .apos-tree__row--selectable {
    cursor: pointer;
  }
  .apos-tree__row-data {
    .apos-tree__row--selected > & {
      background-color: var(--a-base-9);
    }
  }

  .apos-tree__row__toggle-icon {
    transition: transform 0.3s ease;
    transform: rotate(-90deg) translateY(0.25em);

    [aria-expanded=true] > & {
      transform: none;
    }
  }
  .apos-tree__row__handle {
    margin-top: -0.25em;
    margin-right: 0.25em;
    line-height: 0;
    cursor: grab;

    &:active {
      cursor: grabbing;
    }

    .material-design-icon__svg {
      transition: fill 0.2s ease;
      fill: var(--a-base-8);
    }

    .sortable-chosen & .material-design-icon__svg,
    &:hover .material-design-icon__svg {
      fill: var(--a-base-2);
    }
  }

  .apos-tree__row__checkbox.apos-choice-label {
    align-items: flex-start;
    margin-right: 0.5em;
  }
</style>
