<template>
  <div
    class="apos-tree"
    :class="{ 'apos-tree--nested': nested }"
  >
    <AposTreeHeader
      :headers="spacingRow"
      :icons="icons"
      :spacer-only="true"
      @calculated="setWidths"
    />
    <AposTreeHeader
      :headers="headers"
      :icons="icons"
      :col-widths="colWidths"
      :hidden="options.hideHeader"
    />
    <AposTreeRows
      v-model:checked="checkedProxy"
      list-id="root"
      :rows="myItems"
      :headers="headers"
      :icons="icons"
      :col-widths="colWidths"
      :level="1"
      :nested="nested"
      :options="options"
      :tree-id="treeId"
      :module-options="moduleOptions"
      :expanded-index="expandedIndex"
      @update="update"
      @toggle="onToggleSection"
    />
  </div>
</template>

<script>
import { klona } from 'klona';
import { createId } from '@paralleldrive/cuid2';

export default {
  name: 'AposTree',
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
    items: {
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
    // Active options include:
    // - hideHeader: The tree header row will be visibly hidden.
    // - selectable: Rows can be individually selected one-at-a-time. Used
    //   for version history selection.
    // - bulkSelect: Rows can be bulk selected using checkboxes. Both this
    //   and `selectable` use the same `checked` array.
    // - draggable: Rows can be moved around within the tree.
    options: {
      type: Object,
      default () {
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
  emits: [ 'update', 'update:checked' ],
  data() {
    return {
      // Copy the `items` property to mutate with VueDraggable.
      myItems: klona(this.items),
      nested: false,
      colWidths: null,
      treeId: createId(),
      expandedIndex: {}
    };
  },
  computed: {
    // Handle the local check state within this component.
    checkedProxy: {
      get() {
        return this.checked;
      },
      set(val) {
        this.$emit('update:checked', val);
      }
    },
    spacingRow() {
      let spacingRow = {};
      // Combine the header with the items, the limit to a reasonable 50 items.
      const headers = {};
      if (this.headers) {
        this.headers.forEach(header => {
          headers[header.property] = header.label;
        });
      }

      let completeRows = [ headers ];
      // Add child items into `completeRows`.
      this.items.forEach(row => {
        completeRows.push(row);

        if (row._children && row._children.length > 0) {
          this.nested = true;
          completeRows = completeRows.concat(row._children);
        }
      });
      completeRows = completeRows.slice(0, 50);

      // Loop over the combined header/items array, finding the largest value
      // for each key.
      completeRows.forEach(row => {
        if (spacingRow.length === 0) {
          spacingRow = Object.assign({}, row);
          return;
        }

        this.headers.forEach(col => {
          const key = col.property;
          if (
            (!spacingRow[key]) ||
            (spacingRow[key] &&
            spacingRow[key].toString().length < (row[key] || '').toString().length)
          ) {
            spacingRow[key] = row[key];
          }
        });
      });
      // Place that largest value on that key of the spacingRow object.
      // Put that array in the DOM, and generate styles to be passed down based
      // on its layout. Give the first column any leftover space.
      const finalRow = [];
      this.headers.forEach(col => {
        let obj;
        const foundIndex = this.headers.findIndex(o => {
          return o.property === col.property;
        });
        const spacerInfo = {
          name: col.property,
          label: spacingRow[col.property]
        };

        if (foundIndex > -1) {
          // Deep copy the original header column to capture all options.
          const foundObj = JSON.parse(JSON.stringify(this.headers[foundIndex]));

          if (foundObj.icon) {
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
  watch: {
    items(array) {
      this.myItems = array;
    }
  },
  methods: {
    setWidths(widths) {
      this.colWidths = widths;
    },
    update(event) {
      this.$emit('update', {
        // The ID of the item that moved.
        changedId: event.item.dataset.rowId,
        // The ID of the original parent, or 'root' if top-level.
        startContext: event.from.dataset.listRow,
        // The index of the moved item within its original context.
        startIndex: event.oldIndex,
        // The ID of the new parent, or 'root' if top-level.
        endContext: event.to.dataset.listRow,
        // The index of the moved item within its new context.
        endIndex: event.newIndex
      });
    },
    onToggleSection({ _id, expanded }) {
      this.expandedIndex[_id] = expanded;
    }
  }
};
</script>

<style lang="scss" scoped>
  @import '../scss/shared/_table-vars';

  .apos-tree {
    @include type-base;

    & {
      color: var(--a-text-primary);
    }
  }

</style>
