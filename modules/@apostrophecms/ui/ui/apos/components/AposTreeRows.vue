<template>
  <draggable
    item-key="_id"
    class="apos-tree__list"
    tag="ol"
    :list="computedRows"
    :options="dragOptions"
    @start="startDrag"
    @end="endDrag"
    @add="add"
    @remove="remove"
  >
    <template #item="{element: row}">
      <li
        :data-row-id="row._id"
        data-apos-tree-row
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
            v-if="row.__count > 0"
            class="apos-tree__row__toggle"
            data-apos-tree-toggle
            :aria-label="$t('apostrophe:toggleSection')"
            :aria-expanded="row.__expanded"
            @click="toggleSection($event)"
          >
            <AposIndicator
              icon="chevron-down-icon"
              class="apos-tree__row__toggle-icon"
            />
          </button>
          <component
            :is="getEffectiveType(col, row)"
            v-for="(col, index) in headers"
            :key="`${row.__key}-${col.property}-${index}`"
            :draft="row"
            :published="row._publishedDoc"
            :header="col"
            :href="(getEffectiveType(col, row) === 'a') ? row[col.property] : false"
            :target="col.type === 'link' ? '_blank' : false"
            :class="getCellClasses(col, row)"
            :disabled="getCellDisabled(col, row)"
            :data-col="col.property"
            :style="getCellStyles(col.property, index)"
            :options="moduleOptions"
            @click="
              ((getEffectiveType(col, row) === 'button') && col.action)
                ? $emit(col.action, row._id)
                : null
            "
          >
            <AposIndicator
              v-if="options.draggable && index === 0 && !row.parked"
              icon="drag-icon"
              class="apos-tree__row__icon apos-tree__row__icon--handle"
            />
            <AposIndicator
              v-if="index === 0 && row.parked &&
                row.type !== '@apostrophecms/archive-page'"
              icon="lock-icon"
              class="apos-tree__row__icon apos-tree__row__icon--parked"
              tooltip="apostrophe:pageIsParked"
            />
            <AposIndicator
              v-if="index === 0 && row.type === '@apostrophecms/archive-page'"
              icon="lock-icon"
              class="apos-tree__row__icon apos-tree__row__icon--parked"
              tooltip="apostrophe:cannotMoveArchive"
            />
            <AposCheckbox
              v-if="options.bulkSelect && index === 0"
              v-model="checkedProxy"
              class="apos-tree__row__checkbox"
              :field="{
                name: row._id,
                hideLabel: true,
                label: $t({
                  key: 'apostrophe:toggleSelectionOf',
                  title: row.title
                }),
                readOnly: maxReached && !checked.includes(row._id)
              }"
              :choice="{ value: row._id }"
              @pointerdown="pointerEvent"
            />
            <span class="apos-tree__cell__value">
              <AposIndicator
                v-if="getEffectiveIcon(col, row)"
                :icon="getEffectiveIcon(col, row)"
                class="apos-tree__cell__icon"
                :icon-size="getEffectiveIconSize(col, row)"
              />
              <span
                v-if="getEffectiveCellLabel(col, row)"
                class="apos-tree__cell__label"
              >
                {{ getEffectiveCellLabel(col, row) }}
              </span>
            </span>
          </component>
        </div>
        <AposTreeRows
          :ref="(el) => treeBranches.push(el)"
          v-model:checked="checkedProxy"
          data-apos-branch-height
          :data-list-row="row._id"
          :rows="row._children"
          :headers="headers"
          :icons="icons"
          :col-widths="colWidths"
          :level="level + 1"
          :nested="nested"
          :list-id="row._id"
          :tree-id="treeId"
          :options="options"
          :class="{ 'apos-is-collapsed': !row.__expanded }"
          :style="{
            'max-height': !row.__expanded ? '0' : null
          }"
          :module-options="moduleOptions"
          :expanded-index="expandedIndex"
          @update="$emit('update', $event)"
          @toggle="$emit('toggle', $event)"
        />
      </li>
    </template>
  </draggable>
</template>

<script>
import { Sortable } from 'sortablejs-vue3';

export default {
  name: 'AposTreeRows',
  components: {
    draggable: Sortable
  },
  // Custom model to handle the v-model connection on the parent.
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
    },
    expandedIndex: {
      type: Object,
      default() {
        return {};
      }
    },
    moduleOptions: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [ 'update', 'update:checked', 'change', 'toggle' ],
  data() {
    return {
      treeBranches: [],
      countModifier: {}
    };
  },
  computed: {
    computedRows() {
      return this.rows.map(row => {
        return {
          ...row,
          __count: (this.countModifier[row._id] || 0) + (row._children?.length || 0),
          __expanded: this.isExpanded(row._id),
          __key: `${row._id}-${row.level}-${row.rank}`
        };
      });
    },
    // Handle the local check state within this component.
    checkedProxy: {
      get() {
        return this.checked;
      },
      set(val) {
        this.$emit('update:checked', val);
      }
    },
    dragOptions() {
      return {
        scroll: true,
        // px, how near the mouse must be to an edge to start scrolling.
        scrollSensitivity: 100,
        scrollSpeed: 1000, // px, speed of the scrolling
        // apply autoscroll to all parent elements, allowing for easier movement
        bubbleScroll: true,
        group: this.treeId,
        fallbackOnBody: true,
        swapThreshold: 0.65,
        dataListId: this.listId,
        disabled: !this.options.draggable,
        handle: '.apos-tree__row__icon--handle',
        ghostClass: 'apos-is-dragging',
        filter: '.apos-is-parked'
      };
    },
    maxReached() {
      return this.options.max != null && this.checked.length >= this.options.max;
    }
  },
  mounted() {
    apos.bus.$on('apos-tree-child:added', this.onChildAdd);
    apos.bus.$on('apos-tree-child:removed', this.onChildRemove);
    // Use $nextTick to make sure attributes like `clientHeight` are settled.
    this.$nextTick(() => {
      if (!this.$refs['tree-branches']) {
        return;
      }
      this.setHeights();
    });
  },
  beforeUnmount() {
    apos.bus.$off('apos-tree-child:added', this.onChildAdd);
    apos.bus.$off('apos-tree-child:removed', this.onChildRemove);
  },
  methods: {
    // Fix for chrome when some text is selected (needed double click to check
    // the box) Comes from sortablejs, so we avoid the event to propagate to
    // sortablejs listener
    pointerEvent(event) {
      event.stopPropagation();
    },
    setHeights() {
      this.treeBranches.forEach(branch => {
        // Add padding to the max-height to avoid needing a `resize`
        // event listener updating values.
        const height = branch.$el.clientHeight + 20;
        branch.$el.setAttribute('data-apos-branch-height', `${height}px`);
        branch.$el.style.maxHeight = `${height}px`;
      });
    },
    // Send a global signal to the tree that a child has been added or removed.
    add(event) {
      // The ID of the new parent, or 'root' if top-level.
      apos.bus.$emit('apos-tree-child:added', event.to.dataset.listRow);
    },
    remove(event) {
      // The ID of the original parent, or 'root' if top-level.
      apos.bus.$emit('apos-tree-child:removed', event.from.dataset.listRow);
    },
    // Listen for the global signal that a child has been added or removed.
    // Record children count corrections if we have a matching row.
    onChildAdd(event) {
      if (this.rows.some(row => row._id === event)) {
        this.countModifier[event] = (this.countModifier[event] || 0) + 1;
      }
    },
    onChildRemove(event) {
      if (this.rows.some(row => row._id === event)) {
        this.countModifier[event] = (this.countModifier[event] || 0) - 1;
      }
    },
    startDrag() {},
    endDrag(event) {
      this.$emit('update', event);
      this.$nextTick(() => {
        if (!this.treeBranches.length) {
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
      const rowId = row.dataset.rowId;

      if (toggle.getAttribute('aria-expanded') !== 'true') {
        rowList.style.maxHeight = rowList.getAttribute('data-apos-branch-height');
        toggle.setAttribute('aria-expanded', true);
        rowList.classList.remove('apos-is-collapsed');
        this.$emit('toggle', {
          _id: rowId,
          expanded: true
        });
      } else if (rowList) {
        rowList.style.maxHeight = 0;
        toggle.setAttribute('aria-expanded', false);
        rowList.classList.add('apos-is-collapsed');
        this.$emit('toggle', {
          _id: rowId,
          expanded: false
        });
      }
    },
    isExpanded(id) {
      return this.expandedIndex[id] ?? !this.options.startCollapsed;
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
          'apos-is-parked': !!row.parked,
          'apos-tree__row--parent': row._children && row._children.length > 0,
          'apos-tree__row--selectable': this.options.selectable,
          'apos-tree__row--selected': this.options.selectable && this.checked[0] === row._id
        }
      ];

      return classes;
    },
    getEffectiveType(col, row) {
      if (col.component) {
        return col.component;
      } else if (row.type === '@apostrophecms/archive-page') {
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
      const publishedDoc = row._publishedDoc;
      const value = (publishedDoc &&
        (publishedDoc[col.cellValue] !== undefined) &&
        publishedDoc[col.cellValue]) ||
        row[col.cellValue];
      if (value) {
        return value;
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
    &.apos-is-dragging {
      opacity: 0.5;
    }
  }

  .apos-tree__list {
    transition: max-height 300ms ease;

    &.apos-is-collapsed {
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
      left: math.div($row-nested-h-padding, 2);
      display: block;
      content: '';
      background-color: var(--a-base-8);
      width: 1px;
      transition: background-color 300ms ease;
    }

    &.apos-is-collapsed::before {
      background-color: transparent;
    }
  }

  .apos-tree__row__toggle {
    @include apos-button-reset();

    & {
      position: absolute;
      top: 50%;
      left: -(math.div($row-nested-h-padding, 2));
      background-color: var(--a-background-primary);
      transform: translate(-50%, -50%);
    }
  }

  .apos-tree__row__toggle-icon {
    display: block;
    transition: transform 300ms ease;
    transform: rotate(-90deg) translateY(0.25em);

    [aria-expanded="true"] > & {
      transform: none;
    }
  }

  .apos-tree__row__icon {
    margin-right: 0.25em;

    :deep(.material-design-icon__svg) {
      transition: fill 200ms ease;
      fill: var(--a-base-5);
    }
  }

  .apos-tree__row__icon--handle {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }

    .sortable-chosen &:deep(.material-design-icon__svg,)
    &:hover :deep(.material-design-icon__svg) {
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

  .apos-tree__cell.apos-is-published :deep(.apos-tree__cell__icon) {
    color: var(--a-success);
  }

  button.apos-tree__cell { /* stylelint-disable-line selector-no-qualifying-type */
    @include apos-button-reset();

    & {
      padding: $cell-padding;
      border-bottom: 1px solid var(--a-base-8);
    }
  }

</style>
