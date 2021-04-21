<template>
  <VueDraggable
    tag="ol"
    class="apos-tree__list"
    :list="myRows"
    v-bind="dragOptions"
    @start="startDrag"
    @end="endDrag"
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
        <button
          v-if="row.children && row.children.length > 0"
          class="apos-tree__row__toggle" data-apos-tree-toggle
          aria-label="Toggle section" :aria-expanded="!options.startCollapsed"
          @click="toggleSection($event)"
        >
          <AposIndicator
            icon="chevron-down-icon"
            class="apos-tree__row__toggle-icon"
          />
        </button>
        <component
          v-for="(col, index) in headers"
          :key="`${col.property}-${index}`"
          :is="getEffectiveType(col, row)"
          :item="row"
          :header="col"
          :href="(getEffectiveType(col, row) === 'a') ? row[col.property] : false"
          :target="col.type === 'link' ? '_blank' : false"
          :class="getCellClasses(col, row)"
          :disabled="getCellDisabled(col, row)"
          :data-col="col.property"
          :style="getCellStyles(col.property, index)"
          @click="((getEffectiveType(col, row) === 'button') && col.action) ? $emit(col.action, row._id) : null"
          @edit="$emit('edit', row._id)"
          @preview="$emit('preview', row._id)"
          @copy="$emit('copy', row._id)"
          @discardDraft="$emit('discardDraft', row._id)"
          @archive="$emit('archive', row._id)"
          @restore="$emit('restore', row._id)"
        >
          <AposIndicator
            v-if="options.draggable && index === 0 && !row.parked"
            icon="drag-icon"
            class="apos-tree__row__icon apos-tree__row__icon--handle"
          />
          <AposIndicator
            v-if="index === 0 && row.parked && row.type !== '@apostrophecms/archive-page'"
            icon="lock-icon"
            class="apos-tree__row__icon apos-tree__row__icon--parked"
            tooltip="This page is parked and cannot be moved"
          />
          <AposIndicator
            v-if="index === 0 && row.type === '@apostrophecms/archive-page'"
            icon="lock-icon"
            class="apos-tree__row__icon apos-tree__row__icon--parked"
            tooltip="You cannot move the Archive"
          />
          <AposCheckbox
            v-if="options.bulkSelect && index === 0"
            class="apos-tree__row__checkbox"
            tabindex="-1"
            :field="{
              name: row._id,
              hideLabel: true,
              label: `Toggle selection of ${row.title}`,
              disableFocus: true
            }"
            :choice="{ value: row._id }"
            v-model="checkedProxy"
          />
          <span class="apos-tree__cell__value">
            <AposIndicator
              v-if="getEffectiveIcon(col, row)"
              :icon="getEffectiveIcon(col, row)"
              class="apos-tree__cell__icon"
              :icon-size="getEffectiveIconSize(col, row)"
            />
            <span class="apos-tree__cell__label" v-if="getEffectiveCellLabel(col, row)">
              {{ getEffectiveCellLabel(col, row) }}
            </span>
          </span>
        </component>
      </div>
      <AposTreeRows
        data-apos-branch-height
        :data-list-row="row._id"
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
        @update="$emit('update', $event)"
        @edit="$emit('edit', $event)"
        @preview="$emit('preview', $event)"
        @copy="$emit('copy', $event)"
        @discardDraft="$emit('discardDraft', $event)"
        @archive="$emit('archive', $event)"
        @restore="$emit('restore', $event)"
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
      default() {
        return [];
      }
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
  emits: [ 'update', 'change', 'edit', 'preview', 'copy', 'discardDraft', 'archive', 'restore' ],
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
    },
    dragOptions() {
      return {
        group: { name: this.treeId },
        dataListId: this.listId,
        disabled: !this.options.draggable,
        handle: '.apos-tree__row__icon--handle',
        ghostClass: 'is-dragging',
        filter: '.is-parked'
      };
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
    startDrag() {},
    endDrag(event) {
      this.$emit('update', event);
      this.$nextTick(() => {
        if (!this.$refs['tree-branches']) {
          return;
        }
        this.setHeights();
      });
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

      const row = event.target.closest('[data-apos-tree-row]');
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
      const classes = [
        'apos-tree__row',
        {
          'is-parked': !!row.parked,
          'apos-tree__row--parent': row.children && row.children.length > 0,
          'apos-tree__row--selectable': this.options.selectable,
          'apos-tree__row--selected': this.options.selectable && this.checked[0] === row._id
        }
      ];

      return classes;
    },
    getEffectiveType(col, row) {
      if (col.component) {
        return col.component;
      }
      if (row.type === '@apostrophecms/archive-page') {
        return 'span';
      } else if (col.type === 'link') {
        return 'a';
      } else if (col.type === 'button') {
        return 'button';
      } else {
        return 'span';
      }
    },
    getEffectiveIcon(col, row) {
      const boolStr = (!!row[col.property]).toString();

      if (row.type === '@apostrophecms/archive-page' || !col.cellValue) {
        return false;
      }

      if (col.cellValue && col.cellValue.icon) {
        return this.icons[col.cellValue.icon];
      }

      if (col.cellValue[boolStr] && col.cellValue[boolStr].icon) {
        return this.icons[col.cellValue[boolStr].icon];
      }

      return false;
    },
    getEffectiveIconSize(col, row) {
      const boolStr = (!!row[col.property]).toString();

      if (col.cellValue && col.cellValue.iconSize) {
        return col.cellValue.iconSize;
      }

      if (col.cellValue[boolStr] && col.cellValue[boolStr].iconSize) {
        return col.cellValue[boolStr].iconSize;
      }

      return 15;
    },
    getEffectiveCellLabel(col, row) {
      const excludedTypes = [ '@apostrophecms/archive-page' ];
      const boolStr = (!!row[col.property]).toString();

      // Opportunity to display a custom true/false label for cell value
      if (this.isObject(col.cellValue)) {

        if (excludedTypes.includes(row.type)) {
          return false;
        }

        // if we have a custom label
        if (col.cellValue[boolStr]) {
          // if custom is just a string
          if (typeof col.cellValue[boolStr] === 'string') {
            return col.cellValue[boolStr];
          }
          // if custom has label and other props
          if (col.cellValue[boolStr].label) {
            return col.cellValue[boolStr].label;
          }
        }
      }

      // Original default of just printing the row property value
      if (row[col.cellValue]) {
        return row[col.cellValue];
      }

      return false;
    },
    getCellClasses(col, row) {
      const classes = [ 'apos-tree__cell' ];
      const boolStr = (!!row[col.property]).toString();
      classes.push(`apos-tree__cell--${col.property}`);

      if (col.cellValue && col.cellValue.icon) {
        classes.push('apos-tree__cell--icon');
      }

      // Surface any custom label classes
      if (this.isObject(col.cellValue)) {
        // cast boolean to string to look through obj properties
        if (col.cellValue[boolStr] && col.cellValue[boolStr].class) {
          classes.push(col.cellValue[boolStr].class);
        }
      }
      return classes;
    },

    getCellDisabled(col, row) {
      if (this.getEffectiveType(col, row) === 'span') {
        return false;
      }
      if ((col.type === 'link') && (!row[col.property])) {
        return true;
      } else if (row.archived && (col.type === 'button')) {
        return true;
      } else {
        return false;
      }
    },

    getCellStyles(name, index) {
      const styles = {};
      if (this.nested && index === 0 && this.colWidths && this.colWidths[name]) {
        styles.width = `${this.colWidths[name] - (24 * this.level)}px`;
      } else if (this.colWidths && this.colWidths[name]) {
        styles.width = `${this.colWidths[name]}px`;
      }

      return styles;
    },

    // From lodash core
    isObject(value) {
      const type = typeof value;
      return value != null && (type === 'object' || type === 'function');
    }
  }
};
</script>

<style lang="scss" scoped>
  @import '../scss/shared/_table-vars';
  @import '../scss/shared/_table-rows';

  .apos-tree__list {
    width: 100%;
    margin-top: 0;
    margin-bottom: 0;
    padding-left: 0;
    list-style-type: none;
  }

  .apos-tree__row {
    &.is-dragging {
      opacity: 0.5;
    }
  }
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

  .apos-tree__row--parent {
    position: relative;

    &::before {
      position: absolute;
      top: 24px;
      bottom: 0;
      left: $row-nested-h-padding / 2;
      display: block;
      content: '';
      background-color: var(--a-base-8);
      width: 1px;
      transition: background-color 0.3s ease;
    }

    &.is-collapsed::before {
      background-color: transparent;
    }
  }

  .apos-tree__row__toggle {
    @include apos-button-reset();
    position: absolute;
    top: 50%;
    left: -$row-nested-h-padding / 2;
    background-color: var(--a-background-primary);
    transform: translate(-50%, -50%);
  }

  .apos-tree__row__toggle-icon {
    display: block;
    transition: transform 0.3s ease;
    transform: rotate(-90deg) translateY(0.25em);

    [aria-expanded=true] > & {
      transform: none;
    }
  }

  .apos-tree__row__icon {
    margin-right: 0.25em;

    /deep/ .material-design-icon__svg {
      transition: fill 0.2s ease;
      fill: var(--a-base-5);
    }
  }

  .apos-tree__row__icon--handle {
    cursor: grab;
    &:active {
      cursor: grabbing;
    }
    .sortable-chosen & /deep/ .material-design-icon__svg,
    &:hover /deep/ .material-design-icon__svg {
      fill: var(--a-base-2);
    }
  }

  .apos-tree__row__checkbox.apos-choice-label {
    align-items: flex-start;
    margin-right: 0.5em;
  }

  .apos-tree__row {
    .apos-tree--nested & {
      padding-left: $row-nested-h-padding;
    }
  }

  .apos-tree__row-data {
    .apos-tree__row--parent .apos-tree__row & {
      &::before {
        position: absolute;
        top: 50%;
        left: -$row-nested-h-padding * 1.5;
        display: block;
        width: 24px;
        height: 1px;
        content: '';
        background-color: var(--a-base-8);
      }
    }

    .apos-tree__row--parent > &:first-child {
      &::before {
        width: 14px;
      }
    }
  }

  .apos-tree__cell__value {
    display: flex;
    align-self: center;
  }

  .apos-tree__cell.is-published /deep/ .apos-tree__cell__icon {
    color: var(--a-success);
  }

  button.apos-tree__cell {
    @include apos-button-reset();
    padding: $cell-padding;
    border-bottom: 1px solid var(--a-base-8);
  }

</style>
