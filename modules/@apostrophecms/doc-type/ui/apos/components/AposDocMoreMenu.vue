<template>
  <AposContextMenu
    class="apos-admin-bar__context-button"
    :menu="menu"
    menu-placement="bottom-end"
    @item-clicked="menuHandler"
    :button="{
      tooltip: { content: 'More Options', placement: 'bottom' },
      label: 'More Options',
      icon: 'dots-vertical-icon',
      iconOnly: true,
      type: 'subtle',
      modifiers: ['small', 'no-motion']
    }"
  />
</template>

<script>

export default {
  name: 'AposDocMoreMenu',
  props: {
    docId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      isOpen: false,
      menu: [
        {
          label: 'Share Draft',
          action: 'share'
        },
        {
          label: 'Duplicate Document',
          action: 'duplicate'
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
    async duplicate() {
      console.log('TODO: stub for Duplicate action');
    },
    async share() {
      console.log('TODO: stub for Share Draft action');
    },
    async revertToLastPublished() {
      console.log('TODO: stub for revertToLastPublished action');
    },
    async menuHandler(action) {
      this[action]();
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
