<template>
  <AposContextMenu
    v-if="options.contextId"
    class="apos-admin-bar__context-button"
    :menu="menu"
    menu-placement="bottom-end"
    :button="{
      tooltip: { content: 'More Options', placement: 'bottom' },
      label: 'More Options',
      icon: 'dots-vertical-icon',
      iconOnly: true,
      type: 'subtle',
      modifiers: ['small', 'no-motion']
    }"
    @item-clicked="emitEvent"
  >
    <ul class="apos-context-menu__items" v-if="menu">
      <AposContextMenuItem
        v-for="item in menu"
        :key="item.action"
        :menu-item="item"
        @clicked="menuItemClicked"
        :open="isOpen"
      />
    </ul>
  </AposContextMenu>
</template>

<script>

export default {
  name: 'AposDocMoreMenu',
  props: {
    options: {
      type: Object,
      required: true
    }
  },
  emits: [ 'admin-menu-click' ],
  data() {
    return {
      menu: [
        {
          label: 'Share Draft',
          action: 'share'
        },
        {
          label: 'Save Draft',
          action: 'save'
        },
        {
          label: 'Duplicate Document',
          action: 'duplicate'
        },
        {
          label: 'Version History',
          action: 'versions'
        },
        {
          label: 'Revert to Last Published',
          action: 'revertToLastPublished',
          modifiers: [ 'danger' ]
        }
      ]
    };
  },
  methods: {
    menuHandler(action) {
      console.log(`do ${action}`);
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
