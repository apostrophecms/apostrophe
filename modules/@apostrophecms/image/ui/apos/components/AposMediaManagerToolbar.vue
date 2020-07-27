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
      <AposFilterMenu :menu="filterFields" @input="filter" />
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
    applyTags: {
      type: Array,
      default () {
        return [];
      }
    }
  },
  emits: [ 'filter', 'search', 'trash-click', 'select-click' ],

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
      filterFields: {
        published: {
          field: {
            name: 'published',
            type: 'radio',
            label: 'Published State',
            choices: [
              {
                label: 'Published',
                value: 'published'
              },
              {
                label: 'Unpublished',
                value: 'unpublished'
              }
            ]
          },
          value: { data: 'published' },
          status: {}
        },
        trash: {
          field: {
            name: 'trash',
            type: 'radio',
            label: 'Trash',
            choices: [
              {
                label: 'No',
                value: 'false'
              },
              {
                label: 'Yes',
                value: 'true'
              }
            ]
          },
          value: { data: 'false' },
          status: {}
        }
      }
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
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-media-manager-toolbar /deep/ .apos-field-search {
    width: 250px;
  }
</style>
