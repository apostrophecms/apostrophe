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
        >
          <chevron-down-icon :size="16" class="apos-tree__row__toggle-icon" />
        </button>
        <component
          v-for="(col, index) in headers"
          :key="`${col.name}-${index}`"
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
            :fill-color="null"
          />
          <AposCheckbox
            v-if="selectable && index === 0"
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
            :choice="{ value: row.id }"
            v-model="checkedProxy"
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
        :rows="row.children"
        :headers="headers"
        :col-widths="colWidths"
        :level="level + 1"
        :nested="nested"
        :list-id="row.id"
        :tree-id="treeId"
        :draggable="draggable"
        :selectable="selectable"
        @busy="$emit('busy', $event)"
        @update="$emit('update', $event)"
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
    draggable: {
      type: Boolean,
      required: true
    },
    selectable: {
      type: Boolean,
      default: false
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
  emits: ['busy', 'update', 'change'],
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
    },
    isOpen() {
      return true;
    }
  },
  methods: {
    startDrag() {
      this.$emit('busy', true);
    },
    endDrag(event) {
      this.$emit('update', event);
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
  .apos-tree__row__handle {
    margin-top: -0.25em;
    margin-right: 0.25em;
    line-height: 0;
    cursor: move;

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
