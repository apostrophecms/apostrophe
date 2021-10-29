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
        v-for="{ action, label, icon, operations, modalOptions } in showedOperations"
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
      this.showedOperations = this.moduleOptions.batchOperations
        .map(({ operations, ...rest }) => {
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
    // batchAction(action) {
    //   this.$emit('batch', action);
    // },
    registerPageChange(pageNum) {
      this.$emit('page-change', pageNum);
    },
    async operationModal ({
      modalOptions, action, operations
    }) {
      const { title, description } = action && operations
        ? (operations.find((ope) => ope.action === action)).modalOptions
        : modalOptions;

      const interpolations = {
        count: this.checkedCount,
        type: this.checkedCount === 1
          ? this.moduleOptions.label
          : this.moduleOptions.pluralLabel
      };

      const confirmed = await apos.confirm({
        heading: this.$t(title, interpolations),
        description: this.$t(description, interpolations),
        localize: false,
        form: {
          schema: [ {
            type: 'radio',
            name: 'choice',
            required: true,
            choices: [ {
              // Form labels don't normally localize on the client side
              // because schemas are almost always localized before
              // pushing to the client side
              label: 'apostrophe:restoreOnlyThisPage',
              value: 'this'
            }, {
              label: 'apostrophe:restoreThisPageAndSubpages',
              value: 'all'
            } ]
          } ],
          value: {
            data: {}
          }
        }
      });

      console.log('confirmed ===> ', confirmed);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-manager-toolbar ::v-deep .apos-field--search {
    width: 250px;
  }
</style>
