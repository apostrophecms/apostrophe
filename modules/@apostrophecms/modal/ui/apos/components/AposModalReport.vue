<template>
  <AposModal
    class="apos-report"
    :modal="modal"
    data-apos-test="reportModal"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #main>
      <AposModalBody data-apos-test="reportContent">
        <template #bodyMain>
          <div class="apos-report__body">
            <div>
              <h2
                v-if="contentHeadingText"
                class="apos-report__heading"
              >
                {{ contentHeadingText }}
              </h2>
              <p
                v-if="contentDescriptionText"
                class="apos-report__description"
              >
                {{ contentDescriptionText }}
              </p>
            </div>
            <div
              v-if="finalItems.length"
              class="
                apos-primary-scrollbar
                apos-report__table
                apos-report__table--bordered
              "
            >
              <AposTable
                ref="table"
                :items="finalItems"
                :headers="finalHeaders"
                :options="options"
                :width="tableWidth"
                @col-click="sortBy"
              />
            </div>
            <div class="apos-report__export">
              <span>{{ $t('apostrophe:downloadAs') }}</span>
              <AposButton
                type="quiet"
                label="JSON"
                data-apos-test="exportJson"
                @click="exportJson"
              />
              <AposButton
                type="quiet"
                label="CSV"
                data-apos-test="exportCsv"
                @click="exportCsv"
              />
            </div>
            <div class="apos-report__footer">
              <span
                v-if="contentFooterMessageInfo"
                class="apos-report--footer-info"
                data-apos-test="footerError"
              >{{ contentFooterMessageInfo }}</span>
              <span
                v-if="contentFooterMessageDanger"
                class="apos-report--footer-danger"
                data-apos-test="footerError"
              >{{ contentFooterMessageDanger }}</span>
              <AposButton
                type="primary"
                label="apostrophe:close"
                @click="closeModal"
              />
            </div>
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
  name: 'AposModalReport',
  props: {
    /**
     * Array of headers to display in the table.
     * Additional `sortable` property is required to enable sorting. It's
     * internally converted to an `action` property with a value of 'sort' -
     * the format that the `AposTable` component expects.
     *
     * @see AposTable.vue
     * @type {TableHeader[]}
     */
    headers: {
      required: true,
      type: Array
    },
    /**
     * Array of items to display in the table.
     * Additional `type` property is required to filter the items.
     * It can be one of 'error', 'warning', 'info', 'success'.
     * If `options.mode` is set to 'all', all items will be displayed.
     *
     * @see AposTable.vue
     * @type {TableItem[]}
     */
    items: {
      required: true,
      type: Array
    },
    /**
     * Content object for the modal. Localization is supported.
     *
     * @type {{
     *  heading: string,
     *  description: string,
     *  footerMessageInfo: string,
     *  footerMessageDanger: string
     * }}
     */
    content: {
      type: Object,
      required: true
    },
    /**
     * Options for the modal.
     *
     * `mode` can be one of 'error', 'warning', 'info', 'success', 'all'. The
     * default is 'error'. It's used to filter the items by their `type`
     * property.
     *
     * `localize` is a boolean that determines if the content should be
     * localized. This excludes the headers, which are always localized.
     *
     * `interpolate` is an object that will be used to interpolate when
     * localizing. Additional interpolation properties are auto included -
     * `count` (the number of filtered by type items in the table) and `total`
     * (the total number of items).
     *
     * @type {{
     *  mode?: 'error' | 'warning' | 'info' | 'success' | 'all',
     *  localize?: boolean,
     *  interpolate?: Object
     * }}
     */
    options: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [ 'confirm-response', 'modal-result' ],
  data() {
    return {
      modal: {
        type: 'overlay',
        disableHeader: true,
        active: false,
        showModal: false
      },
      // fixed table width so that the table can perform ellipsis on long text
      // and avoid horizontal scrolling
      tableWidth: '750px',
      currentSort: {
        column: null,
        direction: 'asc'
      },
      sortedItems: []
    };
  },
  computed: {
    tableMode() {
      return this.options.mode ?? 'error';
    },
    finalHeaders() {
      return this.headers.map(header => {
        return {
          ...header,
          action: header.sortable ? 'sort' : false,
          icon: this.currentSort.column === header.name
            ? this.currentSort.direction === 'asc'
              ? 'arrow-up-icon'
              : 'arrow-down-icon'
            : header.icon
        };
      });
    },
    finalItems() {
      if (this.tableMode === 'all') {
        return this.sortedItems;
      }
      return this.sortedItems.filter(
        (item) => item.type === this.tableMode
      );
    },
    finalItemsCount() {
      return this.finalItems.length;
    },
    exportHeaders() {
      return this.headers.filter(header => {
        return [ 'always', 'export' ].includes(header.visibility ?? 'always');
      });
    },
    contentHeadingText() {
      return this.localize(this.content.heading, {
        count: this.finalItemsCount,
        total: this.items.length
      });
    },
    contentDescriptionText() {
      return this.localize(this.content.description, {
        count: this.finalItemsCount,
        total: this.items.length
      });
    },
    contentFooterMessageInfo() {
      return this.localize(this.content.footerMessageInfo, {
        count: this.finalItemsCount,
        total: this.items.length
      });
    },
    contentFooterMessageDanger() {
      return this.localize(this.content.footerMessageDanger, {
        count: this.finalItemsCount,
        total: this.items.length
      });
    }
  },
  async mounted() {
    this.modal.active = true;
    this.sortedItems = [ ...this.items ];
  },
  methods: {
    sortBy({ header }) {
      if (header.action !== 'sort') {
        return;
      }
      if (this.currentSort.column === header.name) {
        this.currentSort.direction = this.currentSort.direction === 'asc'
          ? 'desc'
          : 'asc';
      } else {
        this.currentSort.column = header.name;
        this.currentSort.direction = 'asc';
      }
      const items = [ ...this.sortedItems ];
      items.sort((a, b) => {
        const valueA = this.$refs.table.getValue(a, header, false);
        const valueB = this.$refs.table.getValue(b, header, false);
        if (valueA === valueB) {
          return 0;
        }
        if (this.currentSort.direction === 'asc') {
          return valueA > valueB ? 1 : -1;
        }
        return valueA < valueB ? 1 : -1;
      });
      this.sortedItems = items;
    },
    localize(s, interpolate = {}) {
      if (!s) {
        return '';
      }
      return this.options.localize === false
        ? s
        : this.$t(s, {
          ...this.options.interpolate || {},
          ...interpolate
        });
    },
    closeModal() {
      this.modal.showModal = false;
      this.$emit('modal-result', true);
    },
    exportJson() {
      const blob = new Blob(
        [ this.toJson() ],
        { type: 'application/json;charset=utf-8;' }
      );
      const url = URL.createObjectURL(blob);
      this.download(url, 'report.json');
    },
    exportCsv() {
      const blob = new Blob([ this.toCSV() ], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      this.download(url, 'report.csv');
    },
    download(url, filename) {
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    toCSV() {
      if (this.finalItems.length === 0) {
        return '';
      }
      const headers = this.exportHeaders.map(
        header => JSON.stringify(this.$t(header.label))
      );

      const rows = this.finalItems.map(obj =>
        this.exportHeaders.map(
          header => JSON.stringify(this.$refs.table.getValue(obj, header, false))
        )
          .join(',')
      );
      return [ headers.join(','), ...rows ].join('\n');
    },
    toJson() {
      if (this.finalItems.length === 0) {
        return '[]';
      }
      const result = [];
      for (const obj of this.finalItems) {
        const row = {};
        for (const header of this.exportHeaders) {
          row[this.$t(header.label)] = this.$refs.table.getValue(obj, header, false);
        }
        result.push(row);
      }
      return JSON.stringify(result, null, 2);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-report {
  z-index: $z-index-modal;
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

    :deep(.apos-modal__body) {
    padding: 20px;
  }

  :deep(.apos-modal__inner) {
    inset: auto;
    max-width: 800px;
    height: calc(100vh / 2);

    /* stylelint-disable-next-line media-feature-name-allowed-list */
    @media screen and (height <= 720px) {
      height: 80vh;
    }
  }
}

.apos-report__body {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: calc((100vh / 2) - 2 * #{$spacing-double});
  gap: $spacing-half + $spacing-base;

  /* stylelint-disable-next-line media-feature-name-allowed-list */
  @media screen and (height <= 720px) {
    height: calc(80vh - 2 * #{$spacing-double});
  }
}

.apos-report__heading {
  @include type-title;

  & {
    line-height: var(--a-line-tall);
    margin: $spacing-base 0 0;
  }
}

.apos-report__description {
  @include type-base;

  & {
    line-height: var(--a-line-tallest);
    margin: $spacing-base 0 0;
  }
}

.apos-report__table {
  overflow-y: auto;
}

.apos-report__table--bordered {
  border: 1px solid var(--a-base-8);
  border-radius: var(--a-border-radius);
}

.apos-report__export {
  @include type-base;

  & {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: right;
    gap: $spacing-base;
  }
}

.apos-report__footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: right;
  gap: 1rem;
}

.apos-report--footer-danger {
  @include type-label;

  & {
    color: var(--a-danger);
  }
}
</style>
