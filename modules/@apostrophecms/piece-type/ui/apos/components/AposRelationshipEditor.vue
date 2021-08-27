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
      <AposButton
        type="primary" label="apostrophe:save"
        :disabled="docFields.hasErrors"
        @click="submit"
      />
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
  name: 'AposRelationshipEditor',
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
          ...((this.value != null) ? this.value :
            Object.fromEntries(
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
        key: 'apostrophe:editRelationshipFor',
        title: this.title
      }
    };
  },
  async mounted() {
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
    }
  }
};
</script>
