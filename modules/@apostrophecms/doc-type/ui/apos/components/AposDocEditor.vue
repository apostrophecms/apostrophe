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
        :options="{ saveDraft: true }"
        @saveDraft="saveDraft"
        @discardDraft="onDiscardDraft"
      />
      <AposButton
        type="primary" :label="saveLabel"
        :disabled="docOtherFields.hasErrors || docUtilityFields.hasErrors"
        @click="submit"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <AposModalTabs
          v-if="tabs.length > 0"
          :current="currentTab" :tabs="tabs"
          @select-tab="switchPane"
        />
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <AposModalTabsBody>
            <div class="apos-doc-editor__body">
              <AposSchema
                v-if="docReady"
                :schema="schemaOtherFields"
                :current-fields="currentFields"
                :trigger-validation="triggerValidation"
                :utility-rail="false"
                :following-values="followingValues('other')"
                :doc-id="docId"
                :value="docOtherFields"
                @input="updateDocOtherFields"
                :server-errors="serverErrors"
                ref="otherSchema"
              />
            </div>
          </AposModalTabsBody>
        </template>
      </AposModalBody>
    </template>
    <template #rightRail>
      <AposModalRail type="right">
        <div class="apos-doc-editor__utility">
          <AposSchema
            v-if="docReady"
            :schema="schemaUtilityFields"
            :current-fields="utilityFields"
            :trigger-validation="triggerValidation"
            :utility-rail="true"
            :following-values="followingValues('utility')"
            :doc-id="docId"
            :value="docUtilityFields"
            @input="updateDocUtilityFields"
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
import { defaultsDeep } from 'lodash';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import klona from 'klona';

export default {
  name: 'AposDocEditor',
  mixins: [
    AposModalTabsMixin,
    AposModalModifiedMixin,
    AposEditorMixin,
    AposPublishMixin
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
      docType: this.moduleName,
      docUtilityFields: {
        data: {},
        hasErrors: false
      },
      docOtherFields: {
        data: {},
        hasErrors: false
      },
      docReady: false,
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      splittingDoc: false,
      schemaUtilityFields: [],
      schemaOtherFields: [],
      triggerValidation: false,
      original: null,
      published: null,
      locked: false,
      lockTimeout: null,
      lockRefreshing: null
    };
  },
  computed: {
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
            fields: [ field.name ]
          };
        } else if (field.group) {
          groupSet[field.group.name].fields.push(field.name);
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
          const temp = { ...this.groups[key] };
          temp.name = key;
          tabs.push(temp);
        }
      };
      return tabs;
    },
    modalTitle() {
      return `Edit ${this.moduleOptions.label || ''}`;
    },
    currentFields() {
      if (this.currentTab) {
        const tabFields = this.tabs.find((item) => {
          return item.name === this.currentTab;
        });

        return tabFields.fields;
      } else {
        return [];
      }
    },
    manuallyPublished() {
      return this.moduleOptions.localized && !this.moduleOptions.autopublish;
    },
    saveLabel() {
      if (this.manuallyPublished) {
        return 'Publish Changes';
      } else {
        return 'Save';
      }
    },
    isModified() {
      if (!this.original) {
        return false;
      }
      return detectDocChange(this.schema, this.original, this.unsplitDoc());
    },
    isModifiedFromPublished() {
      if (!this.published) {
        return false;
      }
      return detectDocChange(this.schema, this.published, this.unsplitDoc());
    },
    canDiscardDraft() {
      return (this.docId && (!this.published)) || this.isModifiedFromPublished;
    }
  },
  watch: {
    'docUtilityFields.data': {
      deep: true,
      handler(newVal, oldVal) {
        if (this.moduleName !== '@apostrophecms/page' || this.splittingDoc) {
          return;
        }

        if (this.docType !== newVal.type) {
          // Return the split data into `docFields.data` before splitting again.
          this.docFields.data = defaultsDeep(this.docOtherFields.data, this.docUtilityFields.data, this.docFields.data);

          this.docType = newVal.type;
          this.docReady = false;

          // Let the schema update before splitting up the doc again.
          this.$nextTick(() => {
            this.splitDoc();
            this.docReady = true;
          });
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
        try {
          await apos.http.patch(getOnePath, {
            body: {
              _advisoryLock: {
                htmlPageId: apos.adminBar.htmlPageId,
                lock: true
              }
            },
            draft: true
          });
          this.markLockedAndScheduleRefresh();
        } catch (e) {
          if (e.body && e.body && e.body.name === 'locked') {
            // We do not ask before busting our own advisory lock.
            // We used to do this in A2 but end users told us they hated it and
            // were constantly confused by it. This is because there is no
            // way to guarantee a lock is dropped when leaving the page
            // in edit mode. However, in the rare case where the "other tab"
            // getting its lock busted really is another tab, we do notify
            // the user there.
            if (e.body.data.me ||
              await apos.confirm({
                heading: 'Another User Is Editing',
                description: `${e.body.data.title} is editing that document. Do you want to take control?`
              })
            ) {
              try {
                await apos.http.patch(getOnePath, {
                  body: {
                    _advisoryLock: {
                      htmlPageId: apos.adminBar.htmlPageId,
                      lock: true,
                      force: true
                    }
                  },
                  draft: true
                });
                this.markLockedAndScheduleRefresh();
              } catch (e) {
                await apos.notify(e.message, {
                  type: 'error'
                });
                this.modal.showModal = false;
              }
            } else {
              this.modal.showModal = false;
            }
          }
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
        if (docData.type !== this.docType) {
          this.docType = docData.type;
        }
        this.original = klona(docData);
        this.docFields.data = docData;
        this.docReady = true;
        this.splitDoc();
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
  async destroyed () {
    if (this.locked) {
      clearTimeout(this.lockTimeout);
      if (this.lockRefreshing) {
        // First await the promise we held onto to make sure there is
        // no race condition that leaves the lock in place
        await this.lockRefreshing;
      }
      try {
        await apos.http.patch(`${this.moduleAction}/${this.docId}`, {
          body: {
            _advisoryLock: {
              htmlPageId: apos.adminBar.htmlPageId,
              lock: false
            }
          },
          draft: true
        });
      } catch (e) {
        // Not our concern, just being polite
      }
    }
  },
  methods: {
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
        if (this.docUtilityFields.hasErrors || this.docOtherFields.hasErrors) {
          await apos.notify('Resolve errors before saving.', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
          return;
        }

        const body = this.unsplitDoc();
        let route;
        let requestMethod;
        if (this.docId) {
          route = `${this.moduleAction}/${this.docId}`;
          requestMethod = apos.http.put;
          // Make sure we fail if someone else took the advisory lock
          body._advisoryLock = {
            htmlPageId: apos.adminBar.htmlPageId,
            lock: true
          };
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
          if (e.body && (e.body.name === 'locked')) {
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
          await this.publish(this.moduleAction, doc._id);
        }
        this.$emit('modal-result', doc);
        this.modal.showModal = false;
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
      this.splitDoc();
      this.docReady = true;
    },
    splitDoc() {
      this.splittingDoc = true;

      this.docUtilityFields.data = {};
      this.docOtherFields.data = {};
      this.schemaUtilityFields = [];
      this.schemaOtherFields = [];

      this.schema.forEach(field => {
        if (field.group.name === 'utility') {
          this.docUtilityFields.data[field.name] = this.docFields.data[field.name];
          this.schemaUtilityFields.push(field);
        } else {
          this.docOtherFields.data[field.name] = this.docFields.data[field.name];
          this.schemaOtherFields.push(field);
        }
      });
      this.splittingDoc = false;
    },
    unsplitDoc() {
      return {
        ...this.docFields.data,
        ...this.docUtilityFields.data,
        ...this.docOtherFields.data
      };
    },
    // Override of a mixin method to accommodate the tabs/utility rail split
    getFieldValue(name) {
      if (this.docUtilityFields.data[name] !== undefined) {
        return this.docUtilityFields.data[name];
      }
      if (this.docOtherFields.data[name] !== undefined) {
        return this.docOtherFields.data[name];
      }
    },
    updateDocUtilityFields(value) {
      this.docUtilityFields = value;
    },
    updateDocOtherFields(value) {
      this.docOtherFields = value;
    },
    getAposSchema(field) {
      if (field.group.name === 'utility') {
        return this.$refs.utilitySchema;
      } else {
        return this.$refs.otherSchema;
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
