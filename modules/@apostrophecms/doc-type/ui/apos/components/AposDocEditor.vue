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
        :disabled="doc.hasErrors"
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
                :schema="schema" :current-fields="currentFields"
                v-model="doc"
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
            :schema="schema" :current-fields="utilityFields"
            v-model="doc"
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

export default {
  name: 'AposDocEditor',
  mixins: [
    AposModalTabsMixin,
    AposModalParentMixin
  ],
  props: {
    moduleName: {
      type: String,
      required: true
    },
    docId: {
      type: String,
      default: null
    }
  },
  emits: [ 'saved', 'safe-close' ],
  data() {
    return {
      doc: {
        data: {},
        hasErrors: false
      },
      docReady: false,
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      }
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.modules[this.moduleName] || {};
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
  async mounted() {
    this.modal.active = true;

    if (this.docId) {
      let docData;
      try {
        const getOnePath = `${this.moduleOptions.action}/${this.docId}`;
        docData = await apos.http.get(getOnePath, {
          busy: true
        });
      } catch {
        // TODO: Add error notification. No client API for this yet.
        console.error('⁉️ The requested piece was not found.', this.docId);
        apos.bus.$emit('busy', false);
        this.cancel();
      } finally {
        this.doc.data = docData;
        this.docReady = true;
        apos.bus.$emit('busy', false);
      }
    } else {
      this.$nextTick(() => {
        this.buildEmptyDoc();
      });
    }
  },
  methods: {
    async submit() {
      apos.bus.$emit('busy', true);

      let route;
      let requestMethod;
      if (this.docId) {
        route = `${this.moduleOptions.action}/${this.docId}`;
        requestMethod = apos.http.put;
      } else {
        route = this.moduleOptions.action;
        requestMethod = apos.http.post;
      }

      try {
        await requestMethod(route, {
          busy: true,
          body: this.doc.data
        });
        this.$emit('saved');

        this.modal.showModal = false;
      } finally {
        apos.bus.$emit('busy', false);
      }
    },
    async buildEmptyDoc () {
      const newInstance = await apos.http.post(this.moduleOptions.action, {});
      this.doc.data = { ...this.schema, ...newInstance };
      this.docReady = true;
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
