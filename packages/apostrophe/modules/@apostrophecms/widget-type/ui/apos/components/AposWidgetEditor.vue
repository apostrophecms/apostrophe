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
    <template
      v-if="isDisplayWindow"
      #windowChrome="{ resizeSides, startResizing }"
    >
      <div
        v-for="side in resizeSides"
        :key="side.direction"
        class="apos-window__resize-handle"
        :class="`apos-window__resize-handle--${side.edge}`"
        role="presentation"
        aria-hidden="true"
        @mousedown.stop="(e) => startResizing(e, side.direction)"
      />
      <div
        :class="[
          'apos-window__resize-handle',
          'apos-window__resize-handle--corner',
          cornerHandleClass
        ]"
        role="presentation"
        aria-hidden="true"
        @mousedown.stop="(e) => startResizing(e, cornerResizeEdge)"
      >
        <AposIndicator
          icon="resize-bottom-right-icon"
          :icon-size="18"
          icon-color="var(--a-base-0)"
        />
      </div>
    </template>
    <template #secondaryControls>
      <div class="apos-widget-editor__controls">
        <AposButton
          v-if="!disabledChangeDisplay"
          type="subtle"
          :modifiers="['small', 'no-motion']"
          :tooltip="changeDisplayTooltip"
          class="apos-widget-editor__dock-button"
          action="changeDisplay"
          :icon="changeDisplayIcon"
          :icon-size=" isDisplayWindow? 18 : 24"
          :icon-only="true"
          @click="updateEditorDisplay"
        />
      </div>
    </template>
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
    <template #localeDisplay />
    <template #main>
      <AposModalBody :current-tab="currentTab">
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
              :modifiers="isDisplayWindow ? [ 'micro'] : []"
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
        action="cancel"
        @click="confirmAndCancel"
      />
      <AposButton
        type="primary"
        action="save"
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
import { mapState } from 'pinia';
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
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

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
      triggerValidation: false,
      lastPreview: null,
      displayPrefName: `apos-${this.type}-display-pref`,
      defaultSidebarWidth: 'one-third',
      modal: {
        active: false,
        width: moduleOptions.width,
        origin: guessOrigin(this.preview?.area, moduleOptions),
        showModal: false
      }
    };
  },
  computed: {
    ...mapState(useModalStore, [ 'stack' ]),
    changeDisplayIcon() {
      const name = this.isDisplayWindow ? this.modal.origin || 'right' : 'window';
      return `dock-${name}-icon`;
    },
    changeDisplayTooltip() {
      const where = this.isDisplayWindow ? this.modal.origin || 'right' : 'window';
      return where === 'window'
        ? 'apostrophe:dockSeparate'
        : where === 'left'
          ? 'apostrophe:dockLeft'
          : 'apostrophe:dockRight';
    },
    disabledChangeDisplay() {
      return this.stack.length > 1;
    },
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
    },
    isDisplayWindow() {
      return this.modal.width === 'window';
    },
    cornerResizeEdge() {
      return this.modal.origin === 'left' ? 'se' : 'sw';
    },
    cornerHandleClass() {
      return this.modal.origin === 'left'
        ? 'apos-window__resize-handle--corner-se'
        : 'apos-window__resize-handle--corner-sw';
    },
    isForceSlide() {
      // If there are other modals open, force a slide modal
      return this.stack.length > 1;
    }
  },
  async mounted() {
    if (this.isForceSlide) {
      this.modal.width =
        this.moduleOptions.width === 'window'
          ? this.defaultSidebarWidth
          : this.moduleOptions.width;
    } else {
      this.modal.width = this.getDisplayPref();
    }
    this.modal.type = this.isDisplayWindow ? 'window' : 'slide';
    this.modal.overlay = this.isDisplayWindow ? 'transparent' : null;
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
    updateEditorDisplay() {
      if (this.isDisplayWindow) {
        if (this.moduleOptions.width === 'window') {
          this.modal.width = this.defaultSidebarWidth;
        } else {
          this.modal.width = this.moduleOptions.width;
        }
        this.modal.type = 'slide';
        this.modal.overlay = null;
      } else {
        this.modal.width = 'window';
        this.modal.type = 'window';
        this.modal.overlay = 'transparent';
      }
      this.setDisplayPref(this.modal.width);
    },
    setDisplayPref(pref) {
      window.localStorage.setItem(this.displayPrefName, pref);
    },
    getDisplayPref() {
      let pref = window.localStorage.getItem(this.displayPrefName);
      if (typeof pref !== 'string') {
        pref = this.moduleOptions.width;
      }
      return pref;
    },
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

<style lang="scss" scoped>
.apos-widget-editor__controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.apos-modal--window {
  $handle-size: 4px;

  &:deep(.apos-modal__inner.apos-window--resizing) {
    outline: 2px solid var(--a-base-5);
    outline-offset: -2px;
  }

  &:deep(.apos-window__resize-handle) {
    z-index: $z-index-default;
    position: absolute;
    transition: background-color 200ms ease;
  }

  &:deep(.apos-window__resize-handle--top),
  &:deep(.apos-window__resize-handle--bottom) {
    right: 0;
    left: 0;
    height: $handle-size;
    cursor: ns-resize;
  }

  &:deep(.apos-window__resize-handle--top) {
    top: 0;
  }

  &:deep(.apos-window__resize-handle--bottom) {
    bottom: 0;
  }

  &:deep(.apos-window__resize-handle--left),
  &:deep(.apos-window__resize-handle--right) {
    top: 0;
    bottom: 0;
    width: $handle-size;
    cursor: ew-resize;
  }

  &:deep(.apos-window__resize-handle--right) {
    right: 0;
  }

  &:deep(.apos-window__resize-handle--left) {
    left: 0;
  }

  &:deep(.apos-window__resize-handle--corner-se) {
    right: 2px;
    bottom: 2px;
    width: 18px;
    height: 18px;
    cursor: nwse-resize;
  }

  &:deep(.apos-window__resize-handle--corner-sw) {
    bottom: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    cursor: nesw-resize;

    .apos-indicator {
      transform: scaleX(-1);
    }
  }

  &:deep(.apos-modal__header__main) {
    padding: 2.5px 10px 0;
    border-top: 1px solid var(--a-base-9);
  }

  &:deep(.apos-modal__heading) {
    font-size: var(--a-type-label);
  }

  &:deep(.apos-modal__controls--secondary) {
    margin-right: 10px;
  }

  &:deep(.apos-widget-editor__dock-button .apos-button--icon-only.apos-button--subtle) {
    padding: 7.5px 0;

    &:hover,
    &:focus,
    &:active {
      background-color: transparent;
      border: none;
      outline: none;
    }
  }
}

</style>
