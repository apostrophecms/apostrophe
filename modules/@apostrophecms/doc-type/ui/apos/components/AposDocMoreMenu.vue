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
    isModified: {
      type: Boolean,
      required: true
    }
  },
  data() {
    return {
      isOpen: false,
      menu: [
        // TODO
        // ...(this.isModified ? [
        //   {
        //     label: 'Share Draft',
        //     action: 'share'
        //   }
        // ] : []),
        // // You can always do this, if you do it with a new item
        // // it just saves and you start a second one
        // {
        //   label: 'Duplicate Document',
        //   action: 'duplicate'
        // },
        ...(this.isModified ? [
          {
            label: 'Discard Draft',
            action: 'discardDraft',
            modifiers: [ 'danger' ]
          }
        ] : [])
      ]
    };
  },
  methods: {
    menuHandler(action) {
      this.$emit(action);
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
