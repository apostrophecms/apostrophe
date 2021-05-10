<template>
  <div class="apos-table__cell-field apos-table__cell-field--context-menu">
    <span class="apos-table__cell-field--context-menu__content" :class="classes">
      <AposDocMoreMenu
        :disabled="disabled"
        :doc-id="item._id"
        :is-modified="manuallyPublished && item.modified"
        :can-discard-draft="canDiscardDraft"
        :is-modified-from-published="manuallyPublished && item.modified"
        :is-published="manuallyPublished && !!item.lastPublishedAt"
        :can-save-draft="false"
        :can-open-editor="true"
        :can-delete="item.archived"
        :can-preview="(!!item._url && !item.archived)"
        :can-archive="canArchive"
        :can-restore="item.archived && item._edit"
        :can-copy="!!item._id && !item.archived && canCreate"
        :can-dismiss-submission="canDismissSubmission && item.submitted && (item._publish || (item.submitted.byId === userId))"
        @edit="$emit('edit')"
        @preview="$emit('preview')"
        @copy="$emit('copy')"
        @archive="$emit('archive')"
        @restore="$emit('restore')"
        @discard-draft="$emit('discard-draft')"
        @dismiss-submission="$emit('dismiss-submission')"
        @delete="$emit('delete')"
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
  emits: [ 'edit', 'preview', 'copy', 'archive', 'discard-draft', 'dismiss-submission', 'restore', 'delete' ],
  data() {
    return {
      menuOpen: false
    };
  },
  computed: {
    disabled() {
      return this.item.type === '@apostrophecms/archive-page';
    },
    canCreate() {
      // Defaults to yes as only "virtual" views like "submitted drafts" would forbid it
      if (this.options.canCreate != null) {
        return this.options.canCreate;
      } else {
        return true;
      }
    },
    canDiscardDraft() {
      let initial = true;
      // Defaults to yes as only "virtual" views like "submitted drafts" would forbid it
      if (this.options.canDiscardDraft != null) {
        initial = this.options.canDiscardDraft;
      }
      return initial && this.manuallyPublished && !this.item.archived && (this.item.modified || !this.item.lastPublishedAt);
    },
    canArchive() {
      let initial = true;
      // Defaults to yes as only "virtual" views like "submitted drafts" would forbid it
      if (this.options.canArchive != null) {
        initial = this.options.canArchive;
      }
      return initial && !this.item.parked && !this.item.archived && this.item._publish && (!this.manuallyPublished || !!this.item.lastPublishedAt);
    },
    canDismissSubmission() {
      // Defaults to no as this is really only for the "submitted drafts" view
      return this.options.canDismissSubmission;
    },
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
