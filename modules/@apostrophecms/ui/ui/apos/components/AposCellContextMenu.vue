<template>
  <div
    class="apos-table__cell-field apos-table__cell-field--context-menu" :class="classes"
  >
    <AposDocMoreMenu
      :doc-id="doc._id"
      :is-modified="doc.modified"
      :can-discard-draft="doc.modified"
      :is-modified-from-published="doc.modified"
      :is-published="!!doc.lastPublishedAt"
      :can-save-draft="false"
      :can-open-editor="true"
      :can-preview="(!!doc._url && !doc.archived)"
      :can-archive="!doc.archived"
      :can-unarchive="doc.archived"
      :can-copy="(!!doc._id && !doc.archived)"
      @edit="$emit('edit')"
      @preview="$emit('preview')"
      @copy="$emit('copy')"
      @archive="$emit('archive')"
      @unarchive="$emit('unarchive')"
      @discardDraft="$emit('discardDraft')"
      @menuOpen="menuOpen = true"
      @menuClose="menuOpen = false"
    />
  </div>
</template>

<script>
export default {
  name: 'AposCellContextMenu',
  props: {
    state: {
      type: Object,
      default() {
        return {};
      }
    },
    doc: {
      type: Object,
      required: true
    }
  },
  emits: [ 'edit', 'preview', 'copy', 'archive', 'discardDraft', 'unarchive' ],
  data() {
    return {
      menuOpen: false
    };
  },
  computed: {
    classes() {
      const classes = [ ];
      if (this.state.hover || this.menuOpen) {
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
  .apos-table__cell-field--context-menu {
    @include apos-transition();
    opacity: 0;
  }
  .is-visible {
    opacity: 1;
  }
</style>
