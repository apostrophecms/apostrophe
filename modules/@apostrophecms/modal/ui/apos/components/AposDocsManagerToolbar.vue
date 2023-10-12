<template>
  <AposModalToolbar class-name="apos-manager-toolbar">
    <template #leftControls>
      <AposButton
        v-if="canSelectAll"
        label="apostrophe:select"
        type="outline"
        :modifiers="['small']"
        text-color="var(--a-base-1)"
        :icon-only="true"
        :icon="checkboxIcon"
        @click="selectAll"
        ref="selectAll"
        data-apos-test="selectAll"
      />
      <div
        v-for="{
          action,
          label,
          icon,
          operations,
          ...rest
        } in activeOperations"
        :key="action"
      >
        <AposButton
          v-if="!operations"
          :label="label"
          :action="action"
          :icon="icon"
          :disabled="!checkedCount"
          :modifiers="['small']"
          type="outline"
          @click="confirmOperation({ action, label, ...rest })"
        />
        <AposContextMenu
          v-else
          :button="{
            label,
            icon,
            iconOnly: true,
            type: 'outline'
          }"
          :disabled="!checkedCount"
          :menu="operations"
          @item-clicked="(a) => beginGroupedOperation(a, operations)"
        />
      </div>
    </template>
    <template #rightControls>
      <AposPager
        v-if="!options.noPager && totalPages !== 0"
        @click="registerPageChange" @change="registerPageChange"
        :total-pages="totalPages" :current-page="currentPage"
      />
      <AposFilterMenu
        v-if="filters.length"
        :filters="filters"
        :choices="filterChoices"
        :values="filterValues"
        @input="filter"
      />
      <AposInputString
        v-if="hasSearch"
        @input="search" @return="search($event, true)"
        :field="searchField.field"
        :status="searchField.status" :value="searchField.value"
        :modifiers="['small']"
        ref="search"
      />
    </template>
  </AposModalToolbar>
</template>

<script>

export default {
  props: {
    selectedState: {
      type: String,
      required: true
    },
    applyTags: {
      type: Array,
      default: () => []
    },
    filterChoices: {
      type: Object,
      default: () => ({})
    },
    filterValues: {
      type: Object,
      default: () => ({})
    },
    filters: {
      type: Array,
      default: () => []
    },
    totalPages: {
      type: Number,
      default: 1
    },
    currentPage: {
      type: Number,
      default: 1
    },
    isRelationship: {
      type: Boolean,
      default: false
    },
    labels: {
      type: Object,
      default: () => ({})
    },
    options: {
      type: Object,
      default: () => ({})
    },
    batchOperations: {
      type: Array,
      default: () => []
    },
    displayedItems: {
      type: Number,
      required: true
    },
    checked: {
      type: Array,
      default: () => []
    },
    checkedCount: {
      type: Number,
      required: true
    },
    moduleName: {
      type: String,
      required: true
    }
  },
  emits: [
    'select-click',
    'filter',
    'search',
    'page-change',
    'batch'
  ],
  data() {
    return {
      searchField: {
        field: {
          name: 'search',
          placeholder: {
            key: 'apostrophe:searchDocType',
            type: this.$t(this.labels.plural)
          },
          icon: 'magnify-icon',
          enterSubmittable: true
        },
        status: {},
        value: { data: '' }
      },
      activeOperations: []
    };
  },
  computed: {
    checkboxIcon() {
      if (this.selectedState === 'checked') {
        return 'checkbox-marked-icon';
      } else if (this.selectedState === 'indeterminate') {
        return 'minus-box-icon';
      } else {
        return 'checkbox-blank-icon';
      }
    },
    canSelectAll() {
      return this.displayedItems;
    },
    canArchive() {
      return this.checkedCount;
    },
    hasSearch() {
      return !this.options.noSearch;
    }
  },
  mounted () {
    this.computeActiveOperations();
    apos.bus.$on('command-menu-manager-select-all', this.selectAll);
    apos.bus.$on('command-menu-manager-archive-selected', this.archiveSelected);
    apos.bus.$on('command-menu-manager-focus-search', this.focusSearch);
  },
  destroyed () {
    apos.bus.$off('command-menu-manager-select-all', this.selectAll);
    apos.bus.$off('command-menu-manager-archive-selected', this.archiveSelected);
    apos.bus.$off('command-menu-manager-focus-search', this.focusSearch);
  },
  methods: {
    selectAll() {
      if (this.canSelectAll) {
        this.$emit('select-click');
      }
    },
    archiveSelected() {
      const [ archiveOperation ] = this.activeOperations.filter(operation => operation.action === 'archive');
      if (archiveOperation && this.canArchive) {
        this.confirmOperation(archiveOperation);
      }
    },
    focusSearch() {
      if (this.hasSearch) {
        this.$refs.search.$el.querySelector('input').focus();
      }
    },
    computeActiveOperations () {
      if (this.isRelationship) {
        this.activeOperations = [];
        return;
      }

      this.activeOperations = this.batchOperations
        .map(({ operations, ...rest }) => {
          if (!operations) {
            return {
              ...rest,
              operations
            };
          }

          return {
            operations: operations.filter((op) => this.isOperationActive(op)),
            ...rest
          };
        }).filter((operation) => {
          if (operation.operations && !operation.operations.length) {
            return false;
          }

          return this.isOperationActive(operation);
        });
    },
    isOperationActive (operation) {
      return Object.entries(operation.if || {})
        .every(([ filter, val ]) => {
          if (Array.isArray(val)) {
            return val.includes(this.filterValues[filter]);
          }

          return this.filterValues[filter] === val;
        });
    },
    filter(filter, value) {
      this.$emit('filter', filter, value.data);
      if (this.filterValues[filter] !== value) {
        this.computeActiveOperations();
      }
    },
    search(value, force) {
      if ((force && !value) || value.data === '') {
        value = {
          data: '',
          error: false
        };
      } else if (!value || value.error || (!force && value.data.length < 3)) {
        return;
      }

      this.$emit('search', value.data);
    },
    registerPageChange(pageNum) {
      this.$emit('page-change', pageNum);
    },
    async beginGroupedOperation(action, operations) {
      const operation = operations.find(o => o.action === action);

      operation.modal ? await this.modalOperation(operation) : await this.confirmOperation(operation);
    },
    async modalOperation({
      modal, ...rest
    }) {
      await apos.modal.execute(modal, {
        checked: this.checked,
        moduleName: this.moduleName,
        ...rest
      });
    },
    async confirmOperation ({
      modalOptions = {}, action, operations, label, ...rest
    }) {
      const {
        title = label,
        description = '',
        confirmationButton = 'apostrophe:affirmativeLabel',
        form
      } = action && operations
        ? (operations.find((op) => op.action === action)).modalOptions
        : modalOptions;

      const interpolations = {
        count: this.checkedCount,
        type: this.checkedCount === 1
          ? this.$t(this.labels.singular)
          : this.$t(this.labels.plural)
      };

      const confirmed = await apos.confirm({
        heading: this.$t(title, interpolations),
        description: this.$t(description, interpolations),
        affirmativeLabel: confirmationButton,
        localize: false,
        ...form && form
      });

      if (confirmed) {
        this.$emit('batch', {
          label,
          action,
          ...rest
        });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-manager-toolbar ::v-deep {
    .apos-field--search {
      width: 250px;
    }
    .apos-input {
      height: 32px;
    }
  }
</style>
