<template>
  <div class="apos-table__cell-field apos-table__cell-field--context-menu">
    <span class="apos-table__cell-field--context-menu__content" :class="classes">
      <AposDocMoreMenu
        :doc-id="item._id"
        :is-modified="manuallyPublished && item.modified"
        :can-discard-draft="manuallyPublished && item.modified"
        :is-modified-from-published="manuallyPublished && item.modified"
        :is-published="manuallyPublished && !!item.lastPublishedAt"
        :can-save-draft="false"
        :can-open-editor="!item.archived"
        :can-preview="(!!item._url && !item.archived)"
        :can-archive="!item.archived && item._publish"
        :can-restore="item.archived && item._publish"
        :can-copy="(!!item._id && !item.archived)"
        :can-dismiss-submission="item.submitted && (item._publish || (item.submitted.byId === userId))"
        @edit="$emit('edit')"
        @preview="$emit('preview')"
        @copy="$emit('copy')"
        @archive="$emit('archive')"
        @restore="$emit('restore')"
        @discard-draft="$emit('discard-draft')"
        @dismiss-submission="$emit('dismiss-submission')"
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
  emits: [ 'edit', 'preview', 'copy', 'archive', 'discard-draft', 'dismiss-submission', 'restore' ],
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
    },
    userId() {
      return apos.login.user._id;
    },
    manuallyPublished() {
      const module = apos.modules[this.item.type];
      return module.localized && !module.autopublish;
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
