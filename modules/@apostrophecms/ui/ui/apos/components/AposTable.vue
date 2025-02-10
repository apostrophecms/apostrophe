<template>
  <table
    class="apos-table"
    data-apos-test="table"
    :style="{
      '--table-width': tableWidth,
      '--table-layout': cssTableLayout
    }"
  >
    <tbody>
      <tr>
        <th
          v-for="header in tableHeaders"
          :key="header.id"
          scope="col"
          class="apos-table__header"
          :class="`apos-table__header--${header.css}`"
          data-apos-test="tableHeader"
          :style="headerStyles(header)"
        >
          <slot :name="`header-${header.name}`" :header="header">
            <component
              :is="header.component"
              class="apos-table__header-label"
              :class="{ 'apos-table__header--pointer': header.action }"
              @click="onColClick(header)"
            >
              <component
                :is="header.icon"
                v-if="header.icon"
                :size="header.iconSize || 15"
                class="apos-table__header-icon"
                fill-color="currentColor"
              />
              {{ $t(header.label) }}
            </component>
          </slot>
        </th>
      </tr>
      <tr
        v-for="item in items"
        :key="item._id"
        class="apos-table__row"
        data-apos-test="tableRow"
      >
        <td
          v-for="header in tableHeaders"
          :key="header.id"
          class="apos-table__cell"
          :class="`apos-table__cell--${header.css}`"
          data-apos-test="tableCell"
          @click="onCellClick(item, header)"
        >
          <slot
            :name="`cell-${header.name}`"
            :item="item"
            :header="header"
            :classes="header.cellClasses"
            :valueFormatted="getValue(item, header)"
            :value="getValue(item, header, false)"
          >
            <p
              :class="header.cellClasses"
              :title="getValue(item, header, false)"
              data-apos-test="tableCellField"
            >
              {{ getValue(item, header) }}
            </p>
          </slot>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script>
/**
 * A low level table component that can be used to display a list of items.
 *
 * @typedef {{
 *  id?: string,
 *  name: string,
 *  label?: string,
 *  icon?: string,
 *  iconSize?: number,
 *  css?: string,
 *  width?: string | number,
 *  action?: boolean | string,
 *  format?: string | (value: any) => string | number | boolean,
 *  visibility?: 'always' | 'never' | 'table' | 'export'
 * }} TableHeader
 *
 * @typedef {Required<TableHeader> & { component: string; cellClasses: string[] }} FinalTableHeader
 *
 * @typedef {{
 *  _id: string;
 *  [key: string]: any;
 * }} TableItem
 */

export default {
  props: {
    /**
     * Array of headers to display in the table.
     * The `name` property is used to determine the value to display
     * for each cell in the table.
     * `css` is the class suffix to apply to the cell. If missing, `name` is used.
     * `id` is optional unique identifier for the header. If missing, `name` is used.
     * It's only used for internal purposes (loop keys).
     * `icon` is the optional icon component name to display in the header.
     * `iconSize` is the optional size of the icon to display in the header.
     * If `action` is truthy, the header will be rendered as a button by default.
     * `format` is the optional format to apply to the value before displaying it.
     * It can be a predefined format or a function. Predefined formats are:
     * - `last:n` to display the last n characters of the string.
     * - `yesno` to display "Yes" or "No" based on the value.
     *
     * @type {TableHeader[]}
     */
    headers: {
      type: Array,
      required: true
    },
    /**
     * Array of items to display in the table. It's a dynamic key object
     * with required `_id` property.
     *
     * @type {TableItem[]}
     */
    items: {
      type: Array,
      required: true
    },
    /**
     * Options object to customize the table.
     *
     * @type {{ maxCellWidth?: string }}
     */
    options: {
      type: Object,
      default() {
        return {};
      }
    },
    width: {
      type: [ Number, String ],
      default: null
    }
  },
  emits: [
    'cell-click',
    'col-click'
  ],
  computed: {
    /**
     * @returns {FinalTableHeader[]}
     */
    finalHeaders() {
      return this.headers.map(header => {
        return {
          ...header,
          id: header.id ?? header.name,
          label: header.label ?? '',
          action: header.action ?? false,
          width: header.width ?? 0,
          component: header.action ? 'button' : 'span',
          icon: header.icon ?? '',
          iconSize: header.iconSize ?? 10,
          css: header.css ?? header.name,
          format: this.getFormatFactory(header),
          cellClasses: this.cellCss(header)
        };
      });
    },
    tableHeaders() {
      return this.finalHeaders.filter(header => {
        return [ 'always', 'table' ].includes(header.visibility ?? 'always');
      });
    },
    tableWidth() {
      return (this.width || '100%');
    },
    isTableFixed() {
      return this.isFixedValue(this.tableWidth);
    },
    // Calculate the max width of the cells that don't have a fixed width.
    maxCellWidth() {
      if (this.options.maxCellWidth) {
        return this.options.maxCellWidth;
      }
      const shouldSkip = !this.isTableFixed || this.headers.some(header => {
        return header.width && !this.isFixedValue(header.width);
      });
      if (shouldSkip) {
        return 'auto';
      }

      let tableWidth = parseInt(this.tableWidth, 10);
      let cols = this.headers.length;
      for (const header of this.tableHeaders) {
        if (header.width) {
          tableWidth -= parseInt(header.width, 10);
          cols -= 1;
        }
      }
      if (tableWidth > 0) {
        // Subtract 30px for the padding per cell.
        const colWidth = Math.floor(tableWidth / cols) - 30;
        return colWidth > 0
          ? `${colWidth}px`
          : 'auto';
      }

      return 'auto';
    },
    cssTableLayout() {
      return this.isTableFixed ? 'fixed' : 'auto';
    }
  },
  methods: {
    /**
     * @param {TableItem} item
     * @param {FinalTableHeader} header
     */
    getValue(item, header, format = true) {
      const components = header.name?.split('.') ?? null;
      if (!components) {
        return null;
      }
      let value = item;
      try {
        for (const component of components) {
          value = value[component];
        }
      } catch (e) {
        return null;
      }
      if (format) {
        return header.format(value);
      }
      return value;
    },
    /**
     * @param {TableHeader} header
     * @returns {(value: any) => string | number | boolean}
     */
    getFormatFactory(header) {
      if (!header.format) {
        return (value) => value;
      }
      if (typeof header.format === 'function') {
        return header.format;
      }
      const [ type, ...args ] = header.format.split(':');
      switch (type) {
        case 'last':
          return (value) => {
            return '...' + `${value}`.substring(`${value}`.length - args[0]);
          };
        case 'yesno':
          return (value) => {
            return value ? this.$t('apostrophe:yes') : this.$t('apostrophe:no');
          };
        default:
          return (value) => value;
      }
    },
    /**
     * @param {TableHeader} header
     * @returns {{ maxWidth: string }}
     */
    headerStyles(header) {
      if (this.isFixedValue(header.width)) {
        return {
          width: (parseInt(header.width, 10) + 0) + 'px'
        };
      }
      if (header.width) {
        return {
          width: header.width
        };
      }

      return {
        width: this.maxCellWidth
      };
    },
    cellCss(header) {
      const classes = [
        'apos-table__cell-field',
        `apos-table__cell-field--${header.css}`
      ];
      if (this.isTableFixed) {
        classes.push('apos-table__cell-field-fixed');
      }
      return classes;
    },
    isFixedValue(value) {
      return value &&
        (`${value}`.includes('px') || typeof value === 'number');
    },
    /**
     * @param {FinalTableHeader} header
     */
    onColClick(header) {
      if (!header.action) {
        return;
      }
      this.$emit('col-click', {
        header
      });
    },
    /**
     * @param {TableItem} item
     * @param {FinalTableHeader} header
     */
    onCellClick(item, header) {
      this.$emit('cell-click', {
        item,
        header
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-table {
  box-sizing: border-box;
  table-layout: var(--table-layout);
  width: var(--table-width);
}

.apos-table__header {
  border-bottom: 1px solid var(--a-base-10);
}

.apos-table__cell {
  // WARNING: This comes from a global style that affects all tables.
  // We need x-padding here to stay forever 15px because it's part
  // of the cell width calculation.
  padding: 5px 15px;
  white-space: unset;
}

// It would work only when `width` property is provided
// and it's a pixel value.
.apos-table__cell-field-fixed {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.apos-table__header--pointer {
  cursor: pointer;
}

.apos-table__header-label {
  width: 100%;
}

// Unset the default global styles for the table title cell.
.apos-table__cell--title {
  white-space: unset;
  max-width: auto;
  overflow: none;
  text-overflow: unset;
}
</style>
