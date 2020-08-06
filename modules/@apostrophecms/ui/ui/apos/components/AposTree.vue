<template>
  <div class="apos-tree" :class="{ 'apos-tree--nested': nested }">
    <AposTreeHeader
      :headers="spacingRow" :spacer-only="true"
      @calculated="setWidths"
    />
    <AposTreeHeader :headers="data.headers" :col-widths="colWidths" />
    <AposTreeRows
      v-model="checkedProxy"
      :rows="data.rows"
      :headers="data.headers"
      :col-widths="colWidths"
      :level="1"
      :nested="nested"
      @busy="setBusy"
      @update="update"
      list-id="root"
      :draggable="draggable"
      :selectable="selectable"
      :tree-id="treeId"
    />
  </div>
</template>

<script>
import AposHelpers from 'Modules/@apostrophecms/ui/mixins/AposHelpersMixin';

export default {
  name: 'AposTree',
  mixins: [AposHelpers],
  model: {
    prop: 'checked',
    event: 'change'
  },
  props: {
    data: {
      type: Object,
      required: true
    },
    checked: {
      type: Array,
      default() {
        // If this is not provided, we don't need to initiate an array.
        return null;
      }
    },
    draggable: {
      type: Boolean,
      default: false
    },
    selectable: {
      type: Boolean,
      default: false
    }
  },
  emits: ['busy', 'update', 'change'],
  data() {
    return {
      // Copy the `data` property to mutate with VueDraggable.
      nested: false,
      colWidths: null,
      treeId: this.generateId()
    };
  },
  computed: {
    // Handle the local check state within this component.
    checkedProxy: {
      get() {
        return this.checked;
      },
      set(val) {
        this.$emit('change', val);
      }
    },
    spacingRow() {
      let spacingRow = {};
      // Combine the header with the rows, the limit to a reasonable 50 rows.
      const headers = {};
      if (this.data.headers) {
        this.data.headers.forEach(header => {
          headers[header.name] = header.label;
        });
      }

      let completeRows = [headers];
      // Add child rows into `completeRows`.
      this.data.rows.forEach(row => {
        completeRows.push(row);

        if (row.children && row.children.length > 0) {
          this.nested = true;
          completeRows = completeRows.concat(row.children);
        }
      });
      completeRows = completeRows.slice(0, 50);

      // Loop over the combined header/rows array, finding the largest value
      // for each key.
      completeRows.forEach(row => {
        if (spacingRow.length === 0) {
          spacingRow = Object.assign({}, row);
          return;
        }

        this.data.headers.forEach(col => {
          const key = col.name;
          if (
            !spacingRow[key] ||
            (spacingRow[key] &&
            spacingRow[key].toString().length < row[key].toString().length)
          ) {
            spacingRow[key] = row[key];
          }
        });
      });
      // Place that largest value on that key of the spacingRow object.
      // Put that array in the DOM, and generate styles to be passed down based on its layout. Give the first column any leftover space.
      const finalRow = [];
      this.data.headers.forEach(col => {
        let obj;
        const foundIndex = this.data.headers.findIndex(o => {
          return o.name === col.name;
        });
        const spacerInfo = {
          name: col.name,
          label: spacingRow[col.name]
        };

        if (foundIndex > -1) {
          // Deep copy the original header column to capture all options.
          const foundObj = JSON.parse(JSON.stringify(this.data.headers[foundIndex]));

          if (foundObj.iconOnly) {
            // If the "column" will only show icons, let the "column header"
            // set the width.
            delete spacerInfo.label;
          }

          obj = Object.assign(foundObj, spacerInfo);
        } else {
          obj = spacerInfo;
        }

        finalRow.push(obj);
      });
      return finalRow;
    }
  },
  methods: {
    setWidths(widths) {
      this.colWidths = widths;
    },
    setBusy(val) {
      this.$emit('busy', val);
    },
    update(event) {
      this.$emit('update', {
        // The ID of the item that moved.
        changedId: event.item.dataset.rowId,
        // The ID of the original parent, or 'root' if top-level.
        startContext: event.from.dataset.listId,
        // The index of the moved item within its original context.
        startIndex: event.oldIndex,
        // The ID of the new parent, or 'root' if top-level.
        endContext: event.to.dataset.listId,
        // The index of the moved item within its new context.
        endIndex: event.newIndex
      });
      this.setBusy(false);
    }
  }
};
</script>

<style lang="scss">
  $row-nested-h-padding: 24px;
  $cell-padding: 16px;

  .apos-tree {
    color: var(--a-text-primary);
    font-size: map-get($font-sizes, default);
  }

  .apos-tree__list {
    width: 100%;
    margin-top: 0;
    margin-bottom: 0;
    padding-left: 0;
    list-style-type: none;
  }

  .apos-tree__row-data {
    position: relative;
    display: flex;
    width: 100%;

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

  .apos-tree__cell {
    display: inline-flex;
    flex-shrink: 2;
    padding: $cell-padding;
    border-bottom: 1px solid var(--a-base-8);
    box-sizing: border-box;

    // Let the first cell column (usually "title") grow. We're assuming the first
    // cell is not a link since there are dedicated "edit" and "link" columns.
    &:first-of-type:not(a) {
      flex-grow: 1;
      flex-shrink: 1;
    }
  }

  .apos-tree__cell--published {
    .material-design-icon__svg {
      fill: var(--a-success);
    }

    &.apos-tree__cell--disabled {
      color: var(--a-base-2);

      .material-design-icon__svg {
        fill: var(--a-base-2);
      }
    }
  }

  .apos-tree__cell__icon {
    display: inline-flex;
    align-items: flex-start;
    margin-right: 10px;
    padding-top: 0.2em;

    .material-design-icon__svg {
      width: 12px;
      height: 12px;
    }

    .apos-tree__cell--icon & .material-design-icon__svg {
      width: 18px;
      height: 18px;
    }

    .apos-tree__cell--icon & {
      padding-top: 0;
    }
  }

  .apos-tree__row {
    .apos-tree--nested & {
      padding-left: $row-nested-h-padding;
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
  }
</style>
