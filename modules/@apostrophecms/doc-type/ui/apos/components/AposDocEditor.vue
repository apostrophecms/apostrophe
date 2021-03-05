<template>
  <AposModal
    class="apos-doc-editor" :modal="modal"
    :modal-title="modalTitle"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="confirmAndCancel" @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default" label="Cancel"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <!-- TODO: these conditions will need adjusting when we get to the
        "Duplicate" feature, but without them we would have an empty
        menu in many cases because all of the operations
        depend on modification from published -->
      <AposDocMoreMenu
        v-if="moduleOptions.localized && !moduleOptions.autopublish && (isModified || isModifiedFromPublished || canDiscardDraft)"
        :is-modified="isModified"
        :is-modified-from-published="isModifiedFromPublished"
        :can-discard-draft="canDiscardDraft"
        :is-published="!!published"
        :options="{ saveDraft: true }"
        @saveDraft="saveDraft"
        @discardDraft="onDiscardDraft"
      />
      <AposButton
        type="primary" :label="saveLabel"
        :modifiers="buttonModifiers"
        @click="submit"
        :tooltip="tooltip"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <AposModalTabs
          :key="tabKey"
          v-if="tabs.length > 0"
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
              :schema="groups[tab.name].schema"
              :current-fields="groups[tab.name].fields"
              :trigger-validation="triggerValidation"
              :utility-rail="false"
              :following-values="followingValues('other')"
              :doc-id="docId"
              :value="docFields"
              @input="updateDocFields"
              @fieldStateChange="updateFieldState"
              :server-errors="serverErrors"
              :ref="tab.name"
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
            :current-fields="groups['utility'].fields"
            :trigger-validation="triggerValidation"
            :utility-rail="true"
            :following-values="followingUtils"
            :doc-id="docId"
            :value="docFields"
            @input="updateDocFields"
            @fieldStateChange="updateFieldState"
            :modifiers="['small', 'inverted']"
            ref="utilitySchema"
            :server-errors="serverErrors"
          />
        </div>
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script>
import AposModalModifiedMixin from 'Modules/@apostrophecms/modal/mixins/AposModalModifiedMixin';
import AposModalTabsMixin from 'Modules/@apostrophecms/modal/mixins/AposModalTabsMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposAdvisoryLockMixin from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import { klona } from 'klona';
import cuid from 'cuid';

export default {
  name: 'AposDocEditor',
  mixins: [
    AposModalTabsMixin,
    AposModalModifiedMixin,
    AposEditorMixin,
    AposPublishMixin,
    AposAdvisoryLockMixin
  ],
  props: {
    moduleName: {
      type: String,
      required: true
    },
    docId: {
      type: String,
      default: null
    },
    filterValues: {
      type: Object,
      default() {
        return {
          trash: false
        };
      }
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    return {
      tabKey: cuid(),
      docType: this.moduleName,
      docReady: false,
      fieldErrors: {},
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      triggerValidation: false,
      original: null,
      published: null,
      errorCount: 0
    };
  },
  computed: {
    tooltip() {
      // TODO I18N
      let msg;
      if (this.errorCount) {
        msg = `${this.errorCount} error${this.errorCount > 1 ? 's' : ''} remaining`;
      }
      return msg;
    },
    followingUtils() {
      return this.followingValues('utility');
    },
    buttonModifiers() {
      if (this.errorCount) {
        return [ 'disabled' ];
      } else {
        return [];
      }
    },
    moduleOptions() {
      return window.apos.modules[this.docType] || {};
    },
    moduleAction () {
      // Use moduleName for the action since all page types use the
      // `@apostrophecms/page` module action.
      return (window.apos.modules[this.moduleName] || {}).action;
    },
    schema() {
      return (this.moduleOptions.schema || []).filter(field => apos.schema.components.fields[field.type]);
    },
    groups() {
      const groupSet = {};

      this.schema.forEach(field => {
        if (field.group && !groupSet[field.group.name]) {
          groupSet[field.group.name] = {
            label: field.group.label,
            fields: [ field.name ],
            schema: [ field ]
          };
        } else if (field.group) {
          groupSet[field.group.name].fields.push(field.name);
          groupSet[field.group.name].schema.push(field);
        }
      });

      return groupSet;
    },
    utilityFields() {
      if (this.groups.utility && this.groups.utility.fields) {
        return this.groups.utility.fields;
      }
      return [];
    },
    tabs() {
      const tabs = [];
      for (const key in this.groups) {
        if (key !== 'utility') {
          tabs.push({
            name: key,
            label: this.groups[key].label
          });
        }
      };
      return tabs;
    },
    modalTitle() {
      return `Edit ${this.moduleOptions.label || ''}`;
    },
    manuallyPublished() {
      return this.moduleOptions.localized && !this.moduleOptions.autopublish;
    },
    saveLabel() {
      if (this.manuallyPublished) {
        if (this.original && this.original.lastPublishedAt) {
          return 'Publish Changes';
        } else {
          return 'Publish';
        }
      } else {
        return 'Save';
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
    canDiscardDraft() {
      return (this.docId && (!this.published)) || this.isModifiedFromPublished;
    }
  },
  watch: {
    'docFields.data': {
      deep: true,
      handler(newVal, oldVal) {
        if (this.moduleName !== '@apostrophecms/page' || this.splittingDoc) {
          return;
        }

        if (this.docType !== newVal.type) {
          this.docType = newVal.type;
          this.prepErrors();
        }
      }
    },

    tabs() {
      if ((!this.currentTab) || (!this.tabs.find(tab => tab.name === this.currentTab))) {
        this.currentTab = this.tabs[0].name;
      }
    }

  },
  async mounted() {
    this.modal.active = true;
    // After computed properties become available
    this.cancelDescription = `Do you want to discard changes to this ${this.moduleOptions.label.toLowerCase()}?`;
    if (this.docId) {
      let docData;
      const getOnePath = `${this.moduleAction}/${this.docId}`;
      try {
        if (!await this.lock(getOnePath, this.docId)) {
          await this.lockNotAvailable();
          return;
        }
        docData = await apos.http.get(getOnePath, {
          busy: true,
          qs: this.filterValues,
          draft: true
        });
      } catch {
        // TODO a nicer message here, but moduleLabels is undefined here
        await apos.notify('The requested document was not found.', {
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
          this.docReady = true;
          this.prepErrors();
        }
      }
      try {
        if (this.manuallyPublished) {
          this.published = await apos.http.get(getOnePath, {
            busy: true,
            qs: {
              ...this.filterValues,
              'apos-mode': 'published'
            }
          });
        }
      } catch (e) {
        if (e.name !== 'notfound') {
          console.error(e);
          // TODO a nicer message here, but moduleLabels is undefined here
          await apos.notify('An error occurred fetching the published version of the document.', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
        }
      }
    } else {
      this.$nextTick(() => {
        this.loadNewInstance();
      });
    }
  },
  methods: {
    updateFieldState(fieldState) {
      this.tabKey = cuid();
      for (const key in this.groups) {
        this.groups[key].fields.forEach(field => {
          if (fieldState[field]) {
            this.fieldErrors[key][field] = fieldState[field].error;
          }
        });
      }
      this.updateErrorCount();
    },
    updateErrorCount() {
      let count = 0;
      for (const key in this.fieldErrors) {
        for (const tabKey in this.fieldErrors[key]) {
          if (this.fieldErrors[key][tabKey]) {
            count++;
          }
        }
      }
      this.errorCount = count;
    },
    focusNextError() {
      let field;
      for (const key in this.fieldErrors) {
        for (const tabKey in this.fieldErrors[key]) {
          if (this.fieldErrors[key][tabKey] && !field) {
            field = this.schema.filter(item => {
              return item.name === tabKey;
            })[0];
            this.switchPane(field.group.name);
            this.getAposSchema(field).scrollFieldIntoView(field.name);
          }
        }
      }
    },
    prepErrors() {
      for (const name in this.groups) {
        this.fieldErrors[name] = {};
      }
    },
    markLockedAndScheduleRefresh() {
      this.locked = true;
      this.lockTimeout = setTimeout(this.refreshLock, 10000);
    },
    refreshLock() {
      this.lockRefreshing = (async () => {
        try {
          await apos.http.patch(`${this.moduleAction}/${this.docId}`, {
            body: {
              _advisoryLock: {
                htmlPageId: apos.adminBar.htmlPageId,
                lock: true
              }
            },
            draft: true
          });
          // Reset this each time to avoid various race conditions
          this.lockTimeout = setTimeout(this.refreshLock, 10000);
        } catch (e) {
          if (e.body && e.body.name && (e.body.name === 'locked')) {
            await this.showLockedError(e);
            this.modal.showModal = false;
          }
          // Other errors on this are not critical
        }
        this.lockRefreshing = null;
      })();
    },
    async showLockedError(e) {
      if (e.body.data.me) {
        // We use an alert because it is a clear interruption of their
        // work, and because a notification would appear in both windows
        // if control was taken by the same user in another window,
        // which would be confusing.
        await apos.alert({
          heading: 'You Took Control in Another Window',
          description: 'You took control of this document in another tab or window.'
        });
      } else {
        await apos.alert({
          heading: 'Another User Took Control',
          description: 'Another user took control of the document.'
        });
      }
    },
    // Implementing a method expected by the advisory lock mixin
    lockNotAvailable() {
      this.modal.showModal = false;
    },
    submit() {
      this.save({
        andPublish: this.manuallyPublished,
        savingDraft: false
      });
    },
    // If andPublish is true, publish after saving.
    // If savingDraft is true, make sure we're in draft
    // mode before redirecting to the _url of the draft.
    async save({
      andPublish = false,
      savingDraft = false
    }) {
      this.triggerValidation = true;
      this.$nextTick(async () => {
        if (this.errorCount) {
          await apos.notify('Resolve errors before saving.', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
          this.focusNextError();
          return;
        }
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
        }
        let doc;
        try {
          doc = await requestMethod(route, {
            busy: true,
            body,
            draft: true
          });
          apos.bus.$emit('content-changed', doc);
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
        if (andPublish) {
          await this.publish(this.moduleAction, doc._id, !!doc.lastPublishedAt);
        }
        this.$emit('modal-result', doc);
        this.modal.showModal = false;
        // TODO: Add a check if we should redirect on creation based on the doc
        // type.
        if (doc._url && (!this.docId)) {
          apos.bus.$emit('set-context', {
            mode: savingDraft ? 'draft' : null,
            doc
          });
        }
      });
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
        await apos.notify('Error while creating new, empty content.', {
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
      this.prepErrors();
      this.docReady = true;
    },
    updateDocFields(value) {
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
    async onDiscardDraft(e) {
      if (await this.discardDraft(this.moduleAction, this.docId, !!this.published)) {
        this.modal.showModal = false;
      }
    },
    saveDraft() {
      this.save({
        andPublish: false,
        savingDraft: true
      });
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-doc-editor__body {
    padding-top: 20px;
    max-width: 90%;
    margin-right: auto;
    margin-left: auto;
  }

  .apos-doc-editor__utility {
    padding: 40px 20px;
  }
</style>
