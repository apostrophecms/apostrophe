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
      :can-preview="!!doc._url"
      :can-archive="!!doc.lastPublishedAt"
      :can-copy="!!doc._id"
      @edit="$emit('edit')"
      @preview="$emit('preview')"
      @copy="$emit('copy')"
      @archive="$emit('archive')"
      @discardDraft="$emit('discardDraft')"
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
  emits: [ 'edit', 'preview', 'copy', 'archive', 'discardDraft' ],
  data() {
    return {
      hidden: true
    };
  },
  computed: {
    classes() {
      const classes = [ ];
      if (this.state.hover) {
        classes.push('is-hovered');
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
  // .is-hovered {
  //   border: 3px solid var(--a-danger);
  // }
</style>
