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
      tooltip: { content: 'apostrophe:moreOptions', placement: 'bottom' },
      label: 'apostrophe:moreOptions',
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
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import klona from 'klona';

export default {
  name: 'AposDocContextMenu',
  mixins: [ AposPublishMixin, AposArchiveMixin, AposModifiedMixin ],
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
    // Unlike the others, this one defaults to false because it is
    // generally only allowed in the Manage Submissions view.
    showDismissSubmission: {
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
            label: this.context.archived ? 'apostrophe:view' : 'apostrophe:edit',
            action: 'edit'
          }
        ] : []),
        ...((this.showPreview && this.context._url) ? [
          {
            label: 'apostrophe:preview',
            action: 'preview'
          }
        ] : []),
        ...((this.showDismissSubmission && this.canDismissSubmission) ? [
          {
            label: 'apostrophe:dismissSubmission',
            action: 'dismissSubmission'
          }
        ] : []),
        ...(this.showCopy && this.canCopy ? [
          {
            label: 'apostrophe:duplicate',
            action: 'copy'
          }
        ] : []),
        ...(this.canLocalize ? [
          {
            label: 'apostrophe:localize',
            action: 'localize'
          }
        ] : []),
        ...((this.showDiscardDraft && this.canDiscardDraft) ? [
          {
            label: this.context.lastPublishedAt ? 'apostrophe:discardDraft' : 'apostrophe:deleteDraft',
            action: 'discardDraft',
            modifiers: [ 'danger' ]
          }
        ] : []),
        ...(this.showArchive && this.canArchive ? [
          {
            label: 'apostrophe:archive',
            action: 'archive',
            modifiers: [ 'danger' ]
          }
        ] : []),
        ...(this.showRestore && this.canRestore ? [
          {
            label: 'apostrophe:restore',
            action: 'restore'
          }
        ] : [])
      ];
      return menu;
    },
    moduleName() {
      if (apos.modules[this.context.type].action === apos.modules['@apostrophecms/page'].action) {
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
      if (!this.manuallyPublished) {
        return false;
      }
      if (!this.context._id) {
        return false;
      }
      return (
        (!this.context.lastPublishedAt) &&
        !this.moduleOptions.singleton
      ) || (
        this.context.lastPublishedAt &&
        this.isModifiedFromPublished
      );
    },
    canLocalize() {
      return (Object.keys(apos.i18n.locales).length > 1) && this.moduleOptions.localized && this.context._id;
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
      return this.canEdit && !this.moduleOptions.singleton && this.context._id;
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
    isModified() {
      if (!this.current) {
        return false;
      }
      return detectDocChange(this.schema, this.context, this.current);
    },
    isModifiedFromPublished() {
      if (this.context.modified) {
        // In a list context, we won't have every area property to
        // compare, but we will have this previously set flag
        return true;
      }
      if (!this.context.lastPublishedAt) {
        return false;
      }
      if (!this.published) {
        return false;
      }
      const result = detectDocChange(this.schema, this.published, this.context);
      return result;
    },
    schema() {
      // moduleOptions gives us the action, etc. but here we need the schema
      // which is always type specific, even for pages so get it ourselves
      let schema = (apos.modules[this.context.type].schema || []).filter(field => apos.schema.components.fields[field.type]);
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
    },
    async localize(doc) {
      // If there are changes warn the user before discarding them before
      // the localize operation
      if (this.current) {
        if (!await this.confirmAndCancel()) {
          return;
        } else {
          this.$emit('close', doc);
        }
      }
      apos.bus.$emit('admin-menu-click', {
        itemName: '@apostrophecms/i18n:localize',
        props: {
          doc
        }
      });
    },
    close() {
      this.$emit('close', this.doc);
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
