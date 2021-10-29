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
      <!-- TODO: Return this delete button when batch updates are added.
        When we do that though, we should do it like we handle the other
        batch operation events, not with extra event plumbing
        percolating everywhere. We can still achieve a custom button
        without that. -->
      <!-- <AposButton
        label="apostrophe:delete" @click="$emit('archive-click')"
        :icon-only="true" icon="delete-icon"
        type="outline"
      /> -->
      <div
        v-for="{name, label, icon, operations} in showedOperations"
        :key="name"
      >
        <AposButton
          v-if="!operations"
          label="label"
          :icon-only="true"
          :icon="icon"
          type="outline"
          @click="() => {}"
        />
        <AposContextMenu
          v-else
          :button="{
            label,
            icon,
            iconOnly: true,
            type: 'outline'
          }"
          :menu="operations"
          @item-clicked="batchAction"
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
      default () {
        return [];
      }
    },
    filters: {
      type: Array,
      default () {
        return [];
      }
    },
    filterChoices: {
      type: Object,
      default () {
        return {};
      }
    },
    filterValues: {
      type: Object,
      default () {
        return {};
      }
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
      default () {
        return {};
      }
    },
    options: {
      type: Object,
      default () {
        return {};
      }
    },
    batchOperations: {
      type: Array,
      default: () => []
    },
    displayedItems: {
      type: Number,
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
      showedOperations: []
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
    this.computeShowedOperations();
  },
  methods: {
    computeShowedOperations () {
      this.showedOperations = this.batchOperations.map(({ operations, ...rest }) => {
        if (!operations) {
          return {
            ...rest,
            operations
          };
        }

        return {
          operations: operations.filter((ope) => this.showOperation(ope)),
          ...rest
        };
      }).filter((operation) => {
        if (operation.operations && !operation.operations.length) {
          return false;
        }

        return this.showOperation(operation);
      });
    },
    showOperation (operation) {
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
      this.computeShowedOperations();
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
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-manager-toolbar ::v-deep .apos-field--search {
    width: 250px;
  }
</style>
