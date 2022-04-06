<template>
  <AposModal
    class="apos-doc-editor"
    :modal="modal"
    :modal-title="modalTitle"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
    @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <AposButton
        type="primary"
        label="apostrophe:update"
        :disabled="docFields.hasErrors"
        @click="submit"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <!-- <AposModalTabs
          :key="tabKey"
          v-if="tabs.length > 0"
          :current="currentTab"
          :tabs="tabs"
          :errors="fieldErrors"
          @select-tab="switchPane"
        /> -->
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <AposModalTabsBody>
            <div class="apos-doc-editor__body">
              <AposSchema
                v-if="docReady"
                :schema="schema"
                :value="docFields"
                @input="updateDocFields"
              />
            </div>
          </AposModalTabsBody>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import { klona } from 'klona';

export default {
  name: 'AposImageRelationshipEditor',
  mixins: [
    AposModifiedMixin
  ],
  props: {
    schema: {
      type: Array,
      default() {
        return [];
      }
    },
    value: {
      type: Object,
      default() {
        return null;
      }
    },
    title: {
      type: String,
      required: true
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    return {
      docReady: false,
      original: this.value,
      docFields: {
        data: {
          ...((this.value != null) ? this.value
            : Object.fromEntries(
              this.schema.map(field =>
                [ field.name, (field.def !== undefined) ? klona(field.def) : null ]
              )
            )
          )
        },
        hasErrors: false
      },
      modal: {
        active: false,
        type: 'overlay',
        showModal: true
      },
      modalTitle: {
        key: 'apostrophe:editImageRelationshipTitle',
        title: this.title
      }
    };
  },
  async mounted() {
    console.log('this.schema ===> ', this.schema);

    this.modal.active = true;
    this.docReady = true;
  },
  methods: {
    async submit() {
      this.$emit('modal-result', this.docFields.data);
      this.modal.showModal = false;
    },
    updateDocFields(value) {
      this.docFields = value;
    },
    isModified() {
      return detectDocChange(this.schema, this.original, this.docFields.data);
    },
    groups() {
      const groups = this.schema.reduce((acc, field) => {
        const { name, label } = field.group;

        return [
          ...acc,
          {
            [name]: {
              label: field.group.label,
              fields: [ field.name ],
              schema: [ field ]
            }
          }
        ];

      }, []);

      this.schema.forEach(field => {
        if (!this.filterOutParkedFields([ field.name ]).length) {
          return;
        }
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
      if (!groupSet.utility) {
        groupSet.utility = {
          label: 'apostrophe:utility',
          fields: [],
          schema: []
        };
      }
      return groupSet;
    }
  }
};
</script>
