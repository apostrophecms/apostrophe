<template>
  <AposModal
    class="apos-doc-editor"
    :modal="modal"
    :modal-title="modalTitle"
    :modal-data="modalData"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:cancel"
        :attrs="{'data-apos-focus-priority': isPriorityButton('cancel')}"
        @click="confirmAndCancel"
      />
    </template>
    <template v-if="showLocalePicker" #localeDisplay>
      <AposDocLocalePicker
        :locale="modalData.locale"
        :doc-id="referenceDocId"
        :module-options="moduleOptions"
        :is-modified="isModified"
        @switch-locale="switchLocale"
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
        :can-delete-draft="moduleOptions.canDeleteDraft"
        :locale-switched="localeSwitched"
        @close="close"
      />
      <AposButton
        v-if="restoreOnly"
        type="primary"
        :label="saveLabel"
        :disabled="saveDisabled"
        :tooltip="errorTooltip"
        :attrs="{'data-apos-focus-priority': isPriorityButton('save')}"
        @click="onRestore"
      />
      <AposButtonSplit
        v-else-if="saveMenu"
        :menu="saveMenu"
        menu-label="Select Save Method"
        :disabled="saveDisabled"
        :tooltip="errorTooltip"
        :selected="savePreference"
        :attrs="{'data-apos-focus-priority': isPriorityButton('splitSave')}"
        @click="saveHandler($event)"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <AposModalTabs
          v-if="tabs.length"
          :key="tabKey"
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
              :ref="tab.name"
              :changed="changed"
              :schema="groups[tab.name].schema"
              :current-fields="groups[tab.name].fields"
              :trigger-validation="triggerValidation"
              :utility-rail="false"
              :following-values="followingValues('other')"
              :conditional-fields="conditionalFields"
              :doc-id="currentId"
              :model-value="docFields"
              :meta="docMeta"
              :server-errors="serverErrors"
              :generation="generation"
              @update:model-value="updateDocFields"
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
            ref="utilitySchema"
            :schema="groups['utility'].schema"
            :changed="changed"
            :current-fields="groups['utility'].fields"
            :trigger-validation="triggerValidation"
            :utility-rail="true"
            :following-values="followingUtils"
            :conditional-fields="conditionalFields"
            :doc-id="currentId"
            :model-value="docFields"
            :meta="docMeta"
            :modifiers="['small', 'inverted']"
            :server-errors="serverErrors"
            :generation="generation"
            @update:model-value="updateDocFields"
            @validate="triggerValidate"
          />
        </div>
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script>
import { klona } from 'klona';
import { mapActions } from 'pinia';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposModalTabsMixin from 'Modules/@apostrophecms/modal/mixins/AposModalTabsMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposArchiveMixin from 'Modules/@apostrophecms/ui/mixins/AposArchiveMixin';
import AposAdvisoryLockMixin from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';
import AposDocErrorsMixin from 'Modules/@apostrophecms/modal/mixins/AposDocErrorsMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

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
      originalDoc: this.originalDoc,
      liveOriginalDoc: this.docFields
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
    },
    modalData: {
      type: Object,
      required: true
    }
  },
  emits: [ 'modal-result' ],
  data() {
    return {
      docType: this.moduleName,
      docReady: false,
      fieldErrors: {},
      modal: {
        active: false,
        triggerFocusRefresh: 0,
        type: 'overlay',
        showModal: false,
        componentType: 'editorModal'
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
      generation: 0,
      localeSwitched: this.modalData.hasContextLocale,
      referenceDocId: this.docId,
      currentId: this.docId
    };
  },
  computed: {
    getOnePath() {
      return `${this.moduleAction}/${this.currentId}`;
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
    canCreate() {
      return this.original &&
        !this.original._id &&
        this.moduleOptions.canCreate;
    },
    saveDisabled() {
      if (!this.canCreate && !this.canEdit) {
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
      if (!this.currentId) {
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
      return {
        key: this.currentId ? 'apostrophe:editType' : 'apostrophe:newDocType',
        type: this.$t(this.moduleOptions.label)
      };
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
    },
    showLocalePicker() {
      return Object.keys(window.apos.i18n.locales).length > 1 &&
        this.moduleOptions.localized !== false &&
        !this.modalData.hasContextLocale;
    }
  },
  watch: {
    'docFields.data.type': {
      handler(newVal) {
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
    await this.evaluateExternalConditions();
    // After computed properties become available
    this.saveMenu = this.computeSaveMenu();
    this.cancelDescription = {
      key: 'apostrophe:discardChangesToDocTypePrompt',
      type: this.$t(this.moduleOptions.label)
    };
    if (this.docId) {
      await this.instantiateExistingDoc();
    } else if (this.copyOfId) {
      this.instantiateCopiedDoc();
    } else {
      await this.$nextTick();
      await this.instantiateNewDoc();
    }
    apos.bus.$on('content-changed', this.onContentChanged);
  },
  unmounted() {
    apos.bus.$off('content-changed', this.onContentChanged);
  },
  methods: {
    ...mapActions(useModalStore, [ 'updateModalData' ]),
    async instantiateExistingDoc() {
      await this.loadDoc();
      this.evaluateConditions();
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
    },
    async instantiateCopiedDoc() {
      this.evaluateConditions();

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
    },
    async instantiateNewDoc () {
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
      this.evaluateConditions();
    },
    async saveHandler(action, saveOpts = {}) {
      this.triggerValidation = true;
      await this.$nextTick();
      if (this.savePreference !== action) {
        this.setSavePreference(action);
      }
      if (!this.errorCount) {
        return this[action](saveOpts);
      } else {
        this.triggerValidation = false;
        await apos.notify('apostrophe:resolveErrorsBeforeSaving', {
          type: 'warning',
          icon: 'alert-circle-icon',
          dismiss: true
        });
        this.focusNextError();
      }
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
        if (canEdit && !await this.lock(this.getOnePath, this.currentId)) {
          this.lockNotAvailable();
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
          this.docFields.data = docData;
          // TODO: Is this block even useful since published is fetched after loadDoc?
          if (this.published) {
            this.changed = detectDocChange(
              this.schema,
              this.original,
              this.published,
              { differences: true }
            );
          }
          this.docReady = true;
          this.prepErrors();
        }
      }
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
    async onSave({
      navigate = false, keepOpen = false, andPublish = null
    } = {}) {
      if (this.canPublish || !this.manuallyPublished) {
        return this.save({
          andPublish: andPublish ?? this.manuallyPublished,
          navigate,
          keepOpen
        });
      } else {
        return this.save({
          andPublish: false,
          andSubmit: true,
          navigate,
          keepOpen
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
    async onSaveDraft({ navigate = false } = {}) {
      await this.save({
        andPublish: false,
        draft: true,
        navigate
      });
    },
    async save({
      andPublish = false,
      navigate = false,
      andSubmit = false,
      draft = false,
      keepOpen = false
    }) {
      const body = this.getRequestBody({ update: Boolean(this.currentId) });
      const route = this.currentId
        ? `${this.moduleAction}/${this.currentId}`
        : this.moduleAction;
      const requestMethod = this.currentId ? apos.http.put : apos.http.post;

      if (this.currentId) {
        this.addLockToRequest(body);
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
          action: (requestMethod === apos.http.put) ? 'update' : 'insert',
          localeSwitched: this.localeSwitched
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
      if (!keepOpen) {
        this.$emit('modal-result', doc);
        this.modal.showModal = false;
      }
      if (draft) {
        await apos.notify('apostrophe:draftSaved', {
          type: 'success',
          dismiss: true,
          icon: 'file-document-icon'
        });
      }
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
      return doc;
    },
    async getNewInstance() {
      try {
        const body = this.getRequestBody({ newInstance: true });
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

      this.evaluateConditions();
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
      const isNew = !this.currentId;
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
    },
    async switchLocale({
      locale, localized, save
    }) {
      if (save) {
        const saved = await this.saveHandler('onSave', {
          keepOpen: true,
          andPublish: false
        });
        if (this.errorCount > 0) {
          return;
        }
        if (!this.referenceDocId && saved) {
          this.referenceDocId = saved._id;
        }
      }
      this.updateModalData(this.modalData.id, { locale });
      this.localeSwitched = locale !== apos.i18n.locale;
      this.published = null;
      if (localized) {
        this.currentId = localized._id;
        await this.instantiateExistingDoc();
      } else {
        this.currentId = '';
        this.docType = this.moduleName;
        await this.instantiateNewDoc();
      }
    },
    getRequestBody({ newInstance = false, update = false }) {
      const body = newInstance
        ? { _newInstance: true }
        : this.docFields.data;

      if (update) {
        return body;
      }

      if (this.moduleName === '@apostrophecms/page') {
        // New pages are always born as drafts
        // When in another locale we don't know if the current page exist
        body._targetId = this.localeSwitched
          ? '_home'
          : apos.page.page._id.replace(':published', ':draft');
        body._position = 'lastChild';
      }

      if (!newInstance) {
        if (this.copyOfId) {
          body._copyingId = this.copyOfId;
        } else if (this.localeSwitched && this.referenceDocId) {
          body._createId = this.referenceDocId.split(':')[0];
        }
      }

      return body;
    },
    isPriorityButton(name) {
      let priority;

      if (this.restoreOnly) {
        priority = 'save';
      }

      if (this.saveMenu) {
        priority = 'splitSave';
      }

      if (this.saveDisabled) {
        priority = 'cancel';
      }

      return name === priority ? true : null;
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
