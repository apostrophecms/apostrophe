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
        :disabled="!!errorCount"
        :tooltip="errorTooltip"
        @click="submit"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <AposModalTabs
          :key="tabKey"
          v-if="tabs.length"
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
          <AposModalTabsBody>
            <div class="apos-doc-editor__body">
              <AposSchema
                v-for="tab in tabs"
                v-show="tab.name === currentTab"
                :key="tab.name"
                :schema="groups[tab.name].schema"
                :current-fields="groups[tab.name].fields"
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
import { klona } from 'klona';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposModalTabsMixin from 'Modules/@apostrophecms/modal/mixins/AposModalTabsMixin';
import AposDocsErrorsMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsErrorsMixin';

import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';

export default {
  name: 'AposRelationshipEditor',
  mixins: [
    AposModifiedMixin,
    AposModalTabsMixin,
    AposDocsErrorsMixin
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
      this.updateFieldErrors(value.fieldState);
      this.docFields.data = {
        ...this.docFields.data,
        ...value.data
      };
    },
    isModified() {
      return detectDocChange(this.schema, this.original, this.docFields.data);
    }
  }
};
</script>
