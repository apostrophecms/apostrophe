<template>
  <AposModal
    class="apos-widget-editor"
    :modal="modal"
    :modal-title="editLabel"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
    @no-modal="removePreview"
  >
    <template #breadcrumbs>
      <AposModalBreadcrumbs
        v-if="breadcrumbs && breadcrumbs.length"
        :items="breadcrumbs"
      />
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
    },
    preview: {
      required: false,
      type: Object,
      default: null
      // if present, has "area", "index" and "create" properties
    },
    areaFieldId: {
      type: String,
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
        active: false,
        type: 'slide',
        width: moduleOptions.width,
        origin: guessOrigin(this.preview?.area, moduleOptions),
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
      return (this.moduleOptions.schema || [])
        .filter(field => apos.schema.components.fields[field.type]);
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
    } else {
      this.original = klona(defaults);
      this.docFields.data = defaults;
    }
    if (!this.id) {
      this.newId = createId();
    }
    this.initPreview();
  },
  methods: {
    updateDocFields(value) {
      this.updateFieldErrors(value.fieldState);
      this.docFields.data = {
        ...this.docFields.data,
        ...value.data
      };
      this.evaluateConditions();
      this.updatePreview();
    },
    initPreview() {
      if (!this.preview) {
        return;
      }
      if (this.preview.create) {
        this.preview.area.insert({
          index: this.preview.index,
          widget: this.getPreviewWidgetObject(),
          autosave: false
        });
      } else {
        // So we can restore it if we cancel
        this.previewSnapshot = this.getWidgetObject();
      }
    },
    updatePreview() {
      if (!this.preview) {
        return;
      }
      const now = Date.now();
      const body = () => {
        this.lastPreview = now;
        this.preview.area.update(this.getPreviewWidgetObject(), { autosave: false });
      };
      if (this.updatePreviewTimeout) {
        clearTimeout(this.updatePreviewTimeout);
      }
      if (!this.lastPreview || (now - this.lastPreview > 250)) {
        // If we're still dragging the slider around, refresh every once in a
        // while, no matter what
        body();
      } else {
        this.updatePreviewTimeout = setTimeout(body, 250);
      }
    },
    removePreview() {
      if (!this.preview) {
        return;
      }
      if (this.updatePreviewTimeout) {
        clearTimeout(this.updatePreviewTimeout);
      }
      if (this.preview.create) {
        this.preview.area.remove(this.getPreviewWidgetIndex(), { autosave: false });
      } else if (!this.saving) {
        this.preview.area.update(this.previewSnapshot, { autosave: false });
      }
    },
    async save() {
      if (this.updatePreviewTimeout) {
        clearTimeout(this.updatePreviewTimeout);
      }
      this.triggerValidation = true;
      this.$nextTick(async () => {
        const widget = this.getWidgetObject();
        if (this.errorCount > 0) {
          this.triggerValidation = false;
          await apos.notify('apostrophe:resolveErrorsBeforeSaving', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
          this.focusNextError();
          return;
        } else {
          try {
            await this.serverValidate();
          } catch (e) {
            this.triggerValidation = false;
            await this.handleSaveError(e, {
              fallback: 'A validation error occurred while saving the widget.'
            });
            return;
          }
        }
        try {
          await this.postprocess();
        } catch (e) {
          await this.handleSaveError(e, {
            fallback: 'An error occurred saving the widget.'
          });
          return;
        }
        this.saving = true;
        this.$emit('modal-result', widget);
        this.modal.showModal = false;
      });
    },
    async serverValidate() {
      await apos.http.post(
          `${apos.area.action}/validate-widget`,
          {
            busy: true,
            qs: {
              aposEdit: '1',
              aposMode: 'draft'
            },
            body: {
              widget: this.docFields.data,
              areaFieldId: this.areaFieldId,
              type: this.type
            }
          }
      );
    },
    getWidgetObject(props = {}) {
      const widget = klona(this.docFields.data);
      widget._id = this.id || this.newId;
      widget.type = this.type;
      return {
        ...widget,
        ...props
      };
    },
    getPreviewWidgetObject() {
      if (!this.previewWidgetId) {
        if (this.preview.create) {
          // Deliberately different from the final widget's id, which will
          // be added separately and cleanly
          this.previewWidgetId = createId();
        } else {
          this.previewWidgetId = this.id;
        }
      }
      return {
        ...this.getWidgetObject({
          _id: this.previewWidgetId
        }),
        aposLivePreview: true
      };
    },
    getPreviewWidgetIndex() {
      return this.preview.area.next.findIndex(item => {
        return item._id === this.previewWidgetId;
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

function guessOrigin(area, { isExplicitOrigin, origin }) {
  // No preview available OR custom origin.
  // Respect the origin configuration if it's not the default
  if (!area || isExplicitOrigin) {
    return origin;
  }
  // When we are in live preview mode, use the bounding box of the area to
  // figure out which side of the screen will least obscure the widget
  const rect = area.$el.getBoundingClientRect();
  const cx = (rect.right - rect.left) / 2 + rect.left;
  // Favor the right hand side slightly because rich text
  // subwidgets in centered areas are more intuitive that way
  if (cx >= (window.innerWidth * 0.55)) {
    return 'left';
  } else {
    return 'right';
  }
}
</script>
