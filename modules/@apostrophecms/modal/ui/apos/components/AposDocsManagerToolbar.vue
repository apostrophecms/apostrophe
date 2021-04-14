<template>
  <AposModalToolbar class-name="apos-manager-toolbar">
    <template #leftControls>
      <AposButton
        v-if="!options.hideSelectAll"
        label="Select" :icon-only="true"
        :icon="checkboxIcon" type="outline"
        @click="$emit('select-click')"
      />
      <!-- TODO: Return this delete button when batch updates are added -->
      <!-- <AposButton
        label="Delete" @click="$emit('archive-click')"
        :icon-only="true" icon="delete-icon"
        type="outline"
      /> -->
      <!-- <AposContextMenu
        :button="more.button"
        :menu="more.menu"
        @item-clicked="managerAction"
      /> -->
    </template>
    <template #rightControls>
      <AposPager
        v-if="!options.noPager && totalPages !== 0"
        @click="registerPageChange" @change="registerPageChange"
        :total-pages="totalPages" :current-page="currentPage"
      />
      <AposFilterMenu
        v-if="filters.length > 0"
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
    }
  },
  emits: [
    'archive-click',
    'select-click',
    'filter',
    'search',
    'page-change'
  ],
  data() {
    return {
      // TODO: Uncomment to return this when batch updates are added.
      // more: {
      //   button: {
      //     label: 'More operations',
      //     iconOnly: true,
      //     icon: 'dots-vertical-icon',
      //     type: 'outline'
      //   },
      //   menu: [
      //     {
      //       label: 'Unpublish All',
      //       action: 'unpublish-all'
      //     }
      //   ]
      // },
      searchField: {
        field: {
          name: 'search',
          placeholder: `Search ${this.labels.plural || ''}`,
          icon: 'magnify-icon',
          enterSubmittable: true
        },
        status: {},
        value: { data: '' }
      }
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
  methods: {
    filter(filter, value) {
      this.$emit('filter', filter, value.data);
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
    managerAction(action) {
      // TODO: flesh this out.
      console.info('ACTION: ', action);
    },
    registerPageChange(pageNum) {
      this.$emit('page-change', pageNum);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-manager-toolbar /deep/ .apos-field--search {
    width: 250px;
  }
</style>
