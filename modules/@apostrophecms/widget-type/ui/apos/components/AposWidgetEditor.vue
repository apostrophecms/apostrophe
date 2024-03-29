<template>
  <AposModal
    class="apos-widget-editor"
    :modal="modal"
    :modal-title="editLabel"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
    @no-modal="$emit('safe-close')"
  >
    <template #breadcrumbs>
      <AposModalBreadcrumbs
        v-if="breadcrumbs && breadcrumbs.length"
        :items="breadcrumbs"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div class="apos-widget-editor__body">
            <AposSchema
              ref="schema"
              :trigger-validation="triggerValidation"
              :schema="schema"
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
        :disabled="docFields.hasErrors"
        @click="save"
      />
    </template>
  </AposModal>
</template>

<script>
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import cuid from 'cuid';
import { klona } from 'klona';

export default {
  name: 'AposWidgetEditor',
  mixins: [ AposModifiedMixin, AposEditorMixin ],
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
  emits: [ 'safe-close', 'modal-result' ],
  data() {
    const moduleOptions = window.apos.modules[apos.area.widgetManagers[this.type]];

    return {
      id: this.modelValue && this.modelValue._id,
      original: null,
      docFields: {
        data: {},
        hasErrors: false
      },
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
      this.docFields = value;
      this.evaluateConditions();
    },
    async save() {
      this.triggerValidation = true;
      this.$nextTick(async () => {
        if (this.docFields.hasErrors) {
          this.triggerValidation = false;
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
        const widget = this.docFields.data;
        if (!widget.type) {
          widget.type = this.type;
        }
        if (!this.id) {
          widget._id = cuid();
        }
        this.$emit('modal-result', widget);
        this.modal.showModal = false;
      });
    },
    getDefault() {
      const widget = {};
      this.schema.forEach(field => {
        if (field.name.startsWith('_')) {
          return;
        }
        // Using `hasOwn` here, not simply checking if `field.def` is truthy
        // so that `false`, `null`, `''` or `0` are taken into account:
        const hasDefaultValue = Object.hasOwn(field, 'def');
        widget[field.name] = hasDefaultValue
          ? klona(field.def)
          : null;
      });
      return widget;
    }
  }
};
</script>
