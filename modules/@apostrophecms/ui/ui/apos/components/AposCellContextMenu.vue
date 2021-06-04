<template>
  <div class="apos-table__cell-field apos-table__cell-field--context-menu">
    <span class="apos-table__cell-field--context-menu__content" :class="classes">
      <AposDocContextMenu
        :disabled="disabled"
        :doc="draft"
        :published="published"
        :show-edit="options.showEdit"
        :show-preview="options.showPreview"
        :show-discard-draft="options.showDiscardDraft"
        :show-copy="options.showCreate"
        :show-archive="options.showArchive"
        :show-restore="options.showRestore"
        :show-dismiss-submission="options.showDismissSubmission"
        @menu-open="menuOpen = true"
        @menu-close="menuOpen = false"
      />
    </span>
  </div>
</template>

<script>

import AposCellMixin from 'Modules/@apostrophecms/ui/mixins/AposCellMixin';

export default {
  name: 'AposCellContextMenu',
  mixins: [ AposCellMixin ],
  props: {
    state: {
      type: Object,
      default() {
        return null;
      }
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  data() {
    return {
      menuOpen: false
    };
  },
  computed: {
    disabled() {
      return this.item.type === '@apostrophecms/archive-page';
    },
    classes() {
      const classes = [ ];
      if (!this.state || this.state.hover || this.menuOpen) {
        classes.push('apos-is-visible');
      }
      return classes;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-table__cell-field--context-menu__content {
    @include apos-transition();
    display: inline-block;
    opacity: 0;
    &.apos-is-visible {
      opacity: 1;
    }
  }
</style>
