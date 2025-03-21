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
      <tr data-apos-test="tableHeader">
        <th
          v-for="header in tableHeaders"
          :key="header.id"
          scope="col"
          class="apos-table__header"
          :class="`apos-table__header--${header.css}`"
          data-apos-test="tableHeaderCell"
          :style="headerStyles(header)"
        >
          <slot
            :name="`header-${header.name}`"
            :header="header"
          >
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
                :data-apos-test-icon="header.icon"
                class="apos-table__header-icon"
                fill-color="currentColor"
              />
              {{ $t(header.label) }}
            </component>
          </slot>
        </th>
      </tr>
      <tr
        v-for="(item, index) in items"
        :key="item._id"
        class="apos-table__row"
        data-apos-test="tableRow"
        :data-apos-test-row-count="index + 1"
      >
        <td
          v-for="header in tableHeaders"
          :key="header.id"
          class="apos-table__cell"
          :class="`apos-table__cell--${header.css}`"
          data-apos-test="tableCell"
          :data-apos-test-cell-name="header.name"
          :data-apos-test-cell-label="$t(header.label)"
          :data-apos-test-cell-row-count="index + 1"
          @click="onCellClick(item, header)"
        >
          <slot
            :name="`cell-${header.name}`"
            :item="item"
            :header="header"
            :classes="header.cellClasses"
            :value-formatted="getValue(item, header)"
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
 *  translate?: boolean,
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
     * `translate` is optional and if true, the relevant items values will be translated.
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
    maxCellWidth() {
      if (this.options.maxCellWidth) {
        return this.options.maxCellWidth;
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
      if (header.translate === true) {
        value = this.$t(value);
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
  max-width: var(--table-width);
}

.apos-table__header {
  border-bottom: 1px solid var(--a-base-8);
  background-color: var(--a-base-10);
}

.apos-table__cell {
  padding: 10px 15px;
  white-space: unset;
}

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

.apos-table__header:focus-within {
  box-shadow: inset 0 0 0 1px var(--a-base-5);
}

.apos-table__header-label:focus {
  outline: none;
}

// Unset the default global styles for the table title cell.
.apos-table__cell--title {
  white-space: unset;
  max-width: auto;
  overflow: none;
  text-overflow: unset;
}
</style>
