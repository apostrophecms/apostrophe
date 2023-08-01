<template>
  <AposModal
    class="apos-doc-editor" :modal="modal"
    :modal-title="modalTitle"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="confirmAndCancel" @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default" label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <AposDocContextMenu
        v-if="original"
        :disabled="(errorCount > 0) || restoreOnly"
        :doc="original"
        :current="docFields.data"
        :published="published"
        :show-edit="false"
        @close="close"
      />
      <AposButton
        v-if="restoreOnly"
        type="primary" :label="saveLabel"
        :disabled="saveDisabled"
        @click="onRestore"
        :tooltip="errorTooltip"
      />
      <AposButtonSplit
        v-else-if="saveMenu"
        :menu="saveMenu"
        menu-label="Select Save Method"
        :disabled="saveDisabled"
        :tooltip="errorTooltip"
        :selected="savePreference"
        @click="saveHandler($event)"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <AposModalTabs
          :key="tabKey"
          v-if="tabs.length"
          :current="currentTab"
          :tabs="tabs"
          :errors="fieldErrors"
          @select-tab="switchPane"
        />
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div v-if="docReady" class="apos-doc-editor__body">
            <AposSchema
              v-for="tab in tabs"
              v-show="tab.name === currentTab"
              :key="tab.name"
              :changed="changed"
              :schema="groups[tab.name].schema"
              :current-fields="groups[tab.name].fields"
              :trigger-validation="triggerValidation"
              :utility-rail="false"
              :following-values="followingValues('other')"
              :conditional-fields="conditionalFields('other')"
              :doc-id="docId"
              :value="docFields"
              :server-errors="serverErrors"
              :ref="tab.name"
              :generation="generation"
              @input="updateDocFields"
              @validate="triggerValidate"
              @update-doc-data="onUpdateDocFields"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
    <template #rightRail>
      <AposModalRail type="right">
        <div class="apos-doc-editor__utility">
          <AposSchema
            v-if="docReady"
            :schema="groups['utility'].schema"
            :changed="changed"
            :current-fields="groups['utility'].fields"
            :trigger-validation="triggerValidation"
            :utility-rail="true"
            :following-values="followingUtils"
            :conditional-fields="conditionalFields('utility')"
            :doc-id="docId"
            :value="docFields"
            @input="updateDocFields"
            @validate="triggerValidate"
            :modifiers="['small', 'inverted']"
            ref="utilitySchema"
            :server-errors="serverErrors"
            :generation="generation"
          />
        </div>
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script>
import { klona } from 'klona';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposModalTabsMixin from 'Modules/@apostrophecms/modal/mixins/AposModalTabsMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposArchiveMixin from 'Modules/@apostrophecms/ui/mixins/AposArchiveMixin';
import AposAdvisoryLockMixin from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';
import AposDocErrorsMixin from 'Modules/@apostrophecms/modal/mixins/AposDocErrorsMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';

export default {
  name: 'AposDocEditor',
  mixins: [
    AposModalTabsMixin,
    AposModifiedMixin,
    AposEditorMixin,
    AposPublishMixin,
    AposAdvisoryLockMixin,
    AposArchiveMixin,
    AposDocErrorsMixin
  ],
  provide () {
    return {
      originalDoc: this.originalDoc
    };
  },
  props: {
    moduleName: {
      type: String,
      required: true
    },
    docId: {
      type: String,
      default: null
    },
    type: {
      type: String,
      default: null
    },
    copyOfId: {
      type: String,
      default: null
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    return {
      docType: this.moduleName,
      docReady: false,
      fieldErrors: {},
      modal: {
        active: false,
        triggerFocusRefresh: 0,
        type: 'overlay',
        showModal: false
      },
      triggerValidation: false,
      original: null,
      originalDoc: {
        ref: null
      },
      published: null,
      readOnly: false,
      restoreOnly: false,
      saveMenu: null,
      generation: 0
    };
  },
  computed: {
    getOnePath() {
      return `${this.moduleAction}/${this.docId}`;
    },
    followingUtils() {
      return this.followingValues('utility');
    },
    canEdit() {
      if (this.original && this.original._id) {
        return this.original._edit || this.moduleOptions.canEdit;
      }

      return this.moduleOptions.canEdit;
    },
    canPublish() {
      if (this.original && this.original._id) {
        return this.original._publish || this.moduleOptions.canPublish;
      }

      return this.moduleOptions.canPublish;
    },
    saveDisabled() {
      if (!this.canEdit) {
        return true;
      }
      if (this.restoreOnly) {
        // Can always restore if it's a read-only view of the archive
        return false;
      }
      if (this.errorCount) {
        // Always block save if there are errors in the modal
        return true;
      }
      if (!this.docId) {
        // If it is new you can always save it, even just to insert it with
        // defaults is sometimes useful
        return false;
      }
      if (this.isModified) {
        // If it has been modified in the modal you can always save it
        return false;
      }
      // If it is not manually published this is a simple "save" operation,
      // don't allow it since the doc is unmodified in the modal
      if (!this.manuallyPublished) {
        return true;
      }
      if (this.canPublish) {
        // Primary button is "publish". If it is previously published and the
        // draft is not modified since then, don't allow it
        return this.published && !this.isModifiedFromPublished;
      }
      if (!this.original) {
        // There is an id but no original — that means we're still loading the
        // original — block until ready
        return true;
      }
      // Contributor case. Button is "submit"
      // If previously published and not modified since, we can't submit
      if (this.published && !this.isModifiedFromPublished) {
        return true;
      }
      if (!this.original.submitted) {
        // Allow initial submission
        return false;
      }
      // Block re-submission of an unmodified draft (we already checked modified)
      return true;
    },
    moduleOptions() {
      return window.apos.modules[this.docType] || {};
    },
    moduleAction () {
      // Use moduleName for the action since all page types use the
      // `@apostrophecms/page` module action.
      return (window.apos.modules[this.moduleName] || {}).action;
    },
    utilityFields() {
      let fields = [];
      if (this.groups.utility && this.groups.utility.fields) {
        fields = this.groups.utility.fields;
      }
      return this.filterOutParkedFields(fields);
    },
    modalTitle() {
      if (this.docId) {
        return {
          key: 'apostrophe:editType',
          type: this.$t(this.moduleOptions.label)
        };
      } else {
        return {
          key: 'apostrophe:newDocType',
          type: this.$t(this.moduleOptions.label)
        };
      }
    },
    saveLabel() {
      if (this.restoreOnly) {
        return 'apostrophe:restore';
      } else if (this.manuallyPublished) {
        if (this.canPublish) {
          if (this.copyOfId) {
            return 'apostrophe:publish';
          } else if (this.original && this.original.lastPublishedAt) {
            return 'apostrophe:update';
          } else {
            return 'apostrophe:publish';
          }
        } else {
          if (this.copyOfId) {
            return 'apostrophe:submit';
          } else if (this.original && this.original.lastPublishedAt) {
            return 'apostrophe:submitUpdate';
          } else {
            return 'apostrophe:submit';
          }
        }
      } else {
        return 'apostrophe:save';
      }
    },
    isModified() {
      if (!this.original) {
        return false;
      }
      return detectDocChange(this.schema, this.original, this.docFields.data);
    },
    isModifiedFromPublished() {
      if (!this.published) {
        return false;
      }
      return detectDocChange(this.schema, this.published, this.docFields.data);
    },
    savePreferenceName() {
      return `apos-${this.moduleName}-save-pref`;
    },
    savePreference() {
      let pref = window.localStorage.getItem(this.savePreferenceName);
      if (typeof pref !== 'string') {
        pref = null;
      }
      return pref;
    }
  },
  watch: {
    'docFields.data.type': {
      handler(newVal, oldVal) {
        if (this.moduleName !== '@apostrophecms/page') {
          return;
        }
        if (this.docType !== newVal) {
          this.docType = newVal;
          this.prepErrors();
        }
      }
    },
    // comes in late for pages
    manuallyPublished() {
      this.saveMenu = this.computeSaveMenu();
    },
    original(newVal) {
      this.originalDoc.ref = newVal;
      this.saveMenu = this.computeSaveMenu();
    }
  },
  async mounted() {
    this.modal.active = true;
    // After computed properties become available
    this.saveMenu = this.computeSaveMenu();
    this.cancelDescription = {
      key: 'apostrophe:discardChangesToDocTypePrompt',
      type: this.$t(this.moduleOptions.label)
    };
    if (this.docId) {
      await this.loadDoc();
      try {
        if (this.manuallyPublished) {
          this.published = await apos.http.get(this.getOnePath, {
            busy: true,
            qs: {
              archived: 'any',
              aposMode: 'published'
            }
          });
        }
      } catch (e) {
        if (e.name !== 'notfound') {
          console.error(e);
          await apos.notify('apostrophe:fetchPublishedVersionFailed', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
        }
      }
      this.modal.triggerFocusRefresh++;
    } else if (this.copyOfId) {
      // Because the page or piece manager might give us just a projected,
      // minimum number of properties otherwise, and because we need to
      // make sure we use our preferred module to fetch the content
      const newInstance = await apos.http.get(`${this.moduleOptions.action}/${this.copyOfId}`, {
        busy: true
      });
      delete newInstance.parked;
      newInstance.title = `Copy of ${newInstance.title}`;
      if (newInstance.slug.startsWith('/')) {
        const matches = newInstance.slug.match(/\/([^/]+)$/);
        if (matches) {
          newInstance.slug = `${apos.page.page.slug}/copy-of-${matches[1]}`;
        } else {
          newInstance.slug = '/copy-of-home-page';
        }
      } else {
        newInstance.slug = newInstance.slug.replace(/([^/]+)$/, 'copy-of-$1');
      }
      delete newInstance._id;
      delete newInstance._url;

      this.original = newInstance;

      if (newInstance && newInstance.type !== this.docType) {
        this.docType = newInstance.type;
      }
      this.docFields.data = newInstance;
      this.prepErrors();
      this.docReady = true;
      this.modal.triggerFocusRefresh++;
    } else {
      this.$nextTick(async () => {
        await this.loadNewInstance();
        this.modal.triggerFocusRefresh++;
      });
    }
    apos.bus.$on('content-changed', this.onContentChanged);
  },
  destroyed() {
    apos.bus.$off('content-changed', this.onContentChanged);
  },
  methods: {
    async saveHandler(action) {
      this.triggerValidation = true;
      this.$nextTick(async () => {
        if (this.savePreference !== action) {
          this.setSavePreference(action);
        }
        if (!this.errorCount) {
          this[action]();
        } else {
          this.triggerValidation = false;
          await apos.notify('apostrophe:resolveErrorsBeforeSaving', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
          this.focusNextError();
        }
      });
    },
    async loadDoc() {
      let docData;
      try {
        docData = await apos.http.get(this.getOnePath, {
          busy: true,
          qs: {
            archived: 'any'
          },
          draft: true
        });

        if (docData.archived) {
          this.restoreOnly = true;
        } else {
          this.restoreOnly = false;
        }
        const canEdit = docData._edit || this.moduleOptions.canEdit;
        this.readOnly = canEdit === false;
        if (canEdit && !await this.lock(this.getOnePath, this.docId)) {
          await this.lockNotAvailable();
          return;
        }
      } catch {
        await apos.notify('apostrophe:loadDocFailed', {
          type: 'warning',
          icon: 'alert-circle-icon',
          dismiss: true
        });
        await this.confirmAndCancel();
      } finally {
        if (docData) {
          if (docData.type !== this.docType) {
            this.docType = docData.type;
          }
          this.original = klona(docData);
          this.docFields.data = {
            ...this.getDefault(),
            ...docData
          };
          if (this.published) {
            this.changed = detectDocChange(this.schema, this.original, this.published, { differences: true });
          }
          this.docReady = true;
          this.prepErrors();
        }
      }
    },
    getDefault() {
      const doc = {};
      this.schema.forEach(field => {
        if (field.name.startsWith('_')) {
          return;
        }
        // Using `hasOwn` here, not simply checking if `field.def` is truthy
        // so that `false`, `null`, `''` or `0` are taken into account:
        const hasDefaultValue = Object.hasOwn(field, 'def');
        doc[field.name] = hasDefaultValue
          ? klona(field.def)
          : null;
      });
      return doc;
    },
    async preview() {
      if (!await this.confirmAndCancel()) {
        return;
      }
      window.location = this.original._url;
    },
    // Implementing a method expected by the advisory lock mixin
    lockNotAvailable() {
      this.modal.showModal = false;
    },
    async onRestore() {
      await this.restore(this.original);
      await this.loadDoc();
    },
    async onSave({ navigate = false } = {}) {
      if (this.canPublish || !this.manuallyPublished) {
        await this.save({
          andPublish: this.manuallyPublished,
          navigate
        });
      } else {
        await this.save({
          andPublish: false,
          andSubmit: true,
          navigate
        });
      }
    },
    async onSaveAndView() {
      await this.onSave({ navigate: true });
    },
    async onSaveAndNew() {
      await this.onSave();
      this.startNew();
    },
    async onSaveDraftAndNew() {
      await this.onSaveDraft();
      this.startNew();
    },
    async onSaveDraftAndView() {
      await this.onSaveDraft({ navigate: true });
    },
    async onSaveDraft(navigate = false) {
      await this.save({
        andPublish: false,
        navigate
      });
      await apos.notify('apostrophe:draftSaved', {
        type: 'success',
        dismiss: true,
        icon: 'file-document-icon'
      });
    },
    // If andPublish is true, publish after saving.
    async save({
      andPublish = false,
      navigate = false,
      andSubmit = false
    }) {
      const body = this.docFields.data;
      let route;
      let requestMethod;
      if (this.docId) {
        route = `${this.moduleAction}/${this.docId}`;
        requestMethod = apos.http.put;
        this.addLockToRequest(body);
      } else {
        route = this.moduleAction;
        requestMethod = apos.http.post;

        if (this.moduleName === '@apostrophecms/page') {
          // New pages are always born as drafts
          body._targetId = apos.page.page._id.replace(':published', ':draft');
          body._position = 'lastChild';
        }
        if (this.copyOfId) {
          body._copyingId = this.copyOfId;
        }
      }
      let doc;
      try {
        await this.postprocess();
        doc = await requestMethod(route, {
          busy: true,
          body,
          draft: true
        });
        if (andSubmit) {
          await this.submitDraft(doc);
        } else if (andPublish) {
          await this.publish(doc);
        }
        apos.bus.$emit('content-changed', {
          doc,
          action: (requestMethod === apos.http.put) ? 'update' : 'insert'
        });
      } catch (e) {
        if (this.isLockedError(e)) {
          await this.showLockedError(e);
          this.modal.showModal = false;
          return;
        } else {
          await this.handleSaveError(e, {
            fallback: 'An error occurred saving the document.'
          });
          return;
        }
      }
      this.$emit('modal-result', doc);
      this.modal.showModal = false;
      if (navigate) {
        if (doc._url) {
          window.location = doc._url;
        } else {
          await apos.notify(andPublish ? 'apostrophe:documentPublishedNoPreview' : 'apostrophe:draftSavedNoPreview', {
            type: 'warning',
            icon: 'alert-circle-icon'
          });
        }
      }
    },
    async getNewInstance() {
      try {
        const body = {
          _newInstance: true
        };

        if (this.moduleName === '@apostrophecms/page') {
          // New pages are always born as drafts
          body._targetId = apos.page.page._id.replace(':published', ':draft');
          body._position = 'lastChild';
        }
        const newDoc = await apos.http.post(this.moduleAction, {
          body,
          draft: true
        });
        return newDoc;
      } catch (error) {
        await apos.notify('apostrophe:errorCreatingNewContent', {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });

        console.error(`Error while creating new, empty content. Review your configuration for ${this.docType} (including \`type\` options in \`@apostrophecms/page\` if it's a page type).`);

        this.modal.showModal = false;
      }
    },
    async loadNewInstance () {
      this.docReady = false;
      const newInstance = await this.getNewInstance();
      this.original = newInstance;
      if (newInstance && newInstance.type !== this.docType) {
        this.docType = newInstance.type;
      }
      this.docFields.data = newInstance;
      const slugField = this.schema.find(field => field.name === 'slug');
      if (slugField) {
        // As a matter of UI implementation, we know our slug input field will
        // automatically change the empty string to the prefix, so to
        // prevent a false positive for this being considered a change,
        // do it earlier when creating a new doc.
        this.original.slug = this.original.slug || slugField.def || slugField.prefix || '';
      }
      this.prepErrors();
      this.docReady = true;
    },
    startNew() {
      this.modal.showModal = false;
      apos.bus.$emit('admin-menu-click', {
        itemName: `${this.moduleName}:editor`
      });
    },
    onUpdateDocFields(value) {
      this.updateDocFields(value);
      this.generation++;
    },
    updateDocFields(value) {
      this.updateFieldErrors(value.fieldState);
      this.docFields.data = {
        ...this.docFields.data,
        ...value.data
      };
    },
    getAposSchema(field) {
      if (field.group.name === 'utility') {
        return this.$refs.utilitySchema;
      } else {
        return this.$refs[field.group.name][0];
      }
    },
    filterOutParkedFields(fields) {
      return fields.filter(fieldName => {
        return !((this.original && this.original.parked) || []).includes(fieldName);
      });
    },
    computeSaveMenu () {
      // Powers the dropdown Save menu
      // all actions expected to be methods of this component
      // Needs to be manually computed because this.saveLabel doesn't stay reactive when part of an object
      const typeLabel = this.$t(this.moduleOptions
        ? this.moduleOptions.label
        : 'document');
      const isNew = !this.docId;
      // this.original takes a moment to populate, don't crash
      const canPreview = this.original && (this.original._id ? this.original._url : this.original._previewable);
      const canNew = this.moduleOptions.showCreate;
      const isSingleton = this.moduleOptions.singleton;
      const description = {
        saveLabel: this.$t(this.saveLabel),
        typeLabel
      };
      const menu = [
        {
          label: this.saveLabel,
          action: 'onSave',
          description: {
            ...description,
            key: isSingleton ? 'apostrophe:updateSingleton'
              : (isNew ? 'apostrophe:insertAndReturn' : 'apostrophe:updateAndReturn')
          },
          def: true
        }
      ];
      if (canPreview) {
        menu.push({
          label: {
            key: 'apostrophe:takeActionAndView',
            saveLabel: this.$t(this.saveLabel)
          },
          action: 'onSaveAndView',
          description: {
            ...description,
            key: isNew ? 'apostrophe:insertAndRedirect' : 'apostrophe:updateAndRedirect'
          }
        });
      }
      if (canNew) {
        menu.push({
          label: {
            key: 'apostrophe:takeActionAndCreateNew',
            saveLabel: this.$t(this.saveLabel),
            typeLabel
          },
          action: 'onSaveAndNew',
          description: {
            ...description,
            key: isNew ? 'apostrophe:insertAndNew' : 'apostrophe:updateAndNew'
          }
        });
      }
      if (this.manuallyPublished) {
        menu.push({
          label: 'apostrophe:saveDraft',
          action: 'onSaveDraft',
          description: 'apostrophe:saveDraftDescription'
        });
      }
      if (this.manuallyPublished && canPreview) {
        menu.push({
          label: {
            key: 'apostrophe:saveDraftAndPreview',
            typeLabel
          },
          action: 'onSaveDraftAndView',
          description: {
            key: 'apostrophe:saveDraftAndPreviewDescription',
            typeLabel
          }
        });
      };
      if (this.manuallyPublished && canNew) {
        menu.push({
          label: 'apostrophe:saveDraftAndCreateNew',
          action: 'onSaveDraftAndNew',
          description: {
            key: 'apostrophe:saveDraftAndCreateNewDescription',
            typeLabel
          }
        });
      }
      return menu;
    },
    setSavePreference(pref) {
      window.localStorage.setItem(this.savePreferenceName, pref);
    },
    onContentChanged(e) {
      if (!e.doc || this.original?._id !== e.doc._id) {
        return;
      }
      if (e.doc.type !== this.docType) {
        this.docType = e.doc.type;
      }
      this.docFields.data = e.doc;
      this.generation++;

      if (
        e.action === 'archive' ||
        e.action === 'unpublish' ||
        e.action === 'delete' ||
        e.action === 'revert-draft-to-published'
      ) {
        this.modal.showModal = false;
      }
    },
    close() {
      this.modal.showModal = false;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-doc-editor__body {
    padding-top: $spacing-double;
  }

  .apos-doc-editor__utility {
    padding: $spacing-quadruple $spacing-base;
    @include media-up(lap) {
      padding: $spacing-quadruple $spacing-double;
    }
  }
</style>
