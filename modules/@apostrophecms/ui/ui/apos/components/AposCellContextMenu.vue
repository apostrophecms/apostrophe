<template>
  <div class="apos-table__cell-field apos-table__cell-field--context-menu">
    <span class="apos-table__cell-field--context-menu__content" :class="classes">
      <AposDocContextMenu
        :disabled="disabled"
        :doc="draft"
        :published="published"
        :can-discard-draft="options.canDiscardDraft"
        :can-save-draft="false"
        :can-copy="options.canCreate"
        :can-dismiss-submission="options.canDismissSubmission"
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
        classes.push('is-visible');
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
    &.is-visible {
      opacity: 1;
    }
  }
</style>
