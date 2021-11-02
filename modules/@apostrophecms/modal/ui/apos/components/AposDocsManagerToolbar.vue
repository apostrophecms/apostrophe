<template>
  <AposModalToolbar class-name="apos-manager-toolbar">
    <template #leftControls>
      <AposButton
        v-if="displayedItems"
        label="apostrophe:select"
        type="outline"
        text-color="var(--a-primary)"
        :icon-only="true"
        :icon="checkboxIcon"
        @click="$emit('select-click')"
      />
      <div
        v-for="{ action, label, icon, operations, modalOptions } in activeOperations"
        :key="action"
      >
        <AposButton
          v-if="!operations"
          label="label"
          :icon-only="true"
          :icon="icon"
          :disabled="!checkedCount"
          type="outline"
          @click="operationModal({ modalOptions })"
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
          @item-clicked="(action) => operationModal({ action, operations })"
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
        v-if="moduleOptions.filters.length"
        :filters="moduleOptions.filters"
        :choices="filterChoices"
        :values="filterValues"
        @input="filter"
      />
      <AposInputString
        v-if="!options.noSearch"
        @input="search" @return="search($event, true)"
        :field="searchField.field"
        :status="searchField.status" :value="searchField.value"
        :modifiers="['small']"
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
      default: () => {}
    },
    filterValues: {
      type: Object,
      default: () => {}
    },
    totalPages: {
      type: Number,
      default: 1
    },
    currentPage: {
      type: Number,
      default: 1
    },
    labels: {
      type: Object,
      default: () => {}
    },
    options: {
      type: Object,
      default: () => {}
    },
    displayedItems: {
      type: Number,
      required: true
    },
    checkedCount: {
      type: Number,
      required: true
    },
    moduleOptions: {
      type: Object,
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
    }
  },
  mounted () {
    this.computeActiveOperations();
  },
  methods: {
    computeActiveOperations () {
      this.activeOperations = this.moduleOptions.batchOperations
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
    batchAction(action) {
      this.$emit('batch', action);
    },
    registerPageChange(pageNum) {
      this.$emit('page-change', pageNum);
    },
    async operationModal ({
      modalOptions, action, operations
    }) {
      const {
        title, description, form
      } = action && operations
        ? (operations.find((op) => op.action === action)).modalOptions
        : modalOptions;

      const interpolations = {
        count: this.checkedCount,
        type: this.checkedCount === 1
          ? this.moduleOptions.label
          : this.moduleOptions.pluralLabel
      };

      // TODO: request batch operation to backend
      // eslint-disable-next-line
      const confirmed = await apos.confirm({
        heading: this.$t(title, interpolations),
        description: this.$t(description, interpolations),
        localize: false,
        ...form && form
      });
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-manager-toolbar ::v-deep .apos-field--search {
    width: 250px;
  }
</style>
