<template>
  <AposContextMenu
    class="apos-admin-bar__context-button"
    :menu="menu"
    :disabled="disabled"
    menu-placement="bottom-end"
    @item-clicked="menuHandler"
    @open="$emit('menuOpen')"
    @close="$emit('menuClose')"
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
    canOpenEditor: {
      type: Boolean,
      default() {
        return false;
      }
    },
    canArchive: {
      type: Boolean,
      default() {
        return false;
      }
    },
    canPreview: {
      type: Boolean,
      default() {
        return false;
      }
    },
    canRestore: {
      type: Boolean,
      default() {
        return false;
      }
    },
    canSaveDraft: {
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
    canCopy: {
      type: Boolean,
      default() {
        return false;
      }
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'menuOpen', 'menuClose' ],
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
    },
    isPublished() {
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
        ...(this.canOpenEditor ? [
          {
            label: 'Edit',
            action: 'edit'
          }
        ] : []),
        ...(this.canPreview ? [
          {
            label: 'Preview',
            action: 'preview'
          }
        ] : []),
        ...(this.canSaveDraft ? [
          {
            label: 'Save Draft',
            action: 'saveDraft'
          }
        ] : []),
        ...(this.canCopy ? [
          {
            label: 'Duplicate...',
            action: 'copy'
          }
        ] : []),
        ...(this.canDiscardDraft ? [
          {
            label: this.isPublished ? 'Discard Changes' : 'Discard Draft',
            action: 'discardDraft',
            modifiers: [ 'danger' ]
          }
        ] : []),
        ...(this.canArchive ? [
          {
            label: 'Archive',
            action: 'archive',
            modifiers: [ 'danger' ]
          }
        ] : []),
        ...(this.canRestore ? [
          {
            label: 'Restore from Archive',
            action: 'restore'
          }
        ] : [])
      ];
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
