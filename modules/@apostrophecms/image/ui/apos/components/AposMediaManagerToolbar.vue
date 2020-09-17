<template>
  <AposModalToolbar class-name="apos-media-manager-toolbar">
    <template #leftControls>
      <AposButton
        label="Select" :icon-only="true"
        :icon="checkboxIcon" type="outline"
        @click="$emit('select-click')"
      />
      <AposTagApply :tags="applyTags" :apply-to="[]" />
      <!-- TODO trash component needs to be worked out with confirm, maybe separate into its own component -->
      <AposButton
        label="Delete" @click="$emit('trash-click')"
        :icon-only="true" icon="delete-icon"
        type="outline"
      />
      <AposContextMenu
        :button="more.button" :menu="more.menu"
        tip-alignment="right"
      />
    </template>
    <template #rightControls>
      <AposPager
        v-if="totalPages > 1"
        @click="registerPageChange" @change="registerPageChange"
        :total-pages="totalPages" :current-page="currentPage"
      />
      <AposFilterMenu :filters="filterFields" @input="filter" />
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
    checked: {
      type: Array,
      default () {
        return [];
      }
    },
    media: {
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
    },
    applyTags: {
      type: Array,
      default () {
        return [];
      }
    }
  },
  emits: [
    'filter',
    'search',
    'trash-click',
    'select-click',
    'page-change'
  ],

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
      },
      filterFields: [
        {
          name: 'published',
          label: 'Published',
          inputType: 'radio',
          choices: [
            {
              value: true,
              label: 'Published'
            },
            {
              value: false,
              label: 'Draft'
            },
            {
              value: 'any',
              label: 'Both'
            }
          ],
          allowedInChooser: false,
          def: true
        },
        {
          name: 'trash',
          label: 'Trash',
          inputType: 'radio',
          choices: [
            {
              value: false,
              label: 'Live'
            },
            {
              value: true,
              label: 'Trash'
            },
            {
              value: 'any',
              label: 'None'
            }
          ],
          allowedInChooser: false,
          def: false
        }
      ]
    };
  },
  computed: {
    checkboxIcon() {
      if (this.checked.length === this.media.length) {
        return 'checkbox-marked-icon';
      }
      if (this.checked.length < this.media.length && this.checked.length !== 0) {
        return 'minus-box-icon';
      }
      return 'checkbox-blank-icon';
    }
  },
  methods: {
    filter(value, field) {
      this.$emit('filter', field, value.data);
    },
    search(value) {
      this.$emit('search', value.data);
    },
    registerPageChange(pageNum) {
      this.$emit('page-change', pageNum);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-media-manager-toolbar /deep/ .apos-field-search {
    width: 250px;
  }
</style>
8
