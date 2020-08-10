/*
  NOTE: Mostly based on aposPiecesManagerToolbar. Possibly could be combined.
*/
<template>
  <AposModalToolbar class-name="apos-pieces-manager-toolbar">
    <template #leftControls>
      <AposButton
        label="Select" :icon-only="true"
        :icon="checkboxIcon" type="outline"
        @click="$emit('select-click')" :icon-color="iconColor"
      />
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
  </AposModalToolbar>
</template>

<script>
// NOTE: This can probably be combined with the pieces toolbar when we switch
// to Vue 3 using the composition API.
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
    }
  },
  emits: ['trash-click', 'select-click'],
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
    managerAction(action) {
      // TODO: flesh this out. Paired with aposPiecesManagerToolbar
      console.info('ACTION: ', action);
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
