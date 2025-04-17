import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposArchiveMixin from 'Modules/@apostrophecms/ui/mixins/AposArchiveMixin';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import checkIfConditions from 'apostrophe/lib/check-if-conditions';

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
    // These props all default to true, and can be passed with
    // a value of false to hide functionality even if the user can
    // otherwise perform the action on this document. The component will
    // figure out on its own if the user can perform each action or not.
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
    canDeleteDraft: {
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
    },
    localeSwitched: {
      type: Boolean,
      default: false
    },
    moduleLabels: {
      type: Object,
      default: null
    }
  },
  emits: [ 'menu-open', 'menu-close', 'close' ],
  data() {
    return {
      // Updated by both the context prop and any content-changed apos events
      context: this.doc,
      // Custom context menu operations
      customOperations: apos.modules['@apostrophecms/doc'].contextOperations
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
        ...((this.showEdit && this.context._edit)
          ? [ {
            // When archived the edit action opens a read-only "editor"
            label: this.context.archived ? 'apostrophe:view' : 'apostrophe:edit',
            action: 'edit'
          } ]
          : []),
        ...((this.showPreview && this.canPreview)
          ? [
            {
              label: 'apostrophe:preview',
              action: 'preview'
            }
          ]
          : []),
        ...((this.showDismissSubmission && this.canDismissSubmission)
          ? [
            {
              label: 'apostrophe:dismissSubmission',
              action: 'dismissSubmission'
            }
          ]
          : []),
        ...(this.showCopy && this.canCopy
          ? [
            {
              label: 'apostrophe:duplicate',
              action: 'copy'
            }
          ]
          : []),
        ...(this.canLocalize
          ? [
            {
              label: 'apostrophe:localize',
              action: 'localize'
            }
          ]
          : []),
        ...this.customMenusByContext,
        ...((this.showDiscardDraft && this.canDiscardDraft)
          ? [
            {
              label: this.context.lastPublishedAt ? 'apostrophe:discardDraft' : 'apostrophe:deleteDraft',
              action: 'discardDraft',
              modifiers: [ 'danger' ]
            }
          ]
          : []),
        ...(this.showArchive && this.canArchive
          ? [
            {
              label: 'apostrophe:archive',
              action: 'archive',
              modifiers: [ 'danger' ]
            }
          ]
          : []),
        ...(this.canUnpublish
          ? [
            {
              label: 'apostrophe:unpublish',
              action: 'unpublish',
              modifiers: [ 'danger' ]
            }
          ]
          : []),
        ...(this.showRestore && this.canRestore
          ? [
            {
              label: 'apostrophe:restore',
              action: 'restore'
            }
          ]
          : [])
      ];

      return menu;
    },
    customMenusByContext() {
      if (!this.canEdit) {
        return [];
      }

      const menus = this.customOperationsByContext
        .map(op => ({
          label: op.label,
          action: op.action,
          modifiers: op.modifiers || []
        }));
      menus.sort((a, b) => a.modifiers.length - b.modifiers.length);
      return menus;
    },
    customOperationsByContext() {
      return this.customOperations.filter(({
        manuallyPublished, hasUrl, conditions, context, if: ifProps, moduleIf
      }) => {
        if (typeof manuallyPublished === 'boolean' && manuallyPublished !== this.manuallyPublished) {
          return false;
        }

        if (typeof hasUrl === 'boolean' && hasUrl !== this.hasUrl) {
          return false;
        }

        if (conditions) {
          const notAllowed = conditions.some((action) => !this[action]);

          if (notAllowed) {
            return false;
          }
        }

        ifProps = ifProps || {};
        moduleIf = moduleIf || {};
        const canSeeOperation = checkIfConditions(this.doc, ifProps) &&
            checkIfConditions(this.moduleOptions, moduleIf);

        if (!canSeeOperation) {
          return false;
        }

        return context === 'update' && this.isUpdateOperation;
      });
    },
    moduleName() {
      if (apos.modules[this.context.type].action === apos.modules['@apostrophecms/page'].action) {
        return '@apostrophecms/page';
      }
      return this.context.type;
    },
    moduleOptions() {
      return apos.modules[this.moduleName];
    },
    isUpdateOperation() {
      return !!this.context._id;
    },
    hasUrl() {
      return !!this.context._url;
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
      return this.canEdit &&
        this.context.submitted &&
        (this.canPublish || (this.context.submitted.byId === apos.login.user._id));
    },
    canDiscardDraft() {
      if (!this.manuallyPublished) {
        return false;
      }
      if (!this.context._id) {
        return false;
      }
      if (
        !this.context.lastPublishedAt &&
        !this.canDeleteDraft &&
        !this.context._delete
      ) {
        return false;
      }
      if (
        this.context.lastPublishedAt &&
        (!this.context.modified || !this.context._edit)
      ) {
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
      return this.moduleOptions.canLocalize &&
        this.context._id;
    },
    canArchive() {
      const publishable = Boolean(this.canPublish && this.context.lastPublishedAt) ||
        !this.manuallyPublished;
      return (
        this.context._delete &&
        this.context._id &&
        !this.moduleOptions.singleton &&
        !this.context.archived &&
        !this.context.parked &&
        publishable
      );
    },
    canUnpublish() {
      return (
        this.canEdit &&
        !this.context.parked &&
        this.moduleOptions.canPublish &&
        !this.moduleOptions.singleton &&
        this.context.lastPublishedAt &&
        this.manuallyPublished
      );
    },
    canCopy() {
      return this.moduleOptions.canCreate &&
        this.canEdit &&
        this.moduleOptions.canEdit &&
        !this.moduleOptions.singleton &&
        this.context._id;
    },
    canRestore() {
      return (
        this.canEdit &&
        this.context._id &&
        this.context.archived &&
        ((!this.manuallyPublished && this.canPublish) || this.manuallyPublished)
      );
    },
    canPreview() {
      return this.hasUrl &&
        !this.context.archived;
    },
    canShareDraft() {
      return this.canEdit &&
        !this.context.archived;
    },
    manuallyPublished() {
      return this.moduleOptions.localized && !this.autopublish;
    },
    autopublish() {
      return this.context._aposAutopublish ?? this.moduleOptions.autopublish;
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
      let schema = (apos.modules[this.context.type].schema || [])
        .filter(field => apos.schema.components.fields[field.type]);
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
    apos.bus.$on('command-menu-admin-bar-discard-draft', this.customDiscardDraft);
  },
  unmounted() {
    apos.bus.$off('content-changed', this.onContentChanged);
    apos.bus.$off('command-menu-admin-bar-discard-draft', this.customDiscardDraft);
  },
  methods: {
    customDiscardDraft() {
      if (this.showDiscardDraft && this.canDiscardDraft) {
        this.menuHandler({ action: 'discardDraft' });
      }
    },
    async onContentChanged({ doc, docIds }) {
      if (doc && (doc._id === this.context._id)) {
        this.context = doc;
      } else if (docIds && docIds.includes(this.context._id)) {
        try {
          this.context = await apos.http.get(`${this.moduleOptions.action}/${this.context._id}`, {
            busy: true
          });
        } catch (error) {
          // If not found it is likely that there was an archiving or restoring
          // batch operation.
          if (error.name !== 'notfound') {
            // eslint-disable-next-line no-console
            console.error(error);
          }
        }
      }
    },
    menuHandler(item) {
      const operation = this.customOperations.find(op => op.action === item.action);
      if (operation) {
        this.customAction(this.context, operation);
        return;
      }

      this[item.action](this.context);
    },
    async edit(doc) {
      await apos.modal.execute(
        doc._aposEditorModal || this.moduleOptions.components.editorModal,
        {
          moduleName: this.moduleName,
          docId: doc._id,
          type: doc.type
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

      await apos.modal.execute(
        doc._aposEditorModal || this.moduleOptions.components.editorModal,
        {
          moduleName: this.moduleName,
          copyOfId: doc._id,
          // Passed for bc
          copyOf: {
            ...this.current || doc,
            _id: doc._id
          },
          type: doc.type
        });

    },
    async customAction(doc, operation) {
      if (operation.replaces) {
        const confirm = await apos.confirm({
          heading: 'apostrophe:replaceHeadingPrompt',
          description: this.$t('apostrophe:replaceDescPrompt'),
          affirmativeLabel: 'apostrophe:replace',
          icon: false
        });
        if (!confirm) {
          return;
        }
        this.$emit('close', doc);
      }
      const props = {
        moduleName: operation.moduleName || this.moduleName,
        moduleLabels: this.moduleLabels,
        // For backwards compatibility
        doc,
        ...docProps(doc),
        ...operation.props
      };
      if (operation.type === 'event') {
        apos.bus.$emit(operation.action, props);
        return;
      }
      await apos.modal.execute(operation.modal, props);
      function docProps(doc) {
        return Object.fromEntries(
          Object.entries(operation.docProps || {}).map(([ key, value ]) => {
            return [ key, doc[value] ];
          })
        );
      }
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
