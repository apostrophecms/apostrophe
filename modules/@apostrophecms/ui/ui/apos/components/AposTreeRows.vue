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
          :key="`${col.name}-${index}`"
          :is="getEffectiveType(col, row)"
          :href="(getEffectiveType(col, row) === 'a') ? row[col.name] : false"
          :target="col.type === 'link' ? '_blank' : false"
          :class="getCellClasses(col, row)"
          :disabled="getCellDisabled(col, row)"
          :data-col="col.name"
          :style="getCellStyles(col.name, index)"
          @click="((getEffectiveType(col, row) !== 'span') && col.action) ? $emit(col.action, row._id) : null"
        >
          <AposIndicator
            v-if="options.draggable && index === 0 && !row.parked"
            icon="drag-icon"
            class="apos-tree__row__icon apos-tree__row__icon--handle"
          />
          <AposIndicator
            v-if="index === 0 && row.parked && row.type !== '@apostrophecms/trash'"
            icon="lock-icon"
            class="apos-tree__row__icon apos-tree__row__icon--parked"
            tooltip="This page is parked and cannot be moved"
          />
          <AposIndicator
            v-if="index === 0 && row.type === '@apostrophecms/trash'"
            icon="lock-icon"
            class="apos-tree__row__icon apos-tree__row__icon--parked"
            tooltip="You cannot move the Trash"
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
          <AposIndicator
            v-if="getEffectiveIcon(col, row)"
            :icon="getEffectiveIcon(col, row)"
            class="apos-tree__cell__icon"
            :icon-size="15"
          />
          <span
            class="apos-tree__cell__label"
            v-show="!col.iconOnly"
          >
            {{ getEffectiveValue(col, row) }}
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
  emits: [ 'update', 'change', 'edit' ],
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
    console.log(this.myRows);
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
      return [
        'apos-tree__row',
        {
          'is-parked': !!row.parked,
          'is-unpublished': !row.lastPublishedAt,
          'apos-tree__row--parent': row.children && row.children.length > 0,
          'apos-tree__row--selectable': this.options.selectable,
          'apos-tree__row--selected': this.options.selectable && this.checked[0] === row._id
        }
      ];
    },
    getEffectiveType(col, row) {
      if (row.type === '@apostrophecms/trash') {
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
      if (row.type === '@apostrophecms/trash') {
        return false;
      } else {
        return this.icons[col.icon];
      }
    },
    getEffectiveValue(col, row) {
      const excludedTypes = [ '@apostrophecms/trash' ];
      // Opportunity to display a custom true/false label for cell value
      if (col.value) {
        if (excludedTypes.includes(row.type)) {
          return;
        }
        if (row[col.name]) {
          return col.value.true;
        } else {
          return col.value.false;
        }
      // Original default of just printing the row property value
      } else {
        return row[col.name];
      }
    },
    getCellClasses(col, row) {
      const classes = [ 'apos-tree__cell' ];
      classes.push(`apos-tree__cell--${col.name}`);

      if (col.iconOnly) {
        classes.push('apos-tree__cell--icon');
      }
      return classes;
    },
    getCellDisabled(col, row) {
      if (this.getEffectiveType(col, row) === 'span') {
        return false;
      }
      if ((col.type === 'link') && (!row[col.name])) {
        return true;
      } else if (row.trash && (col.type === 'button')) {
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
    &.is-unpublished > .apos-tree__row-data{
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

  .apos-tree__cell__label {
    display: flex;
    align-self: center;
  }

  button.apos-tree__cell {
    @include apos-button-reset();
    padding: $cell-padding;
    border-bottom: 1px solid var(--a-base-8);
  }

</style>
