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
import { createId } from '@paralleldrive/cuid2';
import { klona } from 'klona';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import AposDocErrorsMixin from 'Modules/@apostrophecms/modal/mixins/AposDocErrorsMixin';
import AposModalTabsMixin from 'Modules/@apostrophecms/modal/mixins/AposModalTabsMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import newInstance from 'apostrophe/modules/@apostrophecms/schema/lib/newInstance.js';
import { debounceAsync } from 'Modules/@apostrophecms/ui/utils';
import { renderScopedStyles } from 'Modules/@apostrophecms/styles/universal/render.mjs';
import checkIfConditions from 'apostrophe/lib/universal/check-if-conditions.mjs';
import breakpointPreviewTransformer from 'postcss-viewport-to-container-toggle/standalone.js';

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
    },
    contextualStyles: {
      type: Boolean,
      default: false
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
        type: 'window',
        disableHeader: true,
        overlay: 'transparent',
        width: moduleOptions.width,
        origin: guessOrigin(this.preview?.area, moduleOptions),
        showModal: false
      },
      triggerValidation: false,
      lastPreview: null
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
    this.areaDebounceUpdate.cancel?.();
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
    this.areaDebounceUpdate = this.preview
      ? debounceAsync(
        (now) => {
          this.lastPreview = now;
          return this.preview?.area
            .update(this.getPreviewWidgetObject(), { autosave: false })
            .catch(e => {
              if (e.name !== 'debounce.canceled') {
                // eslint-disable-next-line no-console
                console.error('Error updating preview', e);
              }
            });
        },
        250
      )
      : () => {};
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
      this.updatePreview(value);
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
    updatePreview(value) {
      if (!this.preview) {
        return;
      }

      const recomputeOnlyStyles = !this.contextualStyles &&
        value.changed?.length &&
        value.changed.every(fieldName => {
          return this.moduleOptions.stylesFields?.includes(fieldName) || false;
        });
      if (recomputeOnlyStyles) {
        const styles = renderScopedStyles(this.schema, value.data, {
          rootSelector: '__placeholder_root_selector__',
          checkIfConditionsFn: checkIfConditions,
          subset: this.moduleOptions.stylesFields
        });
        this.applyPreviewStyles(styles);

        return;
      }
      const now = Date.now();
      if (!this.lastPreview || (now - this.lastPreview > 250)) {
        // If we're still dragging the slider around, refresh every once in a
        // while, no matter what
        this.areaDebounceUpdate.skipDelay(now);
      } else {
        this.areaDebounceUpdate(now);
      }
    },
    removePreview() {
      if (!this.preview) {
        return;
      }
      if (this.preview.create) {
        this.preview.area.remove(
          { index: this.getPreviewWidgetIndex() },
          { autosave: false }
        );
      } else if (!this.saving) {
        this.preview.area.update(this.previewSnapshot, {
          autosave: false,
          reverting: true
        });
      }
    },
    applyPreviewStyles({
      inline = '', css = '', classes = []
    }) {
      const targetId = this.getPreviewWidgetId();

      // Multiple elements may exist - e.g. in-context and in a modal.
      const widgetElements = document.querySelectorAll(
        `[data-apos-widget-style-wrapper-for="${targetId}"]`
      );

      widgetElements.forEach((el) => {
        const styleId = el.getAttribute('id');
        if (!styleId) {
          return;
        }

        // Classes handling
        const previousClasses = (el.dataset.aposWidgetStyleClasses || '')
          .split(' ')
          .map(c => c.trim())
          .filter(Boolean);

        // remove previous style classes (based on previously applied classes)
        if (previousClasses.length) {
          el.classList.remove(previousClasses);
        }
        if (classes.length) {
          el.classList.add(...classes);
        }
        el.dataset.aposWidgetStyleClasses = classes.join(' ');

        // Inline styles handling
        if (inline) {
          el.style.cssText = inline;
        } else {
          el.removeAttribute('style');
        }

        // Element <style> handling.
        let scopedCss = css.replace(
          /__placeholder_root_selector__/g,
          `#${styleId}`
        );
        // Direct query for the style element by unique styleId
        const styleElement = document.querySelector(
          `style[data-apos-widget-style-id="${styleId}"]`
        );
        scopedCss = this.transformForBreakpointPreview(scopedCss);

        if (styleElement) {
          styleElement.textContent = scopedCss;
        } else {
          const newStyleElement = document.createElement('style');
          newStyleElement.setAttribute('data-apos-widget-style-for', targetId);
          newStyleElement.setAttribute('data-apos-widget-style-id', styleId);
          newStyleElement.textContent = scopedCss;
          el.parentNode.insertBefore(newStyleElement, el);
        }
      });
    },
    transformForBreakpointPreview(css) {
      if (css && apos.adminBar.breakpointPreviewMode?.enable) {
        return breakpointPreviewTransformer(css, {
          modifierAttr: 'data-breakpoint-preview-mode',
          debug: apos.adminBar.breakpointPreviewMode?.debug === true,
          transform: apos.adminBar.breakpointPreviewMode?.transform || null
        });
      }
      return css;
    },
    async save() {
      this.triggerValidation = true;
      this.$nextTick(async () => {
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
        const widget = this.getWidgetObject();
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
    getPreviewWidgetId() {
      if (!this.previewWidgetId) {
        if (this.preview.create) {
          // Deliberately different from the final widget's id, which will
          // be added separately and cleanly
          this.previewWidgetId = createId();
        } else {
          this.previewWidgetId = this.id;
        }
      }
      return this.previewWidgetId;
    },
    getPreviewWidgetObject() {
      const _id = this.getPreviewWidgetId();
      return {
        ...this.getWidgetObject({
          _id
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
