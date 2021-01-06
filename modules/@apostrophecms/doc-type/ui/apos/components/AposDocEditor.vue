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
        v-if="moduleOptions.localized && !moduleOptions.autopublish && (isModified || isModifiedFromPublished)"
        :is-modified="isModified"
        :is-modified-from-published="isModifiedFromPublished"
        :save-draft="true"
        @saveDraft="saveDraft"
        @discardDraft="discardDraft"
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
import { defaultsDeep } from 'lodash';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import klona from 'klona';

export default {
  name: 'AposDocEditor',
  mixins: [
    AposModalTabsMixin,
    AposModalModifiedMixin,
    AposEditorMixin
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
    needPublishButton() {
      return this.moduleOptions.localized && !this.moduleOptions.autopublish;
    },
    saveLabel() {
      if (this.needPublishButton) {
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
          await apos.httpDraft.patch(getOnePath, {
            body: {
              _advisoryLock: {
                htmlPageId: apos.adminBar.htmlPageId,
                lock: true
              }
            }
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
                await apos.httpDraft.patch(getOnePath, {
                  body: {
                    _advisoryLock: {
                      htmlPageId: apos.adminBar.htmlPageId,
                      lock: true,
                      force: true
                    }
                  }
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
        docData = await apos.httpDraft.get(getOnePath, {
          busy: true,
          qs: this.filterValues
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
        if (this.needPublishButton) {
          this.published = await apos.http.get(getOnePath, {
            busy: true,
            qs: {
              ...this.filterValues,
              'apos-mode': 'published'
            }
          });
        }
      } catch (e) {
        console.error(e);
        // TODO a nicer message here, but moduleLabels is undefined here
        await apos.notify('An error occurred fetching the published version of the document.', {
          type: 'warning',
          icon: 'alert-circle-icon',
          dismiss: true
        });
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
        await apos.httpDraft.patch(`${this.moduleAction}/${this.docId}`, {
          body: {
            _advisoryLock: {
              htmlPageId: apos.adminBar.htmlPageId,
              lock: false
            }
          }
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
          await apos.httpDraft.patch(`${this.moduleAction}/${this.docId}`, {
            body: {
              _advisoryLock: {
                htmlPageId: apos.adminBar.htmlPageId,
                lock: true
              }
            }
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
      this.save(this.needPublishButton);
    },
    save(andPublish = false) {
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
          requestMethod = apos.httpDraft.put;
          // Make sure we fail if someone else took the advisory lock
          body._advisoryLock = {
            htmlPageId: apos.adminBar.htmlPageId,
            lock: true
          };
        } else {
          route = this.moduleAction;
          requestMethod = apos.httpDraft.post;

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
            body
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
          await this.publish(doc._id);
        }
        this.$emit('modal-result', doc);
        this.modal.showModal = false;
        if ((this.moduleName === '@apostrophecms/page') && (!this.docId)) {
          window.location.href = doc._url;
        }
      });
    },
    async publish(_id) {
      try {
        await apos.http.post(`${this.moduleAction}/${this.docId}/publish`, {
          body: {},
          busy: true
        });
        const event = {
          name: 'revert-published-to-previous',
          data: {
            action: this.moduleAction,
            _id
          }
        };
        apos.notify(`Your changes have been published. <button data-apos-bus-event='${JSON.stringify(event)}'>Undo Publish</a>`, {
          type: 'success',
          dismiss: true
        });
      } catch (e) {
        if ((e.name === 'invalid') && e.body && e.body.data && e.body.data.unpublishedAncestors) {
          if (await apos.confirm({
            heading: 'One or more parent pages have not been published',
            description: `To publish this page, you must also publish the following pages: ${e.body.data.unpublishedAncestors.map(page => page.title).join(', ')}\nDo you want to do that now?`
          })) {
            try {
              for (const page of e.body.data.unpublishedAncestors) {
                await apos.http.post(`${this.moduleAction}/${_id}/publish`, {
                  body: {},
                  busy: true
                });
              }
              // Retry now that ancestors are published
              return this.publish(_id);
            } catch (e) {
              await apos.alert({
                heading: 'An Error Occurred While Publishing',
                description: e.message || 'An error occurred while publishing a parent page.'
              });
            }
          }
        } else {
          await this.handleSaveError(e, {
            fallback: 'An error occurred while publishing the document.'
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
        const newDoc = await apos.httpDraft.post(this.moduleAction, {
          body
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
    async discardDraft() {
      try {
        if (await apos.confirm({
          heading: 'Are You Sure?',
          description: this.published
            ? 'This will discard all changes since the document was last published.'
            : 'Since this draft has never been published, this will completely delete the document.'
        })) {
          if (this.published) {
            const doc = await apos.http.post(`${this.moduleAction}/${this.docId}/revert-draft-to-published`, {
              body: {},
              busy: true
            });
            apos.notify('Discarded draft.', {
              type: 'success',
              dismiss: true
            });
            this.modal.showModal = false;
            apos.bus.$emit('content-changed', doc);
          } else {
            await apos.http.delete(`${this.moduleAction}/${this.docId}`, {
              body: {},
              busy: true
            });
            apos.notify('Deleted document.', {
              type: 'success',
              dismiss: true
            });
            this.modal.showModal = false;
            apos.bus.$emit('content-changed');
          }
        }
      } catch (e) {
        await apos.alert({
          heading: 'An Error Occurred',
          description: e.message || 'An error occurred while restoring the previously published version.'
        });
      }
    },
    saveDraft() {
      this.save(false);
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
