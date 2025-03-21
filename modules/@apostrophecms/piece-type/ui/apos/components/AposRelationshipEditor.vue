<template>
  <AposModal
    class="apos-doc-editor"
    :modal="modal"
    :modal-title="modalTitle"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
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
        label="apostrophe:save"
        :disabled="!!errorCount"
        :tooltip="errorTooltip"
        :attrs="{'data-apos-focus-priority': true}"
        @click="submit"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <AposModalTabs
          v-if="tabs.length"
          :key="tabKey"
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
                :ref="tab.name"
                :schema="groups[tab.name].schema"
                :current-fields="groups[tab.name].fields"
                :model-value="docFields"
                :trigger-validation="triggerValidation"
                @update:model-value="updateDocFields"
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
import AposModalTabsMixin from 'Modules/@apostrophecms/modal/mixins/AposModalTabsMixin';
import AposDocErrorsMixin from 'Modules/@apostrophecms/modal/mixins/AposDocErrorsMixin';
import newInstance from 'apostrophe/modules/@apostrophecms/schema/lib/newInstance.js';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';

export default {
  name: 'AposRelationshipEditor',
  mixins: [
    AposModifiedMixin,
    AposModalTabsMixin,
    AposDocErrorsMixin
  ],
  props: {
    schema: {
      type: Array,
      default() {
        return [];
      }
    },
    modelValue: {
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
  emits: [ 'modal-result' ],
  data() {
    return {
      docReady: false,
      original: this.modelValue,
      docFields: {
        data: {
          ...((this.modelValue != null)
            ? this.modelValue
            : newInstance(this.schema)
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
      },
      triggerValidation: false
    };
  },
  async mounted() {
    this.modal.active = true;
    this.docReady = true;
  },
  methods: {
    async submit() {
      this.triggerValidation = true;

      this.$nextTick(async () => {
        if (!this.errorCount) {
          this.$emit('modal-result', this.docFields.data);
          this.modal.showModal = false;
        } else {
          this.triggerValidation = false;
          await apos.notify('apostrophe:resolveErrorsBeforeSaving', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
          this.focusNextError();
        }
      });
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
