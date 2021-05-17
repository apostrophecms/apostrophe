<template>
  <AposContextMenu
    class="apos-admin-bar_context-button"
    :menu="menu"
    :disabled="disabled || (menu.length === 0)"
    menu-placement="bottom-end"
    @item-clicked="menuHandler"
    @open="$emit('menu-open')"
    @close="$emit('menu-close')"
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
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposArchiveMixin from 'Modules/@apostrophecms/ui/mixins/AposArchiveMixin';
import klona from 'klona';

export default {
  name: 'AposDocContextMenu',
  mixins: [ AposPublishMixin, AposArchiveMixin ],
  props: {
    doc: {
      type: Object,
      required: true
    },
    // If editing in a modal, pass the current value object from the editor here
    // so that the visibility of options takes unsaved changes into account
    current: {
      type: Object,
      default() {
        return null;
      }
    },
    // Existing published version of doc, if there is one
    published: {
      type: Object,
      default() {
        return null;
      }
    },
    // These props all default to true, and can be passed with a value of false to hide
    // functionality even if the user can otherwise perform the action on this document.
    // The component will figure out on its own if the user can perform each action or not.
    showEdit: {
      type: Boolean,
      default() {
        return true;
      }
    },
    showPreview: {
      type: Boolean,
      default() {
        return true;
      }
    },
    showDiscardDraft: {
      type: Boolean,
      default() {
        return true;
      }
    },
    showCopy: {
      type: Boolean,
      default() {
        return true;
      }
    },
    showArchive: {
      type: Boolean,
      default() {
        return true;
      }
    },
    showRestore: {
      type: Boolean,
      default() {
        return true;
      }
    },
    showDismissSubmission: {
      type: Boolean,
      default() {
        return true;
      }
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'menu-open', 'menu-close', 'close' ],
  data() {
    return {
      // Updated by both the context prop and any content-changed apos events
      context: this.doc
    };
  },
  computed: {
    menu() {
      const menu = [
        // TODO
        // ...(this.isModifiedFromPublished ? [
        //   {
        //     label: 'Share Draft',
        //     action: 'share'
        //   }
        // ] : []),
        ...((this.showEdit && this.context._edit) ? [
          {
            // When archived the edit action opens a read-only "editor"
            label: this.context.archived ? 'View' : 'Edit',
            action: 'edit'
          }
        ] : []),
        ...((this.showPreview && this.context._url) ? [
          {
            label: 'Preview',
            action: 'preview'
          }
        ] : []),
        ...((this.showDismissSubmission && this.canDismissSubmission) ? [
          {
            label: 'Dismiss Submission',
            action: 'dismissSubmission'
          }
        ] : []),
        ...(this.showCopy && this.canCopy ? [
          {
            label: 'Duplicate...',
            action: 'copy'
          }
        ] : []),
        ...((this.showDiscardDraft && this.canDiscardDraft) ? [
          {
            label: this.isPublished ? 'Discard Draft' : 'Delete Draft',
            action: 'discardDraft',
            modifiers: [ 'danger' ]
          }
        ] : []),
        ...(this.showArchive && this.canArchive ? [
          {
            label: 'Archive',
            action: 'archive',
            modifiers: [ 'danger' ]
          }
        ] : []),
        ...(this.showRestore && this.canRestore ? [
          {
            label: 'Restore',
            action: 'restore'
          }
        ] : [])
      ];
      return menu;
    },
    moduleName() {
      if (this.context.slug.startsWith('/')) {
        return '@apostrophecms/page';
      } else {
        return this.context.type;
      }
    },
    moduleOptions() {
      return apos.modules[this.moduleName];
    },
    canPublish() {
      if (this.context._id) {
        return this.context._publish;
      } else {
        return this.moduleOptions.canPublish;
      }
    },
    canEdit() {
      if (this.context._id) {
        return this.context._edit;
      } else {
        return true;
      }
    },
    canDismissSubmission() {
      return this.context.submitted && (this.canPublish || (this.context.submitted.byId === apos.login.user._id));
    },
    canDiscardDraft() {
      return (
        this.context._id &&
        (!this.context.lastPublishedAt) &&
        this.manuallyPublished
      ) || (this.isModifiedFromPublished && !this.moduleOptions.singleton);
    },
    canArchive() {
      return (
        this.context._id &&
        !this.moduleOptions.singleton &&
        !this.context.archived &&
        !this.context.parked &&
        ((this.moduleOptions.canPublish && this.context.lastPublishedAt) || !this.manuallyPublished)
      );
    },
    canCopy() {
      return this.canEdit && !this.moduleOptions.singleton;
    },
    canRestore() {
      return (
        this.context._id &&
        this.context.archived &&
        ((this.moduleOptions.canPublish && this.context.lastPublishedAt) || !this.manuallyPublished)
      );
    },
    manuallyPublished() {
      return this.moduleOptions.localized && !this.moduleOptions.autopublish;
    },
    isModifiedFromPublished() {
      if (!this.context.lastPublishedAt) {
        return false;
      }
      if (!this.published) {
        return false;
      }
      return detectDocChange(this.schema, this.published, this.current || this.context);
    },
    schema() {
      let schema = (this.moduleOptions.schema || []).filter(field => apos.schema.components.fields[field.type]);
      if (this.restoreOnly) {
        schema = klona(schema);
        for (const field of schema) {
          field.readOnly = true;
        }
      }
      // Archive UI is handled via action buttons
      schema = schema.filter(field => field.name !== 'archived');
      return schema;
    }
  },
  watch: {
    doc() {
      this.context = this.doc;
    }
  },
  mounted() {
    apos.bus.$on('content-changed', this.onContentChanged);
  },
  destroyed() {
    apos.bus.$off('content-changed', this.onContentChanged);
  },
  methods: {
    onContentChanged(e) {
      if (e.doc && (e.doc._id === this.context._id)) {
        this.context = e.doc;
      }
    },
    menuHandler(action) {
      this[action](this.context);
    },
    async edit(doc) {
      await apos.modal.execute(this.moduleOptions.components.editorModal, {
        moduleName: this.moduleName,
        docId: doc._id
      });
    },
    preview(doc) {
      window.open(doc._url, '_blank').focus();
    },
    async copy(doc) {
      // If there are changes warn the user before discarding them before
      // the copy operation
      if (this.current) {
        if (!await this.confirmAndCancel()) {
          return;
        } else {
          this.$emit('close', doc);
        }
      }
      apos.bus.$emit('admin-menu-click', {
        itemName: `${this.moduleName}:editor`,
        props: {
          copyOf: {
            ...this.current || doc,
            _id: doc._id
          }
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
