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
      <AposButton
        type="primary" label="Save"
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
import AposModalModifiedMixin from 'Modules/@apostrophecms/modal/mixins/AposModalModifiedMixin';

export default {
  name: 'AposRelationshipEditor',
  mixins: [
    AposModalModifiedMixin
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
      required: true
    },
    title: {
      type: String,
      required: true
    }
  },
  emits: [ 'input', 'safe-close' ],
  data() {
    return {
      docReady: false,
      modal: {
        active: false,
        type: 'overlay',
        showModal: true
      },
      modalTitle: `Edit Relationship for ${this.title}`
    };
  },
  async mounted() {
    this.modal.active = true;
    this.docReady = true;
    this.docFields.data = this.value || {};
  },
  methods: {
    async submit() {
      this.$emit('input', this.docFields.data);
      this.cancel();
    },
    updateDocFields(value) {
      this.docFields = value;
      this.modified = true;
    }
  }
};
</script>
