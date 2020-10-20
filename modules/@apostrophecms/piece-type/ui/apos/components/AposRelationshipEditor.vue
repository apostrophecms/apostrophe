<template>
  <AposModal
    class="apos-doc-editor" :modal="modal"
    :modal-title="modalTitle"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="cancel" @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default" label="Cancel"
        @click="cancel"
      />
    </template>
    <template #primaryControls>
      <AposButton
        type="primary" label="Save"
        :disabled="docInfo.hasErrors"
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
                :value="docInfo"
                @input="updateDocInfo"
              />
            </div>
          </AposModalTabsBody>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';

export default {
  name: 'AposRelationshipEditor',
  mixins: [
    AposModalParentMixin
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
      docInfo: {
        data: this.value || {},
        hasErrors: false
      },
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
  },
  methods: {
    async submit() {
      this.$emit('input', this.docInfo.data);
      this.modal.showModal = false;
    },
    updateDocInfo(value) {
      this.docInfo = value;
      this.modified = true;
    }
  }
};
</script>
