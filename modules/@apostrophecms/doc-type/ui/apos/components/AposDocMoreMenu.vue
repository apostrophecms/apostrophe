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
      default() {
        return false;
      }
    },
    isModifiedFromPublished: {
      type: Boolean,
      default() {
        return false;
      }
    },
    isPublished: {
      type: Boolean,
      default() {
        return false;
      }
    },
    canDiscardDraft: {
      type: Boolean,
      default() {
        return false;
      }
    },
    options: {
      type: Object,
      required: true
      // subproperties:
      // saveDraft: Boolean
      // If true, the save draft option is offered
      // when isModified is currently true. This does
      // not make sense in the onpage contextual editor,
      // because it continuously saves drafts.
    }
  },
  data() {
    const menu = {
      isOpen: false,
      menu: this.recomputeMenu()
    };
    return menu;
  },
  watch: {
    isModified() {
      this.menu = this.recomputeMenu();
    },
    isModifiedFromPublished() {
      this.menu = this.recomputeMenu();
    }
  },
  methods: {
    menuHandler(action) {
      this.$emit(action);
    },
    recomputeMenu() {
      return [
        // TODO
        // ...(this.isModifiedFromPublished ? [
        //   {
        //     label: 'Share Draft',
        //     action: 'share'
        //   }
        // ] : []),
        // TODO
        // // You can always do this, if you do it with a new item
        // // it just saves and you start a second one
        // {
        //   label: 'Duplicate Document',
        //   action: 'duplicate'
        // },
        ...(this.canDiscardDraft ? [
          {
            label: this.isPublished ? 'Discard Changes' : 'Discard Draft',
            action: 'discardDraft',
            modifiers: [ 'danger' ]
          }
        ] : []),
        ...((this.isModified && this.options.saveDraft) ? [
          {
            label: 'Save Draft',
            action: 'saveDraft'
          }
        ] : [])
      ];
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
