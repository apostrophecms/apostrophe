<template>
  <AposRichTextEditor
    :id="widgetId"
    class="apos-rich-text-widget-editor"
    :style="widgetStyles.inline"
    :class="widgetStyles.classes"
    :model-value="modelValue.content"
    :options="options"
    :module-options="moduleOptions"
    :doc-id="docId"
    :autofocus="autofocus"
    :editor-id="modelValue._id"
    empty-label="apostrophe:emptyRichTextWidget"
    @update:model-value="onEditorUpdate"
    @blur="onEditorBlur"
    @interaction="onEditorInteraction"
  />
</template>

<script>
// Contextual editor for the rich text widget. All of the actual rich text
// editing functionality lives in `AposRichTextEditor`, which is also used
// by the `richText` schema field type. This component contributes only what
// is specific to widgets: the widget's own schema fields (such as contextual
// styles), the widget id used to scope those styles, and the widget update
// and control-suppression events expected by `AposAreaWidget`.
//
// Note that `AposRichTextEditor` is the single root element here, so the
// `id`, `class` and `style` bindings above land on it via attribute
// fallthrough. The markup emitted for a rich text widget is therefore
// unchanged from previous releases.
import { mapState } from 'pinia';
import newInstance from 'apostrophe/modules/@apostrophecms/schema/lib/newInstance.js';
import { merge } from 'apostrophe/lib/beneath.js';
import { useAposStyles } from 'Modules/@apostrophecms/styles/composables/AposStyles.js';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';

export default {
  name: 'AposRichTextWidgetEditor',
  props: {
    type: {
      type: String,
      required: true
    },
    options: {
      type: Object,
      required: true
    },
    modelValue: {
      type: Object,
      default() {
        return {};
      }
    },
    // not used, but we need to keep it here to avoid
    // an attribute [object Object]
    meta: {
      type: Object,
      default() {
        return {};
      }
    },
    docId: {
      type: String,
      required: false,
      default() {
        return null;
      }
    },
    focused: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'update', 'suppressWidgetControls', 'suppressAddContentButtons' ],
  setup() {
    return useAposStyles();
  },
  data() {
    return {
      docFields: {
        data: {
          ...this.modelValue
        },
        hasErrors: false
      },
      suppressWidgetControls: false,
      suppressAddContentButtons: false
    };
  },
  computed: {
    ...mapState(useWidgetStore, [ 'focusedWidget' ]),
    moduleOptions() {
      return apos.modules[apos.area.widgetManagers[this.type]];
    },
    autofocus() {
      // Only true for a new rich text widget.
      // `_autofocus: false` can be set during default instance creation to avoid
      // focusing the **last** inserted rich text widget
      return !this.modelValue.content.length && this.modelValue._autofocus !== false;
    }
  },
  watch: {
    modelValue(newVal, oldVal) {
      if (newVal.content !== oldVal.content) {
        return;
      }
      // Accept any changes that were made to regular schema fields (like styles)
      // so that we don't blow them away later when we emit changes to the rich text
      const schema = this.moduleOptions.schema;
      for (const field of schema) {
        this.docFields.data[field.name] = newVal[field.name];
      }
      // Recompute the visualization of the styles
      this.recomputeChangedStyles(newVal, oldVal, {
        moduleOptions: this.moduleOptions
      });
    },
    suppressWidgetControls(newVal) {
      if (newVal) {
        this.$emit('suppressWidgetControls');
      }
    },
    suppressAddContentButtons(newVal) {
      if (newVal) {
        this.$emit('suppressAddContentButtons');
      }
    }
  },
  mounted() {
    const widgetInstance = newInstance(
      this.moduleOptions.schema
    );
    merge(widgetInstance, this.docFields.data);
    this.docFields.data = widgetInstance;

    this.getWidgetStyles(this.docFields.data, this.moduleOptions);
  },
  methods: {
    onEditorUpdate(content) {
      const widget = this.docFields.data;
      widget.content = content;
      // ... removes need for deep watching in parent
      this.$emit('update', { ...widget });
    },
    // Emitted just before the editor flushes any pending update, so the
    // widget controls come back as soon as the editor is no longer focused
    onEditorBlur() {
      this.suppressWidgetControls = false;
      this.suppressAddContentButtons = false;
    },
    // Typing or selecting text in the editor should get the widget controls
    // and "add content" buttons out of the way
    onEditorInteraction() {
      this.suppressWidgetControls = true;
      this.suppressAddContentButtons = true;
    }
  }
};
</script>
