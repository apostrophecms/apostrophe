<template>
  <AposModal
    class="apos-doc-editor" :modal="modal"
    :modal-title="modalTitle"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="cancel" @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default" label="Exit"
        @click="cancel"
      />
    </template>
    <template #primaryControls>
      <AposButton
        type="primary" label="Save"
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
                v-model="docOtherFields"
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
            v-model="docUtilityFields"
            :modifiers="['small', 'inverted']"
          />
        </div>
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script>
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';
import AposModalTabsMixin from 'Modules/@apostrophecms/modal/mixins/AposModalTabsMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import { defaultsDeep } from 'lodash';

export default {
  name: 'AposDocEditor',
  mixins: [
    AposModalTabsMixin,
    AposModalParentMixin,
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
          published: true,
          trash: false
        };
      }
    }
  },
  emits: [ 'saved', 'safe-close' ],
  data() {
    return {
      docType: this.moduleName,
      doc: {
        data: {},
        hasErrors: false
      },
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
      triggerValidation: false
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
      return this.moduleOptions.schema || [];
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
    modalTitle () {
      return `Edit ${this.moduleOptions.label}`;
    },
    currentFields: function() {
      if (this.currentTab) {
        const tabFields = this.tabs.find((item) => {
          return item.name === this.currentTab;
        });

        return tabFields.fields;
      } else {
        return [];
      }
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
          // Return the split data into `doc.data` before splitting again.
          this.doc.data = defaultsDeep(this.docOtherFields.data, this.docUtilityFields.data, this.doc.data);

          this.docType = newVal.type;
          this.docReady = false;

          // Let the schema update before splitting up the doc again.
          this.$nextTick(() => {
            this.splitDoc();
            this.docReady = true;
          });
        }
      }
    }
  },
  async mounted() {
    this.modal.active = true;

    if (this.docId) {
      let docData;
      try {
        const getOnePath = `${this.moduleAction}/${this.docId}`;
        docData = await apos.http.get(getOnePath, {
          busy: true,
          qs: this.filterValues
        });
      } catch {
        await apos.notify(`The requested ${this.moduleLabels.label.toLowerCase()} was not found.`, {
          type: 'warning',
          icon: 'alert-circle-icon',
          dismiss: true
        });
        console.error('The requested piece was not found.', this.docId);
        apos.bus.$emit('busy', false);
        this.cancel();
      } finally {
        this.doc.data = docData;
        this.docReady = true;
        this.splitDoc();
        apos.bus.$emit('busy', false);
      }
    } else {
      this.$nextTick(() => {
        this.loadNewInstance();
      });
    }
  },
  methods: {
    submit() {
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

        this.doc.data = {
          ...this.doc.data,
          ...this.docUtilityFields.data,
          ...this.docOtherFields.data
        };
        let route;
        let requestMethod;
        if (this.docId) {
          route = `${this.moduleAction}/${this.docId}`;
          requestMethod = apos.http.put;
        } else {
          route = this.moduleAction;
          requestMethod = apos.http.post;
        }

        await requestMethod(route, {
          busy: true,
          body: this.doc.data
        });
        this.$emit('saved');
        this.modal.showModal = false;
      });
    },
    async getNewInstance () {
      try {
        const body = {
          _newInstance: true
        };

        if (this.moduleName === '@apostrophecms/page') {
          body._targetId = apos.page.page._id;
          body._position = 'lastChild';
        }
        const newDoc = await apos.http.post(this.moduleAction, {
          body
        });

        return newDoc;
      } catch (error) {
        await apos.notify('Error while creating a new, empty item. Please check configured content types.', {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });

        this.cancel();
      }
    },
    async loadNewInstance () {
      this.docReady = false;

      const newInstance = await this.getNewInstance();

      if (newInstance && newInstance.type !== this.docType) {
        this.docType = newInstance.type;
      }
      this.doc.data = newInstance;
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
          this.docUtilityFields.data[field.name] = this.doc.data[field.name] || field.def;
          this.schemaUtilityFields.push(field);
        } else {
          this.docOtherFields.data[field.name] = this.doc.data[field.name] || field.def;
          this.schemaOtherFields.push(field);
        }
      });
      this.splittingDoc = false;
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
