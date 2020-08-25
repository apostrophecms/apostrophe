<template>
  <AposModalToolbar class-name="apos-pieces-manager-toolbar">
    <template #leftControls>
      <AposButton
        label="Select" :icon-only="true"
        :icon="checkboxIcon" type="outline"
        @click="$emit('select-click')" :icon-color="iconColor"
      />
      <AposTagApply :tags="applyTags" :apply-to="[]" />
      <!-- TODO: trash component needs to be worked out with confirm, maybe separate into its own component -->
      <AposButton
        label="Delete" @click="$emit('trash-click')"
        :icon-only="true" icon="delete-icon"
        type="outline"
      />
      <AposContextMenu
        :button="more.button" :menu="more.menu"
        tip-alignment="right"
        @item-clicked="managerAction"
      />
    </template>
    <template #rightControls>
      <AposPager
        @click="registerPageChange" @change="registerPageChange"
        :total-pages="totalPages" :current-page="currentPage"
      />
      <AposFilterMenu
        :filters="filters"
        @input="filter"
      />
      <AposInputString
        @input="search" :field="searchField.field"
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
    totalPages: {
      type: Number,
      default: 1
    },
    currentPage: {
      type: Number,
      default: 1
    }
  },
  emits: [ 'trash-click', 'select-click', 'filter', 'search', 'page-change' ],
  data() {
    return {
      more: {
        button: {
          label: 'More operations',
          iconOnly: true,
          icon: 'dots-vertical-icon',
          type: 'outline'
        },
        menu: [
          {
            label: 'Unpublish All',
            action: 'unpublish-all'
          }
        ]
      },
      searchField: {
        field: {
          name: 'search',
          placeholder: 'Search Images',
          icon: 'magnify-icon'
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
    },
    iconColor() {
      if (this.selectedState === 'checked' || this.selectedState === 'indeterminate') {
        return 'var(--a-primary)';
      }

      return null;
    }
  },
  methods: {
    filter(filter, value) {
      this.$emit('filter', filter, value.data);
    },
    search(value) {
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
  .apos-pieces-manager-toolbar /deep/ .apos-field-search {
    width: 250px;
  }

</style>
