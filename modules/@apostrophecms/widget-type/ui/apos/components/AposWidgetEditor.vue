<template>
  <AposModal
    class="apos-widget-editor"
    :modal="modal"
    :modal-title="editLabel"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
  >
    <template #breadcrumbs>
      <AposModalBreadcrumbs v-if="breadcrumbs && breadcrumbs.length" :items="breadcrumbs" />
      <AposWidgetModalTabs
        v-if="tabs.length && tabs[0].name !== 'ungrouped'"
        :key="tabKey"
        :current="currentTab"
        :tabs="tabs"
        orientation="horizontal"
        :errors="fieldErrors"
        @select-tab="switchPane"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div class="apos-widget-editor__body">
            <AposSchema
              v-for="tab in tabs"
              v-show="tab.name === currentTab"
              :key="tab.name"
              :ref="tab.name"
              :data-apos-test="`schema:${tab.name}`"
              :trigger-validation="triggerValidation"
              :current-fields="groups[tab.name].fields"
              :schema="groups[tab.name].schema"
              :model-value="docFields"
              :meta="meta"
              :following-values="followingValues()"
              :conditional-fields="conditionalFields"
              @update:model-value="updateDocFields"
              @validate="triggerValidate"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
    <template #footer>
      <AposButton
        type="default"
        label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
      <AposButton
        type="primary"
        :label="saveLabel"
        :disabled="errorCount > 0"
        @click="save"
      />
    </template>
  </AposModal>
</template>

<script>
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import AposDocErrorsMixin from 'Modules/@apostrophecms/modal/mixins/AposDocErrorsMixin';
import AposModalTabsMixin from 'Modules/@apostrophecms/modal/mixins/AposModalTabsMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import { createId } from '@paralleldrive/cuid2';
import { klona } from 'klona';
import newInstance from 'apostrophe/modules/@apostrophecms/schema/lib/newInstance.js';

export default {
  name: 'AposWidgetEditor',
  mixins: [ AposModifiedMixin, AposEditorMixin, AposDocErrorsMixin, AposModalTabsMixin ],
  props: {
    type: {
      required: true,
      type: String
    },
    breadcrumbs: {
      type: Array,
      default: function () {
        return [];
      }
    },
    options: {
      required: true,
      type: Object
    },
    modelValue: {
      required: false,
      type: Object,
      default() {
        return {};
      }
    },
    meta: {
      type: Object,
      default() {
        return {};
      }
    },
    focused: {
      type: Boolean,
      default: false
    },
    parentFollowingValues: {
      type: Object,
      default: null
    }
  },
  emits: [ 'modal-result' ],
  data() {
    const moduleOptions = window.apos.modules[apos.area.widgetManagers[this.type]];

    return {
      id: this.modelValue && this.modelValue._id,
      original: null,
      docFields: {
        data: {},
        hasErrors: false
      },
      fieldErrors: {},
      modal: {
        title: this.editLabel,
        active: false,
        type: 'slide',
        width: moduleOptions.width,
        origin: moduleOptions.origin,
        showModal: false
      },
      triggerValidation: false
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.modules[apos.area.widgetManagers[this.type]];
    },
    typeLabel() {
      return this.moduleOptions.label;
    },
    editLabel() {
      if (this.moduleOptions.editLabel) {
        return this.moduleOptions.editLabel;
      } else {
        return {
          key: 'apostrophe:editType',
          type: this.$t(this.typeLabel)
        };
      }
    },
    saveLabel() {
      if (this.moduleOptions.saveLabel) {
        return this.moduleOptions.saveLabel;
      } else {
        return {
          key: 'apostrophe:saveType',
          type: this.$t(this.typeLabel)
        };
      }
    },
    schema() {
      return (this.moduleOptions.schema || []).filter(field => apos.schema.components.fields[field.type]);
    },
    isModified() {
      return detectDocChange(this.schema, this.original, this.docFields.data);
    }
  },
  async mounted() {
    this.modal.active = true;
    await this.evaluateExternalConditions();
    this.evaluateConditions();
    apos.area.widgetOptions = [
      klona(this.options),
      ...apos.area.widgetOptions
    ];
  },
  unmounted() {
    apos.area.widgetOptions = apos.area.widgetOptions.slice(1);
  },
  created() {
    const defaults = this.getDefault();

    if (this.modelValue) {
      this.original = klona(this.modelValue);
      this.docFields.data = {
        ...defaults,
        ...this.modelValue
      };
      return;
    }

    this.original = klona(defaults);
    this.docFields.data = defaults;
  },
  methods: {
    updateDocFields(value) {
      this.updateFieldErrors(value.fieldState);
      this.docFields.data = {
        ...this.docFields.data,
        ...value.data
      };
      this.evaluateConditions();
    },
    async save() {
      this.triggerValidation = true;
      this.$nextTick(async () => {
        const widget = klona(this.docFields.data);
        if (this.errorCount > 0) {
          this.triggerValidation = false;
          await apos.notify('apostrophe:resolveErrorsBeforeSaving', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
          this.focusNextError();
          return;
        }
        try {
          await this.postprocess();
        } catch (e) {
          await this.handleSaveError(e, {
            fallback: 'An error occurred saving the widget.'
          });
          return;
        }
        if (!widget.type) {
          widget.type = this.type;
        }
        if (!this.id) {
          widget._id = createId();
        }
        this.$emit('modal-result', widget);
        this.modal.showModal = false;
      });
    },
    getDefault() {
      return newInstance(this.schema);
    },
    getAposSchema(field) {
      return this.$refs[field.group.name][0];
    }
  }
};
</script>
