<template>
  <AposModal
    class="apos-widget-editor"
    :modal="modal" :modal-title="editLabel"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="confirmAndCancel" @no-modal="$emit('safe-close')"
  >
    <template #breadcrumbs>
      <AposModalBreadcrumbs
        v-if="breadcrumbs && breadcrumbs.length" :items="breadcrumbs"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div class="apos-widget-editor__body">
            <AposSchema
              :trigger-validation="triggerValidation"
              :schema="schema"
              :value="docFields"
              @input="updateDocFields"
              @validate="triggerValidate"
              :following-values="followingValues()"
              :conditional-fields="conditionalFields()"
              ref="schema"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
    <template #footer>
      <AposButton
        type="default" label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
      <AposButton
        type="primary" @click="save"
        :label="saveLabel"
        :disabled="docFields.hasErrors"
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
    value: {
      required: false,
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
    return {
      id: this.value && this.value._id,
      original: null,
      docFields: {
        data: {},
        hasErrors: false
      },
      modal: {
        title: this.editLabel,
        active: false,
        type: 'slide',
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
    apos.area.widgetOptions = [
      klona(this.options),
      ...apos.area.widgetOptions
    ];
    this.modal.active = true;
  },
  destroyed() {
    apos.area.widgetOptions = apos.area.widgetOptions.slice(1);
  },
  created() {
    const defaults = this.getDefault();

    if (this.value) {
      this.original = klona(this.value);
      this.docFields.data = {
        ...defaults,
        ...this.value
      };
      return;
    }

    this.original = klona(defaults);
    this.docFields.data = defaults;
  },
  methods: {
    updateDocFields(value) {
      this.docFields = value;
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

<style lang="scss" scoped>
  .apos-widget-editor ::v-deep .apos-modal__inner {
    max-width: 458px;
  }
</style>
