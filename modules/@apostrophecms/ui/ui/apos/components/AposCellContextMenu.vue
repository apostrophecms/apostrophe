<template>
  <div class="apos-table__cell-field apos-table__cell-field--context-menu">
    <span class="apos-table__cell-field--context-menu__content" :class="classes">
      <AposDocMoreMenu
        :doc-id="item._id"
        :is-modified="item.modified"
        :can-discard-draft="item.modified"
        :is-modified-from-published="item.modified"
        :is-published="!!item.lastPublishedAt"
        :can-save-draft="false"
        :can-open-editor="!item.archived"
        :can-preview="(!!item._url && !item.archived)"
        :can-archive="!item.archived"
        :can-restore="item.archived"
        :can-copy="(!!item._id && !item.archived)"
        @edit="$emit('edit')"
        @preview="$emit('preview')"
        @copy="$emit('copy')"
        @archive="$emit('archive')"
        @restore="$emit('restore')"
        @discardDraft="$emit('discardDraft')"
        @menu-open="menuOpen = true"
        @menu-close="menuOpen = false"
      />
    </span>
  </div>
</template>

<script>
export default {
  name: 'AposCellContextMenu',
  props: {
    state: {
      type: Object,
      default() {
        return null;
      }
    },
    item: {
      type: Object,
      required: true
    }
  },
  emits: [ 'edit', 'preview', 'copy', 'archive', 'discardDraft', 'restore' ],
  data() {
    return {
      menuOpen: false
    };
  },
  computed: {
    classes() {
      const classes = [ ];
      if (!this.state || this.state.hover || this.menuOpen) {
        classes.push('is-visible');
      }
      return classes;
    }
  },
  methods: {
    handler(action) {
      this.$emit(action);
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
