<template>
  <AposModalToolbar class-name="apos-manager-toolbar">
    <template #leftControls>
      <AposButton
        v-if="canSelectAll"
        ref="selectAll"
        label="apostrophe:select"
        type="outline"
        :modifiers="['small']"
        text-color="var(--a-base-1)"
        :icon-only="true"
        :icon="checkboxIcon"
        data-apos-test="selectAll"
        @click="selectAll"
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
        <AposTagApply
          v-if="action === 'tag'"
          :tags="batchTags"
          :apply-to="checkedDocsTags"
          @added="title => updateTag('create', { title })"
          @checked="slug => updateTag('add', { slug })"
          @unchecked="slug => updateTag('remove', { slug })"
          @refresh-data="$emit('refresh-data')"
        />
        <AposButton
          v-else-if="!operations"
          :label="label"
          :action="action"
          :icon="icon"
          :disabled="!checkedCount"
          :modifiers="['small']"
          type="outline"
          @click="executeOperation({ action, label, ...rest })"
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
          @item-clicked="(item) => beginGroupedOperation(item, operations)"
        />
      </div>
    </template>
    <template #rightControls>
      <AposPager
        v-if="!options.noPager && totalPages !== 0"
        :total-pages="totalPages"
        :current-page="currentPage"
        @click="registerPageChange"
        @change="registerPageChange"
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
        ref="search"
        :field="searchField.field"
        :status="searchField.status"
        :model-value="searchField.value"
        :modifiers="['small']"
        :no-blur-emit="true"
        @update:model-value="search"
        @return="search($event)"
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
    batchTags: {
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
    checkedTypes: {
      type: Array,
      default: null
    },
    checkedCount: {
      type: Number,
      required: true
    },
    checkedDocsTags: {
      type: Object,
      default: () => ({})
    },
    moduleName: {
      type: String,
      required: true
    }
  },
  emits: [
    'batch',
    'filter',
    'page-change',
    'refresh-data',
    'search',
    'select-click'
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
  unmounted () {
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
    search(value) {
      this.$emit('search', value.data);
    },
    registerPageChange(pageNum) {
      this.$emit('page-change', pageNum);
    },
    executeOperation(operation) {
      if (operation.modal) {
        return this.modalOperation(operation);
      }

      return this.confirmOperation(operation);
    },
    async beginGroupedOperation(item, operations) {
      const operation = operations.find(o => o.action === item.action);

      operation.modal
        ? await this.modalOperation(operation)
        : await this.confirmOperation(operation);
    },
    async modalOperation({
      modal, ...rest
    }) {
      await apos.modal.execute(modal, {
        checked: this.checked,
        checkedTypes: this.checkedTypes,
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
    },
    updateTag(operation, props) {
      const tagOperation = this.activeOperations.find(operation => operation.action === 'tag');
      const messages = tagOperation.messages?.[operation] || {};

      this.$emit('batch', {
        ...tagOperation,
        messages,
        requestOptions: {
          operation,
          ...props
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-manager-toolbar {
    :deep(.apos-field--search) {
      width: 250px;
    }

    :deep(.apos-input) {
      height: 32px;
    }
  }
</style>
